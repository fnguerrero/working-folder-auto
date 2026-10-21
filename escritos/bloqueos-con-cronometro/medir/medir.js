/* Corre los experimentos de «Bloqueos con el cronómetro en la mano» contra un SQL Server real y deja
   ../resultados.json. Cada experimento abre dos o más sesiones (conexiones) y las coreografía desde acá.
   Hace falta Node 18+, `npm i mssql` en esta carpeta y un SQL Server (2019 o 2022) con la clave de sa en
   MSSQL_SA_PASSWORD. Con Docker:
     docker run -d --name sql -p 1433:1433 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=<una clave> -e MSSQL_PID=Developer mcr.microsoft.com/mssql/server:2022-latest
     MSSQL_SA_PASSWORD=<la misma> node medir.js
   Crea la base «Bloqueos» desde cero (setup.sql) y la deja. Tarda unos minutos. */
"use strict";
const sql = require("mssql");
const fs = require("node:fs");
const path = require("node:path");

const CLAVE = process.env.MSSQL_SA_PASSWORD;
if (!CLAVE) { console.error("Falta MSSQL_SA_PASSWORD"); process.exit(2); }
const base = { server: process.env.MSSQL_HOST || "localhost", port: Number(process.env.MSSQL_PORT || 1433), user: "sa", password: CLAVE, options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }, requestTimeout: 120000, pool: { max: 80, min: 0, idleTimeoutMillis: 60000 } };
const ISO = sql.ISOLATION_LEVEL;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const R = { servidor: "", fecha: new Date().toISOString(), experimentos: {} };
let pool, vigia;

/* ---------- utilidades ---------- */
const q = async (texto, en) => (await new sql.Request(en || pool).batch(texto)).recordset;
const q1 = async (texto, en) => (await q(texto, en))[0];
const ms = (t0) => Math.round(performance.now() - t0);
async function medir(fn) { const t0 = performance.now(); let error = null, resultado = null; try { resultado = await fn(); } catch (e) { error = e; } return { ms: ms(t0), error, resultado }; }
const errorCorto = (e) => (e ? { numero: e.number || e.code || null, mensaje: String(e.message || e).slice(0, 160) } : null);
// Una sesión = una transacción de mssql (queda pegada a una conexión). Devuelve helpers.
async function sesion(nivel, enPool) {
  const tx = new sql.Transaction(enPool || pool); await tx.begin(nivel === undefined ? ISO.READ_COMMITTED : nivel);
  const spid = (await q1("SELECT @@SPID AS spid", tx)).spid;
  return { tx, spid, q: (t) => q(t, tx), q1: (t) => q1(t, tx), commit: () => tx.commit(), rollback: async () => { try { await tx.rollback(); } catch (e) { /* ya abortada */ } } };
}
// Lo que ve el servidor de una sesión: qué espera y quién la bloquea (desde la conexión vigía).
// Un pool descartable para los experimentos que cambian el nivel de aislamiento o SET de sesión: esas opciones
// quedan pegadas a la conexión y volverían a aparecer en cualquier otro experimento que la reuse.
async function conPoolAparte(fn, extra) { const p = await new sql.ConnectionPool({ ...base, database: "Bloqueos", ...(extra || {}) }).connect(); try { return await fn(p); } finally { await p.close(); } }
async function estadoDe(spid) {
  return q1(`SELECT r.status, r.wait_type, r.wait_time, r.blocking_session_id, r.wait_resource, r.last_wait_type FROM sys.dm_exec_requests r WHERE r.session_id = ${spid}`, vigia) || null;
}
async function bloqueosDe(spid) {
  return q(`SELECT resource_type AS tipo, request_mode AS modo, request_status AS estado, COUNT(*) AS n FROM sys.dm_tran_locks WHERE request_session_id = ${spid} AND resource_type <> 'DATABASE' GROUP BY resource_type, request_mode, request_status ORDER BY resource_type, request_mode`, vigia);
}
async function conRcsi(activar) { await q(`ALTER DATABASE Bloqueos SET READ_COMMITTED_SNAPSHOT ${activar ? "ON" : "OFF"} WITH ROLLBACK IMMEDIATE`, vigia); }
async function conSnapshot(activar) { await q(`ALTER DATABASE Bloqueos SET ALLOW_SNAPSHOT_ISOLATION ${activar ? "ON" : "OFF"}`, vigia); }
async function ultimoDeadlock() {
  const r = await q1(`SELECT TOP (1) CONVERT(nvarchar(max), XEvent.query('(data/value/deadlock)[1]')) AS grafo, XEvent.value('(@timestamp)[1]', 'datetime2') AS cuando
    FROM (SELECT CAST(target_data AS xml) AS TargetData FROM sys.dm_xe_session_targets st JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer') AS d
    CROSS APPLY TargetData.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS x(XEvent) ORDER BY cuando DESC`, vigia);
  return r ? r.grafo.replace(/<stackFrames>[\s\S]*?<\/stackFrames>/g, "") : null;
}
// Plan real de una consulta (lecturas lógicas y operadores), deshaciendo lo que haga.
async function planDe(texto) {
  const s = await sesion(); const r = await new sql.Request(s.tx).query(`SET STATISTICS XML ON; ${texto}; SET STATISTICS XML OFF;`); await s.rollback();
  const xml = r.recordsets.flat().map((f) => Object.values(f)[0]).find((v) => typeof v === "string" && v.includes("ShowPlanXML")) || "";
  const lecturas = [...xml.matchAll(/ActualLogicalReads="(\d+)"/g)].reduce((a, m) => a + Number(m[1]), 0);
  return { lecturas, ops: [...new Set([...xml.matchAll(/PhysicalOp="([^"]+)"/g)].map((m) => m[1]))] };
}
async function tamanoFila(tabla) { return q1(`SELECT avg_record_size_in_bytes AS bytes, page_count AS paginas FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('${tabla}'), 1, NULL, 'DETAILED') WHERE index_level = 0`, vigia); }
async function versionStore() { return q1(`SELECT SUM(reserved_space_kb) AS kb FROM sys.dm_tran_version_store_space_usage WHERE database_id = DB_ID('Bloqueos')`, vigia); }
async function reset() {
  await q(`UPDATE dbo.Productos SET Stock = 100 WHERE Stock <> 100; UPDATE dbo.Cuentas SET Saldo = 1000; DELETE dbo.Reservas; UPDATE dbo.Pedidos SET Estado = PedidoId % 4 WHERE (PedidoId <= 10000 OR PedidoId IN (50000, 50001, 150000, 150001)) AND Estado <> PedidoId % 4;`, vigia);
}

/* ---------- 1. Qué bloquea un UPDATE y a quién frena ---------- */
async function expBloqueo() {
  const s1 = await sesion(); await s1.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000");
  const locks = await bloqueosDe(s1.spid);
  // Lector de la misma fila: se traba hasta el commit.
  const s2 = await sesion(); const t2 = medir(() => s2.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000"));
  await dormir(500); const visto = await estadoDe(s2.spid);
  // Otra fila: pasa. COUNT(*) usa el índice angosto: pasa. SUM(Total) recorre el agrupado: se traba al llegar a la fila.
  const s3 = await sesion(); const otra = await medir(() => s3.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1001")); await s3.commit();
  const s4 = await sesion(); const cuenta = await medir(() => s4.q("SELECT COUNT(*) AS n FROM dbo.Pedidos")); await s4.commit();
  const s5 = await sesion(); const t5 = medir(() => s5.q("SELECT SUM(Total) AS t FROM dbo.Pedidos")); await dormir(500); const vistoSuma = await estadoDe(s5.spid);
  await dormir(1000); await s1.commit();
  const lector = await t2; await s2.commit(); const suma = await t5; await s5.commit();
  R.experimentos.bloqueo = { bloqueosDelUpdate: locks, lectorMismaFila: { ms: lector.ms, vioEstado: lector.resultado[0].Estado, mientrasEsperaba: visto }, lectorOtraFila: { ms: otra.ms }, countEstrella: { ms: cuenta.ms }, sumTotal: { ms: suma.ms, mientrasEsperaba: vistoSuma } };
  await reset();
}

/* ---------- 2. Escalada de bloqueos ---------- */
async function expEscalada() {
  const out = {};
  for (const n of [4000, 7000]) {
    const s1 = await sesion(); const upd = await medir(() => s1.q(`UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId <= ${n}`));
    const locks = await bloqueosDe(s1.spid);
    const s2 = await sesion(); const lejos = medir(() => s2.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 199000")); await dormir(400); const visto = await estadoDe(s2.spid);
    await s1.rollback(); const r = await lejos; await s2.commit();
    out[`filas${n}`] = { msUpdate: upd.ms, bloqueos: locks, lectorFilaLejana: { ms: r.ms, mientrasEsperaba: visto } };
  }
  await q("ALTER TABLE dbo.Pedidos SET (LOCK_ESCALATION = DISABLE)", vigia);
  { const s1 = await sesion(); await s1.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId <= 7000"); const locks = await bloqueosDe(s1.spid);
    const mem = await q1(`SELECT COUNT(*) AS n FROM sys.dm_tran_locks WHERE request_session_id = ${s1.spid}`, vigia);
    const s2 = await sesion(); const r = await medir(() => s2.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 199000")); await s2.commit(); await s1.rollback();
    out.filas7000SinEscalada = { bloqueos: locks, totalBloqueos: mem.n, lectorFilaLejana: { ms: r.ms } }; }
  await q("ALTER TABLE dbo.Pedidos SET (LOCK_ESCALATION = TABLE)", vigia);
  // Por tandas de 2.000: nunca escala y entre tanda y tanda los demás pasan.
  { const t0 = performance.now(); let tandas = 0; for (let desde = 1; desde <= 7000; desde += 2000) { await q(`UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId BETWEEN ${desde} AND ${desde + 1999} AND PedidoId <= 7000`, vigia); tandas++; } out.porTandas = { tandas, ms: ms(t0) }; }
  R.experimentos.escalada = out; await reset();
}

/* ---------- 3. NOLOCK: lecturas sucias y filas contadas dos veces ---------- */
async function expNolock() {
  const s1 = await sesion(); await s1.q("UPDATE dbo.Productos SET Stock = 0 WHERE ProductoId = 7");
  const sucia = await q1("SELECT Stock FROM dbo.Productos WITH (NOLOCK) WHERE ProductoId = 7", vigia);
  const limpiaBloqueada = await medir(async () => { const s = await sesion(); await s.q("SET LOCK_TIMEOUT 1500"); try { return await s.q1("SELECT Stock FROM dbo.Productos WHERE ProductoId = 7"); } finally { await s.q("SET LOCK_TIMEOUT -1"); await s.rollback(); } });
  await s1.rollback();
  const despues = await q1("SELECT Stock FROM dbo.Productos WHERE ProductoId = 7", vigia);
  // Conteo con NOLOCK mientras otra sesión mueve filas (hace crecer Observaciones y provoca divisiones de página).
  const total = (await q1("SELECT COUNT(*) AS n, SUM(Total) AS t FROM dbo.Pedidos", vigia));
  let raros = 0, corridas = 0, ejemplos = [];
  const movedor = (async () => { for (let i = 0; i < 40; i++) { await q(`UPDATE dbo.Pedidos SET Observaciones = REPLICATE(N'x', 190) WHERE PedidoId BETWEEN ${i * 5000 + 1} AND ${i * 5000 + 5000}`, pool); } })();
  while (corridas < 40) { const r = await q1("SELECT COUNT(*) AS n, SUM(Total) AS t FROM dbo.Pedidos WITH (NOLOCK)", pool); corridas++; if (r.n !== total.n || Number(r.t) !== Number(total.t)) { raros++; if (ejemplos.length < 3) ejemplos.push({ filas: r.n, total: Number(r.t) }); } }
  await movedor;
  const conLock = await q1("SELECT COUNT(*) AS n, SUM(Total) AS t FROM dbo.Pedidos", pool);
  await q("UPDATE dbo.Pedidos SET Observaciones = N'Pedido de prueba número ' + CAST(PedidoId AS nvarchar(10)) WHERE PedidoId <= 200000; ALTER INDEX PK_Pedidos ON dbo.Pedidos REBUILD;", vigia);
  R.experimentos.nolock = { stockRealAntes: 100, leidoConNolock: sucia.Stock, lecturaNormal: { ms: limpiaBloqueada.ms, error: errorCorto(limpiaBloqueada.error) }, stockDespuesDelRollback: despues.Stock, conteo: { real: { filas: total.n, total: Number(total.t) }, corridas, distintas: raros, ejemplos, alFinalConLock: { filas: conLock.n, total: Number(conLock.t) } } };
  await reset();
}

/* ---------- 4. La actualización perdida, con seis remedios ---------- */
async function expPerdida() {
  const N = 40, PROD = 42; const out = {};
  const correr = async (nombre, nivel, cuerpo) => conPoolAparte(async (p) => {
    await reset(); const errores = {}; let reintentos = 0, agotados = 0; const t0 = performance.now();
    await Promise.all(Array.from({ length: N }, async () => {
      for (let intento = 0; intento < 500; intento++) {
        if (intento === 499) agotados++;
        const s = await sesion(nivel, p);
        try { await cuerpo(s); await s.commit(); return; }
        catch (e) { await s.rollback(); const k = e.number || e.code || "otro"; errores[k] = (errores[k] || 0) + 1; if (e.number === 1205 || e.number === 3960 || e.number === 2627 || e.message === "reintentar") { reintentos++; continue; } return; }
      }
    }));
    const fin = await q1(`SELECT Stock FROM dbo.Productos WHERE ProductoId = ${PROD}`, vigia);
    out[nombre] = { esperado: 100 - N, stockFinal: fin.Stock, perdidas: fin.Stock - (100 - N), ms: ms(t0), errores, reintentos, agotados };
  });
  const leerYEscribir = async (s, hint = "") => { const r = await s.q1(`SELECT Stock FROM dbo.Productos ${hint} WHERE ProductoId = ${PROD}`); await dormir(20); await s.q(`UPDATE dbo.Productos SET Stock = ${r.Stock - 1} WHERE ProductoId = ${PROD}`); };
  await correr("readCommitted", ISO.READ_COMMITTED, (s) => leerYEscribir(s));
  await conRcsi(true); await correr("rcsi", ISO.READ_COMMITTED, (s) => leerYEscribir(s)); await conRcsi(false);
  await correr("repeatableRead", ISO.REPEATABLE_READ, (s) => leerYEscribir(s));
  await correr("updlock", ISO.READ_COMMITTED, (s) => leerYEscribir(s, "WITH (UPDLOCK)"));
  await correr("atomico", ISO.READ_COMMITTED, (s) => s.q(`UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = ${PROD}`));
  await correr("rowversion", ISO.READ_COMMITTED, async (s) => { const r = await s.q1(`SELECT Stock, Version FROM dbo.Productos WHERE ProductoId = ${PROD}`); await dormir(20); const u = await new sql.Request(s.tx).input("v", sql.VarBinary(8), r.Version).query(`UPDATE dbo.Productos SET Stock = ${r.Stock - 1} WHERE ProductoId = ${PROD} AND Version = @v; SELECT @@ROWCOUNT AS n`); if (u.recordset[0].n === 0) throw new Error("reintentar"); });
  await conSnapshot(true); await correr("snapshot", ISO.SNAPSHOT, (s) => leerYEscribir(s)); await conSnapshot(false);
  R.experimentos.perdida = { concurrentes: N, ...out };
}

/* ---------- 5. SERIALIZABLE y el «si no existe, insertar» ---------- */
async function expSerializable() {
  const out = {}; const PARES = 10;
  const correr = async (nombre, nivel, cuerpo) => conPoolAparte(async (p) => {
    await reset(); const errores = {}; let deadlocks = 0, insertadas = 0; const tiemposDeadlock = []; const t0 = performance.now();
    await Promise.all(Array.from({ length: 2 * PARES }, async (_, i) => {
      const hora = Math.floor(i / 2); const s = await sesion(nivel, p); const ti = performance.now();
      try { await cuerpo(s, hora, i % 2 ? "Bruno" : "Ana"); await s.commit(); insertadas++; }
      catch (e) { await s.rollback(); const k = e.number || e.code || "otro"; errores[k] = (errores[k] || 0) + 1; if (e.number === 1205) { deadlocks++; tiemposDeadlock.push(ms(ti)); } }
    }));
    const filas = await q1("SELECT COUNT(*) AS n, COUNT(DISTINCT CONCAT(Sala, '-', Hora)) AS distintas FROM dbo.Reservas", vigia);
    out[nombre] = { pares: PARES, commits: insertadas, filas: filas.n, horasDistintas: filas.distintas, deadlocks, msHastaElDeadlock: tiemposDeadlock.length ? { min: Math.min(...tiemposDeadlock), max: Math.max(...tiemposDeadlock) } : null, errores, ms: ms(t0) };
  });
  const checkInsert = (hint) => async (s, hora, quien) => { const e = await s.q1(`SELECT COUNT(*) AS n FROM dbo.Reservas ${hint} WHERE Sala = 1 AND Hora = ${hora}`); await dormir(50); if (e.n === 0) await s.q(`INSERT dbo.Reservas (Sala, Hora, Quien) VALUES (1, ${hora}, N'${quien}')`); };
  await correr("readCommitted", ISO.READ_COMMITTED, checkInsert(""));
  await correr("serializable", ISO.SERIALIZABLE, checkInsert(""));
  await correr("serializableUpdlock", ISO.SERIALIZABLE, checkInsert("WITH (UPDLOCK)"));
  await correr("readCommittedUpdlockHoldlock", ISO.READ_COMMITTED, checkInsert("WITH (UPDLOCK, HOLDLOCK)"));
  await q("CREATE UNIQUE INDEX UX_Reservas_Sala_Hora ON dbo.Reservas (Sala, Hora)", vigia);
  await correr("unicoYCatch", ISO.READ_COMMITTED, async (s, hora, quien) => { await dormir(50); await s.q(`INSERT dbo.Reservas (Sala, Hora, Quien) VALUES (1, ${hora}, N'${quien}')`); });
  await q("DROP INDEX UX_Reservas_Sala_Hora ON dbo.Reservas", vigia);
  R.experimentos.serializable = out;
}

/* ---------- 6. El deadlock clásico y su grafo ---------- */
async function expDeadlock() {
  await reset(); const out = {};
  const transferir = async (s, de, a, pausa) => { await s.q(`UPDATE dbo.Cuentas SET Saldo = Saldo - 10 WHERE CuentaId = ${de}`); await dormir(pausa); await s.q(`UPDATE dbo.Cuentas SET Saldo = Saldo + 10 WHERE CuentaId = ${a}`); };
  const ronda = async (nombre, prep1, prep2, ordenar) => {
    // Con prioridades, un pool aparte: SET DEADLOCK_PRIORITY queda pegado a la conexión.
    const p = prep1 ? await new sql.ConnectionPool({ ...base, database: "Bloqueos" }).connect() : null;
    const abrir = async (prep) => { const s = await sesion(undefined, p || undefined); if (prep) await s.q(prep); return s; };
    const s1 = await abrir(prep1), s2 = await abrir(prep2);
    // Cada lado transfiere y confirma apenas termina (si es la víctima, deshace). Se mide hasta el commit.
    const lado = async (s, de, a) => { try { await transferir(s, de, a, 200); await s.commit(); } catch (e) { await s.rollback(); throw e; } };
    const [a, b] = await Promise.all([medir(() => lado(s1, 1, 2)), medir(() => lado(s2, ordenar ? 1 : 2, ordenar ? 2 : 1))]);
    const victima = a.error ? "s1" : b.error ? "s2" : null;
    out[nombre] = { s1: { spid: s1.spid, ms: a.ms, error: errorCorto(a.error) }, s2: { spid: s2.spid, ms: b.ms, error: errorCorto(b.error) }, victima };
    if (p) await p.close(); await reset();
  };
  await ronda("cruzado", null, null, false); await dormir(1500); out.cruzado.grafo = await ultimoDeadlock();
  await ronda("cruzadoPrioridad", "SET DEADLOCK_PRIORITY HIGH", "SET DEADLOCK_PRIORITY LOW", false);
  await ronda("mismoOrden", null, null, true);
  const saldos = await q("SELECT CuentaId, Saldo FROM dbo.Cuentas ORDER BY CuentaId", vigia);
  R.experimentos.deadlock = { ...out, saldosAlFinal: saldos };
}

/* ---------- 7. El deadlock por falta de índice ---------- */
async function expSinIndice() {
  const out = {};
  const ronda = async (nombre) => {
    await reset(); const s1 = await sesion(), s2 = await sesion();
    await s1.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 50000"); await s2.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 150000");
    const [a, b] = await Promise.all([medir(() => s1.q("UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-150001'")), medir(() => s2.q("UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-050001'"))]);
    if (a.error) await s1.rollback(); else await s1.commit(); if (b.error) await s2.rollback(); else await s2.commit();
    // Y el caso simple: una sesión tiene una fila tomada, otra actualiza por Codigo una fila distinta.
    const s3 = await sesion(); await s3.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 50000");
    const s4 = await sesion(); await s4.q("SET LOCK_TIMEOUT 3000"); const c = await medir(() => s4.q("UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-150001'")); await s4.q("SET LOCK_TIMEOUT -1"); await s4.rollback(); await s3.rollback();
    const plan = await planDe("UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-150001'");
    out[nombre] = { plan, cruzado: { s1: { ms: a.ms, error: errorCorto(a.error) }, s2: { ms: b.ms, error: errorCorto(b.error) }, deadlock: !!(a.error || b.error) }, otraFilaPorCodigo: { ms: c.ms, error: errorCorto(c.error) } };
  };
  await ronda("sinIndice");
  await q("CREATE INDEX IX_Pedidos_Codigo ON dbo.Pedidos (Codigo)", vigia);
  await ronda("conIndice");
  await q("DROP INDEX IX_Pedidos_Codigo ON dbo.Pedidos", vigia);
  R.experimentos.sinIndice = out;
}

/* ---------- 8. Timeouts: el servidor espera para siempre, el cliente no ---------- */
async function expTimeout() {
  await reset(); const s1 = await sesion(); await s1.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000");
  const s2 = await sesion(); await s2.q("SET LOCK_TIMEOUT 2000"); const lockTimeout = await medir(() => s2.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000")); await s2.q("SET LOCK_TIMEOUT -1"); await s2.rollback();
  // CommandTimeout del cliente (como SqlCommand.CommandTimeout = 30 s, acá 3 s): el cliente cancela.
  const { cmdTimeout, despuesDelTimeout } = await conPoolAparte(async (p) => {
    const s3 = await sesion(undefined, p); const cmdTimeout = await medir(() => s3.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000"));
    await dormir(300); const despuesDelTimeout = await estadoDe(s3.spid); await s3.rollback(); return { cmdTimeout, despuesDelTimeout };
  }, { requestTimeout: 3000 });
  // Cadena: s1 bloquea a s4 (UPDATE), s4 bloquea a s5 (SELECT de la fila que s4 quiere... no: s5 espera a s4 por otra fila que s4 ya tomó).
  const s4 = await sesion(); await s4.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 2000"); const p4 = medir(() => s4.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000"));
  const s5 = await sesion(); const p5 = medir(() => s5.q("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 2000"));
  await dormir(600);
  const cadena = await q(`SELECT r.session_id AS spid, r.blocking_session_id AS bloqueadaPor, r.wait_type, r.wait_time, r.wait_resource, SUBSTRING(t.text, 1, 80) AS sqlText
    FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t WHERE r.session_id IN (${s4.spid}, ${s5.spid}) ORDER BY r.session_id`, vigia);
  const cabeza = await q1(`SELECT s.session_id AS spid, s.status, s.program_name, s.host_name, s.open_transaction_count AS transacciones, DATEDIFF(SECOND, s.last_request_end_time, SYSDATETIME()) AS segundosOciosa, SUBSTRING(c.text, 1, 80) AS ultimoSql
    FROM sys.dm_exec_sessions s JOIN sys.dm_exec_connections cn ON cn.session_id = s.session_id CROSS APPLY sys.dm_exec_sql_text(cn.most_recent_sql_handle) c WHERE s.session_id = ${s1.spid}`, vigia);
  await s1.commit(); await p4; await s4.commit(); await p5; await s5.commit();
  R.experimentos.timeout = { lockTimeout: { ms: lockTimeout.ms, error: errorCorto(lockTimeout.error) }, commandTimeout: { ms: cmdTimeout.ms, error: errorCorto(cmdTimeout.error), pedidoEnElServidorDespues: despuesDelTimeout }, cadena, cabezaDeLaCadena: cabeza };
  await reset();
}

/* ---------- 9. RCSI y SNAPSHOT: leer sin esperar ---------- */
async function expVersiones() {
  await reset(); const out = {};
  const antes = await tamanoFila("dbo.Productos");
  await conRcsi(true);
  { const s1 = await sesion(); await s1.q("UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000");
    const s2 = await sesion(); const lectura = await medir(() => s2.q1("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000")); await s2.commit();
    const s3 = await sesion(); const suma = await medir(() => s3.q1("SELECT SUM(Total) AS t FROM dbo.Pedidos")); await s3.commit();
    const s4 = await sesion(); await s4.q("SET LOCK_TIMEOUT 1500"); const escritor = await medir(() => s4.q("UPDATE dbo.Pedidos SET Estado = 7 WHERE PedidoId = 1000")); await s4.q("SET LOCK_TIMEOUT -1"); await s4.rollback();
    const vs = await versionStore(); await s1.commit();
    const s5 = await sesion(); const despues = await s5.q1("SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000"); await s5.commit();
    out.rcsi = { lectorMismaFila: { ms: lectura.ms, vioEstado: lectura.resultado.Estado }, sumTotal: { ms: suma.ms }, escritorMismaFila: { ms: escritor.ms, error: errorCorto(escritor.error) }, versionStoreKb: vs.kb, lectorDespuesDelCommit: despues.Estado }; }
  // La fila engorda 14 bytes cuando se la modifica con versionado activo.
  await q("UPDATE dbo.Productos SET Precio = Precio", vigia);
  const despuesFila = await tamanoFila("dbo.Productos");
  out.filaConVersion = { bytesAntes: antes.bytes, bytesDespues: despuesFila.bytes };
  // Cuánto ocupa el version store con 200.000 updates abiertos.
  { const s1 = await sesion(); await s1.q("SELECT TOP (1) 1 FROM dbo.Pedidos"); const t0 = performance.now(); await q("UPDATE dbo.Pedidos SET Estado = Estado", pool); const vs = await versionStore(); out.versionStore200k = { kb: vs.kb, msUpdate: ms(t0) }; await s1.commit(); }
  // SNAPSHOT: consistente durante toda la transacción, y choca al escribir.
  await conSnapshot(true);
  await conPoolAparte(async (p) => { const s1 = await sesion(ISO.SNAPSHOT, p); const primera = await s1.q1("SELECT Stock FROM dbo.Productos WHERE ProductoId = 5");
    await q("UPDATE dbo.Productos SET Stock = 90 WHERE ProductoId = 5", vigia);
    const segunda = await s1.q1("SELECT Stock FROM dbo.Productos WHERE ProductoId = 5");
    const rc = await sesion(); const enRcsi = await rc.q1("SELECT Stock FROM dbo.Productos WHERE ProductoId = 5"); await rc.commit();
    const choque = await medir(() => s1.q("UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = 5")); await s1.rollback();
    out.snapshot = { primeraLectura: primera.Stock, otraSesionDejo: 90, segundaLecturaEnSnapshot: segunda.Stock, segundaLecturaEnRcsi: enRcsi.Stock, update: { ms: choque.ms, error: errorCorto(choque.error) } }; });
  await conSnapshot(false); await conRcsi(false);
  await q("ALTER INDEX PK_Productos ON dbo.Productos REBUILD; ALTER INDEX PK_Pedidos ON dbo.Pedidos REBUILD;", vigia);
  R.experimentos.versiones = out; await reset();
}

/* ---------- 10. Cuánto dura la transacción: la fila caliente ---------- */
async function expFilaCaliente() {
  const out = {}; const W = 10, DURACION = 4000;
  for (const espera of [0, 20, 200]) {
    await reset(); let commits = 0; const esperas = []; const fin = performance.now() + DURACION;
    await Promise.all(Array.from({ length: W }, async () => {
      while (performance.now() < fin) { const s = await sesion(); const t0 = performance.now(); await s.q("UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = 1"); esperas.push(ms(t0)); await dormir(espera); await s.commit(); commits++; }
    }));
    esperas.sort((a, b) => a - b);
    out[`espera${espera}`] = { workers: W, segundos: DURACION / 1000, commits, porSegundo: Math.round(commits / (DURACION / 1000)), esperaMsMediana: esperas[Math.floor(esperas.length / 2)], esperaMsP99: esperas[Math.floor(esperas.length * 0.99)] };
  }
  // Mismo tiempo de espera pero cada worker en su propia fila: no hay cola.
  { await reset(); let commits = 0; const fin = performance.now() + DURACION;
    await Promise.all(Array.from({ length: W }, async (_, i) => { while (performance.now() < fin) { const s = await sesion(); await s.q(`UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = ${i + 1}`); await dormir(200); await s.commit(); commits++; } }));
    out.espera200FilasDistintas = { workers: W, segundos: DURACION / 1000, commits, porSegundo: Math.round(commits / (DURACION / 1000)) }; }
  R.experimentos.filaCaliente = out; await reset();
}

/* ---------- principal ---------- */
(async () => {
  const maestro = await new sql.ConnectionPool({ ...base, database: "master" }).connect();
  const setup = fs.readFileSync(path.join(__dirname, "setup.sql"), "utf8");
  for (const lote of setup.split(/^\s*GO\s*$/m)) if (lote.trim()) await maestro.request().batch(lote);
  R.servidor = (await maestro.request().query("SELECT @@VERSION AS v")).recordset[0].v.split("\n")[0].trim() + ` · ${(await maestro.request().query("SELECT cpu_count AS cpu, physical_memory_kb / 1024 / 1024 AS gb FROM sys.dm_os_sys_info")).recordset.map((r) => `${r.cpu} CPU, ${r.gb} GB`)[0]}`;
  await maestro.close();
  const solo = process.argv.slice(2);
  pool = await new sql.ConnectionPool({ ...base, database: "Bloqueos" }).connect();
  vigia = pool; // las DMV se miran desde cualquier conexión del pool
  const pasos = [["bloqueo", expBloqueo], ["escalada", expEscalada], ["nolock", expNolock], ["perdida", expPerdida], ["serializable", expSerializable], ["deadlock", expDeadlock], ["sinIndice", expSinIndice], ["timeout", expTimeout], ["versiones", expVersiones], ["filaCaliente", expFilaCaliente]];
  for (const [nombre, fn] of pasos) {
    if (solo.length && !solo.includes(nombre)) continue;
    const t0 = performance.now(); process.stdout.write(`${nombre}… `);
    try { await fn(); console.log(`${ms(t0)} ms`); } catch (e) { console.log(`FALLÓ: ${e.message}`); R.experimentos[nombre] = { error: String(e.message) }; }
  }
  const salida = path.join(__dirname, "..", "resultados.json");
  if (solo.length && fs.existsSync(salida)) { const previo = JSON.parse(fs.readFileSync(salida, "utf8")); R.experimentos = { ...previo.experimentos, ...R.experimentos }; }
  fs.writeFileSync(salida, JSON.stringify(R, null, 1));
  console.log("resultados.json listo");
  await pool.close();
})().catch((e) => { console.error(e); process.exit(1); });
