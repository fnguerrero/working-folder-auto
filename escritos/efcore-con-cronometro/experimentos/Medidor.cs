using System.Diagnostics;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Experimentos;

public record Resultado(string Capitulo, string Variante, double MedianaMs, double PrimeraMs, double MinMs, double MaxMs,
    long ViajesAlServidor, long LecturasLogicas, long FilasRecibidas, long BytesRecibidos, long BytesAsignados, List<string> Sql, string? Nota);

/// <summary>Corre una acción varias veces y mide: tiempo (mediana), viajes al servidor y bytes recibidos
/// (estadísticas de SqlConnection), lecturas lógicas (sys.dm_exec_sessions), memoria asignada en .NET y el SQL que salió.</summary>
public class Medidor
{
    public readonly SqlConnection Conexion;
    public readonly Captura Captura = new();
    public readonly List<Resultado> Resultados = new();
    public int Repeticiones = 5;
    public bool LazyLoading;
    public int? CompatibilityLevel;
    long calibracionLecturas;

    public Medidor(string cs)
    {
        Conexion = new SqlConnection(cs);
        Conexion.Open();
        Conexion.StatisticsEnabled = true;
        // Lo que cuesta preguntar las lecturas de la sesión, para descontarlo.
        var a = Lecturas(); var b = Lecturas();
        calibracionLecturas = b - a;
    }

    public DbContextOptions Opciones() => Configurar(new DbContextOptionsBuilder()).Options;
    public DbContextOptions<T> OpcionesDe<T>() where T : DbContext => ((DbContextOptionsBuilder<T>)Configurar(new DbContextOptionsBuilder<T>())).Options;
    DbContextOptionsBuilder Configurar(DbContextOptionsBuilder b)
    {
        b.UseSqlServer(Conexion, o => { if (CompatibilityLevel is int n) o.UseCompatibilityLevel(n); }).AddInterceptors(Captura);
        if (LazyLoading) b.UseLazyLoadingProxies();
        return b;
    }
    public TiendaContext Contexto(bool tracking = true) { var c = new TiendaContext(Opciones()); if (!tracking) c.ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking; return c; }

    long Lecturas()
    {
        using var cmd = new SqlCommand("SELECT logical_reads FROM sys.dm_exec_sessions WHERE session_id = @@SPID", Conexion);
        return (long)cmd.ExecuteScalar();
    }

    public Resultado Medir(string capitulo, string variante, Func<object?> accion, string? nota = null, int? repeticiones = null, Action? antesDeCada = null)
        => MedirAsync(capitulo, variante, () => Task.FromResult(accion()), nota, repeticiones, antesDeCada).GetAwaiter().GetResult();

    public async Task<Resultado> MedirAsync(string capitulo, string variante, Func<Task<object?>> accion, string? nota = null, int? repeticiones = null, Action? antesDeCada = null)
    {
        int rep = repeticiones ?? Repeticiones;
        var tiempos = new List<double>(); var viajes = new List<long>(); var lecturas = new List<long>(); var filas = new List<long>(); var bytes = new List<long>(); var memoria = new List<long>();
        List<string> sql = new();
        double primera = 0;
        for (int i = 0; i <= rep; i++)   // la 0 es de calentamiento (compilación de la consulta, JIT), se anota como «primera»
        {
            antesDeCada?.Invoke();
            Captura.Reset();
            Conexion.ResetStatistics();
            GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
            long l0 = Lecturas();
            long m0 = GC.GetTotalAllocatedBytes(true);
            var sw = Stopwatch.StartNew();
            var r = await accion();
            sw.Stop();
            long m1 = GC.GetTotalAllocatedBytes(true);
            long l1 = Lecturas();
            var est = Conexion.RetrieveStatistics();
            if (i == 0) { primera = sw.Elapsed.TotalMilliseconds; sql = new List<string>(Captura.Sql); continue; }
            tiempos.Add(sw.Elapsed.TotalMilliseconds);
            viajes.Add((long)est["ServerRoundtrips"]! - 2);   // las dos consultas a la DMV
            lecturas.Add(Math.Max(0, l1 - l0 - calibracionLecturas));
            filas.Add((long)est["SelectRows"]! - 2);
            bytes.Add((long)est["BytesReceived"]!);
            memoria.Add(m1 - m0);
            GC.KeepAlive(r);
        }
        var res = new Resultado(capitulo, variante, Mediana(tiempos), primera, tiempos.Min(), tiempos.Max(), Mediana(viajes), Mediana(lecturas), Mediana(filas), Mediana(bytes), Mediana(memoria), sql, nota);
        Resultados.Add(res);
        Console.WriteLine($"{capitulo,-12} {variante,-48} {res.MedianaMs,9:0.0} ms  viajes {res.ViajesAlServidor,6}  lecturas {res.LecturasLogicas,9}  filas {res.FilasRecibidas,8}  {res.BytesRecibidos / 1024,8} KB  {res.BytesAsignados / 1024,8} KB asignados");
        return res;
    }

    static double Mediana(List<double> v) { var s = v.OrderBy(x => x).ToList(); return s.Count % 2 == 1 ? s[s.Count / 2] : (s[s.Count / 2 - 1] + s[s.Count / 2]) / 2; }
    static long Mediana(List<long> v) { var s = v.OrderBy(x => x).ToList(); return s.Count % 2 == 1 ? s[s.Count / 2] : (s[s.Count / 2 - 1] + s[s.Count / 2]) / 2; }
}
