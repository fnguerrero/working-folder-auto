<#
.SYNOPSIS
  Saca de un SQL Server las consultas más lentas con su plan de ejecución (.sqlplan), para pegarlas en Plan en criollo.

.DESCRIPTION
  Tres modos:
  1. Caché de planes (por defecto): lee sys.dm_exec_query_stats y guarda las N consultas más pesadas
     desde el último reinicio. Los planes son los de la caché (estimados: sin filas reales).
  2. Query Store (-QueryStore): lee sys.query_store_* de una base con Query Store activo. Trae
     duración, CPU, lecturas y filas reales promedio por plan. Los planes también son estimados.
  3. Una consulta (-Consulta "SELECT ..."): la ejecuta con SET STATISTICS XML ON y guarda el plan REAL,
     con filas, lecturas y tiempos. Solo ejecuta lo que le pasás vos.

  En la carpeta de salida deja un .sqlplan por consulta, un resumen.csv y un resumen.html con la tabla
  y el link a Plan en criollo. No modifica nada en el servidor.

.PARAMETER Servidor
  Instancia: "localhost", ".\SQLEXPRESS", "servidor,1433". Por defecto, localhost.
.PARAMETER Base
  Base de datos. En modo caché filtra por esa base; en modo Query Store y -Consulta es obligatoria.
.PARAMETER Usuario
  Usuario SQL. Si no se indica, usa autenticación de Windows (integrada).
.PARAMETER Clave
  Contraseña del usuario SQL.
.PARAMETER Top
  Cuántas consultas traer. Por defecto 10.
.PARAMETER OrdenarPor
  duracion (promedio), cpu (promedio), lecturas (promedio), total (duración acumulada) o ejecuciones. Por defecto, duracion.
.PARAMETER MinimoEjecuciones
  Ignora consultas con menos ejecuciones que esto (saca las que corrieron una sola vez). Por defecto 1.
.PARAMETER Carpeta
  Dónde guardar. Por defecto .\planes-AAAAMMDD-HHMM.
.PARAMETER QueryStore
  Usa Query Store en lugar de la caché de planes.
.PARAMETER Consulta
  Texto de una consulta a ejecutar para capturar su plan real.
.PARAMETER Abrir
  Abre el resumen.html al terminar (Windows).

.EXAMPLE
  .\Get-PlanesLentos.ps1 -Servidor ".\SQLEXPRESS" -Top 20
.EXAMPLE
  .\Get-PlanesLentos.ps1 -Servidor srv-sql -Base Ventas -QueryStore -OrdenarPor cpu -MinimoEjecuciones 10
.EXAMPLE
  .\Get-PlanesLentos.ps1 -Servidor localhost -Base Ventas -Usuario sa -Clave "..." -Consulta "SELECT TOP 10 * FROM dbo.Pedidos WHERE ClienteId = 1"
#>
[CmdletBinding()]
param(
  [string] $Servidor = "localhost",
  [string] $Base = "",
  [string] $Usuario = "",
  [string] $Clave = "",
  [int] $Top = 10,
  [ValidateSet("duracion", "cpu", "lecturas", "total", "ejecuciones")] [string] $OrdenarPor = "duracion",
  [int] $MinimoEjecuciones = 1,
  [string] $Carpeta = "",
  [switch] $QueryStore,
  [string] $Consulta = "",
  [switch] $Abrir
)

$ErrorActionPreference = "Stop"
$PLAN_EN_CRIOLLO = "https://fnguerrero.github.io/working-folder-auto/herramientas/plan-en-criollo/"

function Nueva-Conexion {
  $cadena = "Server=$Servidor;Application Name=Get-PlanesLentos;TrustServerCertificate=True;Connect Timeout=15"
  if ($Base) { $cadena += ";Database=$Base" }
  if ($Usuario) { $cadena += ";User Id=$Usuario;Password=$Clave" } else { $cadena += ";Integrated Security=True" }
  $c = New-Object System.Data.SqlClient.SqlConnection($cadena)
  $c.Open()
  return $c
}

function Ejecutar-Tabla([System.Data.SqlClient.SqlConnection] $cn, [string] $sql, [int] $timeout = 120) {
  $cmd = $cn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = $timeout
  $tabla = New-Object System.Data.DataTable
  $lector = $cmd.ExecuteReader()
  $tabla.Load($lector)
  $lector.Close()
  return ,$tabla
}

function Nombre-Archivo([string] $texto) {
  $limpio = ($texto -replace "[^\w\s-]", " " -replace "\s+", "-").Trim("-")
  if ($limpio.Length -gt 50) { $limpio = $limpio.Substring(0, 50) }
  return $limpio.ToLowerInvariant()
}

function Html-Escapar([string] $s) { return [System.Net.WebUtility]::HtmlEncode($s) }

$sqlCache = @"
SELECT TOP (@Top)
  DB_NAME(pa.dbid) AS Base,
  OBJECT_NAME(st.objectid, pa.dbid) AS Objeto,
  SUBSTRING(st.text, (qs.statement_start_offset / 2) + 1,
    ((CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END - qs.statement_start_offset) / 2) + 1) AS Consulta,
  qs.execution_count AS Ejecuciones,
  qs.total_elapsed_time / 1000.0 / qs.execution_count AS DuracionPromedioMs,
  qs.total_worker_time / 1000.0 / qs.execution_count AS CpuPromedioMs,
  qs.total_logical_reads / qs.execution_count AS LecturasPromedio,
  qs.total_rows / qs.execution_count AS FilasPromedio,
  qs.total_elapsed_time / 1000.0 AS DuracionTotalMs,
  qs.max_elapsed_time / 1000.0 AS DuracionMaxMs,
  qs.last_execution_time AS UltimaEjecucion,
  qs.creation_time AS PlanDesde,
  CONVERT(varchar(20), qs.query_hash, 1) AS HashConsulta,
  qp.query_plan AS PlanXml
FROM sys.dm_exec_query_stats qs
CROSS APPLY (SELECT CONVERT(int, value) AS dbid FROM sys.dm_exec_plan_attributes(qs.plan_handle) WHERE attribute = 'dbid') pa
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
CROSS APPLY sys.dm_exec_query_plan(qs.plan_handle) qp
WHERE qs.execution_count >= @Min
  AND (@Base IS NULL OR DB_NAME(pa.dbid) = @Base)
  AND st.text NOT LIKE '%Get-PlanesLentos%'
ORDER BY {ORDEN} DESC;
"@

$sqlQueryStore = @"
SELECT TOP (@Top)
  DB_NAME() AS Base,
  OBJECT_NAME(q.object_id) AS Objeto,
  qt.query_sql_text AS Consulta,
  SUM(rs.count_executions) AS Ejecuciones,
  SUM(rs.avg_duration * rs.count_executions) / SUM(rs.count_executions) / 1000.0 AS DuracionPromedioMs,
  SUM(rs.avg_cpu_time * rs.count_executions) / SUM(rs.count_executions) / 1000.0 AS CpuPromedioMs,
  SUM(rs.avg_logical_io_reads * rs.count_executions) / SUM(rs.count_executions) AS LecturasPromedio,
  SUM(rs.avg_rowcount * rs.count_executions) / SUM(rs.count_executions) AS FilasPromedio,
  SUM(rs.avg_duration * rs.count_executions) / 1000.0 AS DuracionTotalMs,
  MAX(rs.max_duration) / 1000.0 AS DuracionMaxMs,
  MAX(rs.last_execution_time) AS UltimaEjecucion,
  MIN(p.initial_compile_start_time) AS PlanDesde,
  CONVERT(varchar(20), q.query_hash, 1) AS HashConsulta,
  MAX(CONVERT(nvarchar(max), p.query_plan)) AS PlanXml,
  p.plan_id AS PlanId
FROM sys.query_store_query q
JOIN sys.query_store_query_text qt ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan p ON p.query_id = q.query_id
JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
WHERE qt.query_sql_text NOT LIKE '%query_store_runtime_stats%'
GROUP BY q.query_hash, qt.query_sql_text, q.object_id, p.plan_id
HAVING SUM(rs.count_executions) >= @Min
ORDER BY {ORDEN} DESC;
"@

$ordenes = @{ duracion = "DuracionPromedioMs"; cpu = "CpuPromedioMs"; lecturas = "LecturasPromedio"; total = "DuracionTotalMs"; ejecuciones = "Ejecuciones" }
$ordenesCache = @{ duracion = "qs.total_elapsed_time / qs.execution_count"; cpu = "qs.total_worker_time / qs.execution_count"; lecturas = "qs.total_logical_reads / qs.execution_count"; total = "qs.total_elapsed_time"; ejecuciones = "qs.execution_count" }
$ordenesQS = @{ duracion = "SUM(rs.avg_duration * rs.count_executions) / SUM(rs.count_executions)"; cpu = "SUM(rs.avg_cpu_time * rs.count_executions) / SUM(rs.count_executions)"; lecturas = "SUM(rs.avg_logical_io_reads * rs.count_executions) / SUM(rs.count_executions)"; total = "SUM(rs.avg_duration * rs.count_executions)"; ejecuciones = "SUM(rs.count_executions)" }

if (($QueryStore -or $Consulta) -and -not $Base) { throw "Con -QueryStore o -Consulta hace falta -Base." }
if (-not $Carpeta) { $Carpeta = Join-Path (Get-Location) ("planes-" + (Get-Date -Format "yyyyMMdd-HHmm")) }
New-Item -ItemType Directory -Force -Path $Carpeta | Out-Null

$cn = Nueva-Conexion
try {
  $filas = @()
  $modo = ""
  if ($Consulta) {
    $modo = "Plan real de una consulta"
    Write-Host "Ejecutando la consulta con SET STATISTICS XML ON en $Servidor/$Base ..."
    $cmd = $cn.CreateCommand(); $cmd.CommandText = "SET STATISTICS XML ON"; [void] $cmd.ExecuteNonQuery()
    $cmd = $cn.CreateCommand(); $cmd.CommandText = $Consulta; $cmd.CommandTimeout = 600
    $reloj = [System.Diagnostics.Stopwatch]::StartNew()
    $lector = $cmd.ExecuteReader()
    $plan = $null; $filasResultado = 0
    do {
      $esPlan = $false
      for ($i = 0; $i -lt $lector.FieldCount; $i++) { if ($lector.GetName($i) -eq "Microsoft SQL Server 2005 XML Showplan") { $esPlan = $true } }
      while ($lector.Read()) { if ($esPlan) { $plan = $lector.GetString(0) } else { $filasResultado++ } }
    } while ($lector.NextResult())
    $lector.Close()
    $reloj.Stop()
    $cmd = $cn.CreateCommand(); $cmd.CommandText = "SET STATISTICS XML OFF"; [void] $cmd.ExecuteNonQuery()
    if (-not $plan) { throw "La consulta corrió pero no devolvió un plan. ¿Era un SET o un USE?" }
    $filas += [pscustomobject]@{ Base = $Base; Objeto = ""; Consulta = $Consulta; Ejecuciones = 1; DuracionPromedioMs = [math]::Round($reloj.Elapsed.TotalMilliseconds, 1); CpuPromedioMs = $null; LecturasPromedio = $null; FilasPromedio = $filasResultado; DuracionTotalMs = $null; DuracionMaxMs = $null; UltimaEjecucion = Get-Date; PlanDesde = $null; HashConsulta = ""; PlanXml = $plan }
  } else {
    $modo = if ($QueryStore) { "Query Store de $Base" } else { "Caché de planes" + $(if ($Base) { " de $Base" } else { "" }) }
    Write-Host "Leyendo $modo en $Servidor (top $Top por $OrdenarPor, mínimo $MinimoEjecuciones ejecuciones) ..."
    $sql = if ($QueryStore) { $sqlQueryStore.Replace("{ORDEN}", $ordenesQS[$OrdenarPor]) } else { $sqlCache.Replace("{ORDEN}", $ordenesCache[$OrdenarPor]) }
    $cmd = $cn.CreateCommand(); $cmd.CommandText = $sql; $cmd.CommandTimeout = 120
    [void] $cmd.Parameters.AddWithValue("@Top", $Top)
    [void] $cmd.Parameters.AddWithValue("@Min", $MinimoEjecuciones)
    if (-not $QueryStore) { $pBase = $cmd.Parameters.Add("@Base", [System.Data.SqlDbType]::NVarChar, 128); $pBase.Value = $(if ($Base) { $Base } else { [DBNull]::Value }) }
    $tabla = New-Object System.Data.DataTable
    $lector = $cmd.ExecuteReader(); $tabla.Load($lector); $lector.Close()
    foreach ($r in $tabla.Rows) {
      $o = [ordered]@{}
      foreach ($col in $tabla.Columns) { $v = $r[$col.ColumnName]; if ($v -is [DBNull]) { $v = $null }; $o[$col.ColumnName] = $v }
      $filas += [pscustomobject] $o
    }
  }

  if (-not $filas.Count) { Write-Warning "No se encontró ninguna consulta. ¿La caché está vacía (reinicio reciente) o Query Store está apagado?"; return }

  $resumen = @()
  $n = 0
  foreach ($f in $filas) {
    $n++
    $nombre = "{0:00}-{1}.sqlplan" -f $n, (Nombre-Archivo ($f.Consulta -replace "^\s*\(@\w+[^)]*\)\s*", ""))
    $ruta = Join-Path $Carpeta $nombre
    [System.IO.File]::WriteAllText($ruta, [string] $f.PlanXml, (New-Object System.Text.UTF8Encoding $false))
    $resumen += [pscustomobject]@{
      N = $n; Archivo = $nombre; Base = $f.Base; Objeto = $f.Objeto; Ejecuciones = $f.Ejecuciones
      DuracionPromedioMs = $(if ($null -ne $f.DuracionPromedioMs) { [math]::Round([double] $f.DuracionPromedioMs, 1) } else { $null })
      CpuPromedioMs = $(if ($null -ne $f.CpuPromedioMs) { [math]::Round([double] $f.CpuPromedioMs, 1) } else { $null })
      LecturasPromedio = $(if ($null -ne $f.LecturasPromedio) { [long] $f.LecturasPromedio } else { $null })
      FilasPromedio = $(if ($null -ne $f.FilasPromedio) { [long] $f.FilasPromedio } else { $null })
      DuracionTotalMs = $(if ($null -ne $f.DuracionTotalMs) { [math]::Round([double] $f.DuracionTotalMs, 0) } else { $null })
      UltimaEjecucion = $f.UltimaEjecucion; HashConsulta = $f.HashConsulta
      Consulta = ([string] $f.Consulta -replace "\s+", " ").Trim()
    }
  }

  $resumen | Export-Csv -Path (Join-Path $Carpeta "resumen.csv") -NoTypeInformation -Encoding UTF8 -Delimiter ";"

  $filasHtml = $resumen | ForEach-Object {
    $c = $_
    "<tr><td>{0}</td><td><a href=""{1}"">{1}</a></td><td>{2}</td><td class=num>{3}</td><td class=num>{4}</td><td class=num>{5}</td><td class=num>{6}</td><td class=num>{7}</td><td><code>{8}</code></td></tr>" -f $c.N, (Html-Escapar $c.Archivo), (Html-Escapar ("$($c.Base) $($c.Objeto)".Trim())), $c.Ejecuciones, $c.DuracionPromedioMs, $c.CpuPromedioMs, $c.LecturasPromedio, $c.FilasPromedio, (Html-Escapar $c.Consulta)
  }
  $esReal = [bool] $Consulta
  $html = @"
<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Planes lentos: $(Html-Escapar $Servidor)</title>
<style>body{font-family:system-ui,sans-serif;margin:20px;color:#1d1d1f;background:#f6f5f1}table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}th,td{border-bottom:1px solid #e4e2dc;padding:6px 8px;text-align:left;vertical-align:top}th{color:#6b6b70;font-weight:500}td.num{text-align:right;white-space:nowrap}code{font-size:12px;white-space:pre-wrap;word-break:break-word}p{max-width:900px}a{color:#0f6e8c}</style></head><body>
<h1>Planes lentos</h1>
<p><b>$(Html-Escapar $modo)</b> en <b>$(Html-Escapar $Servidor)</b>, $(Get-Date -Format "yyyy-MM-dd HH:mm"). $(if ($esReal) { "Plan <b>real</b>, con filas y lecturas de verdad." } else { "Ordenado por <b>$OrdenarPor</b>. Los planes de la caché y de Query Store son <b>estimados</b>: no traen filas reales. Para el plan real de una consulta: <code>.\Get-PlanesLentos.ps1 -Servidor ... -Base ... -Consulta ""SELECT ...""</code>." })</p>
<p>Para entender cada plan, abrí <a href="$PLAN_EN_CRIOLLO">Plan en criollo</a> y arrastrá el archivo .sqlplan. Los archivos .sqlplan también se abren con SSMS (doble clic).</p>
<table><thead><tr><th>#</th><th>Archivo</th><th>Base / objeto</th><th class=num>Ejec.</th><th class=num>Duración prom. (ms)</th><th class=num>CPU prom. (ms)</th><th class=num>Lecturas prom.</th><th class=num>Filas prom.</th><th>Consulta</th></tr></thead><tbody>
$($filasHtml -join "`n")
</tbody></table></body></html>
"@
  [System.IO.File]::WriteAllText((Join-Path $Carpeta "resumen.html"), $html, (New-Object System.Text.UTF8Encoding $true))

  Write-Host ""
  $resumen | Select-Object N, Ejecuciones, DuracionPromedioMs, CpuPromedioMs, LecturasPromedio, Archivo | Format-Table -AutoSize | Out-String -Width 200 | ForEach-Object { Write-Host $_ }
  Write-Host "Guardado en $Carpeta ($($resumen.Count) planes, resumen.csv y resumen.html)."
  Write-Host "Para leerlos en castellano: $PLAN_EN_CRIOLLO"
  if ($Abrir) { Start-Process (Join-Path $Carpeta "resumen.html") }
} finally {
  $cn.Close()
}
