-- Experimentos de «Bloqueos con el cronómetro en la mano», para repetir a mano en SSMS con dos ventanas.
-- Base: Bloqueos (medir/setup.sql la crea). Cada bloque dice qué va en la ventana 1 y qué en la 2.
-- Las cifras del escrito salieron de medir/medir.js, que hace esta misma coreografía desde Node y las anota.
-- En cada ventana, primero: USE Bloqueos; SELECT @@SPID;   (para saber quién es quién en las DMV)

/* ====================== Mirar: quién espera a quién (ventana aparte) ====================== */
SELECT r.session_id, r.blocking_session_id, r.status, r.wait_type, r.wait_time, r.wait_resource, SUBSTRING(t.text, 1, 120) AS sql
FROM sys.dm_exec_requests r CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id > 50 AND r.session_id <> @@SPID;
-- Bloqueos de una sesión (poner el spid):
SELECT resource_type, request_mode, request_status, COUNT(*) AS n FROM sys.dm_tran_locks
WHERE request_session_id = 51 AND resource_type <> 'DATABASE' GROUP BY resource_type, request_mode, request_status;
-- La cabeza de una cadena: dormida y con transacción abierta.
SELECT s.session_id, s.status, s.program_name, s.host_name, s.open_transaction_count, s.last_request_end_time, SUBSTRING(c.text, 1, 120) AS ultimo_sql
FROM sys.dm_exec_sessions s JOIN sys.dm_exec_connections cn ON cn.session_id = s.session_id
CROSS APPLY sys.dm_exec_sql_text(cn.most_recent_sql_handle) c
WHERE s.open_transaction_count > 0 AND s.status = 'sleeping';
GO

/* ====================== 1. Qué toma un UPDATE y a quién frena ====================== */
-- Ventana 1
BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000;   -- sin COMMIT
-- Ventana 2 (cada uno por separado; los dos primeros esperan hasta el COMMIT de la 1)
SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000;
SELECT SUM(Total) FROM dbo.Pedidos;
SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1001;    -- pasa
SELECT COUNT(*) FROM dbo.Pedidos;                        -- pasa (cuenta por IX_Pedidos_ClienteId)
-- Ventana 1
COMMIT;
GO

/* ====================== 2. Escalada ====================== */
-- Ventana 1 (probar con 4000 y con 7000)
BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId <= 7000;
-- Ventana 2: con 4000 pasa; con 7000 espera (la tabla entera está en X)
SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 199000;
-- Ventana 1
ROLLBACK;
-- Sin escalada (parche) y por tandas (solución)
ALTER TABLE dbo.Pedidos SET (LOCK_ESCALATION = DISABLE);
ALTER TABLE dbo.Pedidos SET (LOCK_ESCALATION = TABLE);
UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId BETWEEN 1 AND 2000;      -- y así, de a 2.000, con commit entre medio
GO

/* ====================== 3. NOLOCK ====================== */
-- Ventana 1
BEGIN TRAN; UPDATE dbo.Productos SET Stock = 0 WHERE ProductoId = 7;
-- Ventana 2
SELECT Stock FROM dbo.Productos WITH (NOLOCK) WHERE ProductoId = 7;   -- 0, un valor que nunca existió
SET LOCK_TIMEOUT 1500; SELECT Stock FROM dbo.Productos WHERE ProductoId = 7;   -- error 1222
SET LOCK_TIMEOUT -1;
-- Ventana 1
ROLLBACK;
-- Filas contadas de menos o de más: ventana 1 agranda filas por tandas (hay divisiones de página)…
UPDATE dbo.Pedidos SET Observaciones = REPLICATE(N'x', 190) WHERE PedidoId BETWEEN 1 AND 5000;      -- repetir con otros rangos
-- …y la ventana 2 cuenta con NOLOCK varias veces: el total cambia. Sin NOLOCK, no.
SELECT COUNT(*), SUM(Total) FROM dbo.Pedidos WITH (NOLOCK);
SELECT COUNT(*), SUM(Total) FROM dbo.Pedidos;
GO

/* ====================== 4. La actualización perdida ====================== */
-- En las dos ventanas, a la vez (ejecutar la lectura en ambas y recién después el UPDATE en ambas):
BEGIN TRAN;
DECLARE @stock int = (SELECT Stock FROM dbo.Productos WHERE ProductoId = 42);
-- …
UPDATE dbo.Productos SET Stock = @stock - 1 WHERE ProductoId = 42;
COMMIT;
-- Resultado: 99 en vez de 98. Lo mismo con RCSI prendido.
-- Remedios:
UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = 42;                             -- atómico
SELECT Stock FROM dbo.Productos WITH (UPDLOCK) WHERE ProductoId = 42;                          -- la segunda ventana espera acá
UPDATE dbo.Productos SET Stock = @stock - 1 WHERE ProductoId = 42 AND Version = @version;      -- optimista: si @@ROWCOUNT = 0, releer
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;   -- correcto pero a deadlocks (1205)
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;          -- con ALLOW_SNAPSHOT_ISOLATION ON: error 3960 en la segunda
GO

/* ====================== 5. SERIALIZABLE y el «si no existe, insertar» ====================== */
-- En las dos ventanas, a la vez (primero el IF en ambas, después el INSERT): deadlock en SERIALIZABLE, duplicado en READ COMMITTED.
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;   -- lo que hace new TransactionScope() sin opciones
BEGIN TRAN;
IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WHERE Sala = 1 AND Hora = 10)
    INSERT dbo.Reservas (Sala, Hora, Quien) VALUES (1, 10, N'Ana');
COMMIT;
-- Remedio 1: la lectura con UPDLOCK, HOLDLOCK (no hace falta cambiar el nivel)
IF NOT EXISTS (SELECT 1 FROM dbo.Reservas WITH (UPDLOCK, HOLDLOCK) WHERE Sala = 1 AND Hora = 10) INSERT dbo.Reservas (Sala, Hora, Quien) VALUES (1, 10, N'Ana');
-- Remedio 2 (mejor): índice único y atrapar 2601/2627
CREATE UNIQUE INDEX UX_Reservas_Sala_Hora ON dbo.Reservas (Sala, Hora);
INSERT dbo.Reservas (Sala, Hora, Quien) VALUES (1, 10, N'Ana');
GO

/* ====================== 6. El deadlock clásico ====================== */
-- Ventana 1                                                              -- Ventana 2
BEGIN TRAN; UPDATE dbo.Cuentas SET Saldo = Saldo - 10 WHERE CuentaId = 1;   -- BEGIN TRAN; UPDATE dbo.Cuentas SET Saldo = Saldo - 10 WHERE CuentaId = 2;
UPDATE dbo.Cuentas SET Saldo = Saldo + 10 WHERE CuentaId = 2;               -- UPDATE dbo.Cuentas SET Saldo = Saldo + 10 WHERE CuentaId = 1;   → una muere con 1205
COMMIT;
-- Prioridad: SET DEADLOCK_PRIORITY LOW; en la que puede reintentar.
-- El grafo del último deadlock, desde system_health:
SELECT XEvent.query('(data/value/deadlock)[1]') AS grafo, XEvent.value('(@timestamp)[1]', 'datetime2') AS cuando
FROM (SELECT CAST(target_data AS xml) AS TargetData FROM sys.dm_xe_session_targets st JOIN sys.dm_xe_sessions s ON s.address = st.event_session_address
      WHERE s.name = 'system_health' AND st.target_name = 'ring_buffer') AS d
CROSS APPLY TargetData.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') AS x(XEvent)
ORDER BY cuando DESC;
GO

/* ====================== 7. El deadlock que arregla un índice ====================== */
-- Ventana 1                                                                -- Ventana 2
BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 50000;         -- BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 150000;
UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-150001';               -- UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-050001';   → 1205
-- Con el índice no se ven:
CREATE INDEX IX_Pedidos_Codigo ON dbo.Pedidos (Codigo);
-- Plan del UPDATE por Codigo (scan de 2.930 lecturas sin índice; seek de 6 con él):
SET STATISTICS XML ON; BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 8 WHERE Codigo = N'PED-150001'; ROLLBACK; SET STATISTICS XML OFF;
GO

/* ====================== 8. Timeouts ====================== */
-- Ventana 1
BEGIN TRAN; UPDATE dbo.Pedidos SET Estado = 9 WHERE PedidoId = 1000;
-- Ventana 2
SET LOCK_TIMEOUT 2000; SELECT Estado FROM dbo.Pedidos WHERE PedidoId = 1000;   -- 1222 a los 2 s; la transacción sigue viva
SET LOCK_TIMEOUT -1;
-- Desde .NET, el CommandTimeout (30 s) corta del lado del cliente con «Execution Timeout Expired» (SqlException.Number = -2).
-- La cadena: ventana 3 toma la 2000 y pide la 1000; ventana 4 lee la 2000. Ver «Mirar» arriba: la 1 no aparece en requests, está sleeping en sessions.
GO

/* ====================== 9. RCSI y SNAPSHOT ====================== */
ALTER DATABASE Bloqueos SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
-- Repetir el experimento 1: los lectores pasan al instante y leen la versión anterior; el otro escritor sigue esperando.
SELECT SUM(reserved_space_kb) AS version_store_kb FROM sys.dm_tran_version_store_space_usage WHERE database_id = DB_ID('Bloqueos');
SELECT avg_record_size_in_bytes FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.Productos'), 1, NULL, 'DETAILED') WHERE index_level = 0;   -- +14 bytes por fila modificada
ALTER DATABASE Bloqueos SET ALLOW_SNAPSHOT_ISOLATION ON;
-- Ventana 1
SET TRANSACTION ISOLATION LEVEL SNAPSHOT; BEGIN TRAN; SELECT Stock FROM dbo.Productos WHERE ProductoId = 5;   -- 100
-- Ventana 2
UPDATE dbo.Productos SET Stock = 90 WHERE ProductoId = 5;
-- Ventana 1
SELECT Stock FROM dbo.Productos WHERE ProductoId = 5;                     -- sigue 100
UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = 5;          -- error 3960
ROLLBACK;
GO

/* ====================== 10. La fila caliente ====================== */
-- Diez sesiones en loop (lo hace medir.js): BEGIN TRAN; UPDATE dbo.Productos SET Stock = Stock - 1 WHERE ProductoId = 1; WAITFOR DELAY '00:00:00.200'; COMMIT;
-- Con 200 ms adentro de la transacción: 7 commits por segundo entre todas y casi 2 s de espera cada una.
GO
