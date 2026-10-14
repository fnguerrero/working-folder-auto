-- Experimentos de «Índices con el cronómetro en la mano».
-- Base: Tienda (ver setup.sql al pie). Cada consulta se corrió con SET STATISTICS XML ON y se tomaron
-- las lecturas lógicas, el tiempo y el plan real. Las consultas marcadas «medir» se corrieron dos veces
-- y se anotó la segunda (caché caliente). SQL Server 2022 Developer (16.0.4305) en Linux, 4 CPU.

/* ====================== 1. La página y el cronómetro ====================== */
-- scan1 (medir)
SELECT SUM(Total) AS Total FROM dbo.Pedidos
GO
-- count (medir)
SELECT COUNT(*) AS N FROM dbo.Pedidos
GO
-- fisico (consultar)
SELECT index_id, index_level, page_count, record_count, avg_record_size_in_bytes, avg_page_space_used_in_percent FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.Pedidos'), 1, NULL, 'DETAILED') ORDER BY index_level
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO

/* ====================== 2. Heap o índice agrupado ====================== */
-- preparar
IF OBJECT_ID('dbo.PedidosHeap') IS NOT NULL DROP TABLE dbo.PedidosHeap; SELECT * INTO dbo.PedidosHeap FROM dbo.Pedidos;
GO
-- heapPk (medir)
SELECT PedidoId, Total FROM dbo.PedidosHeap WHERE PedidoId = 123456
GO
-- clusterPk (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE PedidoId = 123456
GO
-- idxHeap
CREATE INDEX IX_PedidosHeap_ClienteId ON dbo.PedidosHeap (ClienteId)
GO
-- heapRid (medir)
SELECT PedidoId, Fecha, Total FROM dbo.PedidosHeap WHERE ClienteId = 4242
GO
-- clusterKey (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.PedidosHeap') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- limpiar
DROP TABLE dbo.PedidosHeap
GO

/* ====================== 3. La clave agrupada viaja en todos los índices ====================== */
-- preparar
IF OBJECT_ID('dbo.PedidosCodigo') IS NOT NULL DROP TABLE dbo.PedidosCodigo;
CREATE TABLE dbo.PedidosCodigo (Codigo nvarchar(60) NOT NULL CONSTRAINT PK_PedidosCodigo PRIMARY KEY CLUSTERED, ClienteId int NOT NULL, Fecha datetime2(0) NOT NULL, Estado tinyint NOT NULL, Total decimal(12,2) NOT NULL, Observaciones nvarchar(400) NULL);
INSERT dbo.PedidosCodigo (Codigo, ClienteId, Fecha, Estado, Total, Observaciones) SELECT N'PED-' + CONVERT(nvarchar(8), Fecha, 112) + N'-' + RIGHT(N'0000000' + CAST(PedidoId AS nvarchar(10)), 7) + N'-' + CAST(ClienteId AS nvarchar(10)), ClienteId, Fecha, Estado, Total, Observaciones FROM dbo.Pedidos;
CREATE INDEX IX_PedidosCodigo_ClienteId ON dbo.PedidosCodigo (ClienteId);
GO
-- tamanosInt (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- tamanosCodigo (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.PedidosCodigo') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- lookupCodigo (medir)
SELECT Codigo, Fecha, Total FROM dbo.PedidosCodigo WHERE ClienteId = 4242
GO
-- lookupInt (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- limpiar
DROP TABLE dbo.PedidosCodigo
GO

/* ====================== 4. Selectividad y el punto de inflexión ====================== */
-- preparar
CREATE INDEX IX_Pedidos_Estado ON dbo.Pedidos (Estado)
GO
-- dist (consultar)
SELECT Estado, COUNT(*) AS Filas, CAST(100.0 * COUNT(*) / 400000 AS decimal(5,2)) AS Porcentaje FROM dbo.Pedidos GROUP BY Estado ORDER BY Estado
GO
-- e3 (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE Estado = 3
GO
-- e3seek (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WITH (FORCESEEK) WHERE Estado = 3
GO
-- e3scan (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WITH (FORCESCAN) WHERE Estado = 3
GO
-- e1 (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE Estado = 1
GO
-- e1seek (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WITH (FORCESEEK) WHERE Estado = 1
GO
-- c4242 (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- c4242scan (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WITH (FORCESCAN) WHERE ClienteId = 4242
GO
-- limpiar
DROP INDEX IX_Pedidos_Estado ON dbo.Pedidos
GO

/* ====================== 5. El índice cubriente ====================== */
-- lookup (medir)
SELECT PedidoId, Fecha, Estado, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- lookup1 (medir)
SELECT PedidoId, Fecha, Estado, Total FROM dbo.Pedidos WITH (FORCESEEK) WHERE ClienteId = 1
GO
-- lookup1libre (medir)
SELECT PedidoId, Fecha, Estado, Total FROM dbo.Pedidos WHERE ClienteId = 1
GO
-- crear
CREATE INDEX IX_Pedidos_ClienteId_Cub ON dbo.Pedidos (ClienteId) INCLUDE (Fecha, Estado, Total)
GO
-- cub (medir)
SELECT PedidoId, Fecha, Estado, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- cub1 (medir)
SELECT PedidoId, Fecha, Estado, Total FROM dbo.Pedidos WHERE ClienteId = 1
GO
-- cubStar (medir)
SELECT * FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- limpiar
DROP INDEX IX_Pedidos_ClienteId_Cub ON dbo.Pedidos
GO

/* ====================== 6. El orden de las columnas ====================== */
-- preparar
CREATE INDEX IX_EF ON dbo.Pedidos (Estado, Fecha) INCLUDE (ClienteId, Total)
GO
-- preparar
CREATE INDEX IX_FE ON dbo.Pedidos (Fecha, Estado) INCLUDE (ClienteId, Total)
GO
-- libre (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WHERE Estado = 3 AND Fecha >= '2026-06-01'
GO
-- ef (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_EF)) WHERE Estado = 3 AND Fecha >= '2026-06-01'
GO
-- fe (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_FE)) WHERE Estado = 3 AND Fecha >= '2026-06-01'
GO
-- soloFechaEf (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_EF)) WHERE Fecha >= '2026-09-15'
GO
-- soloFechaFe (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_FE)) WHERE Fecha >= '2026-09-15'
GO
-- soloEstadoFe (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_FE)) WHERE Estado = 3
GO
-- soloEstadoEf (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (IX_EF)) WHERE Estado = 3
GO
-- limpiar
DROP INDEX IX_EF ON dbo.Pedidos
GO
-- limpiar
DROP INDEX IX_FE ON dbo.Pedidos
GO

/* ====================== 7. Sargabilidad ====================== */
-- preparar
CREATE INDEX IX_Pedidos_Fecha ON dbo.Pedidos (Fecha) INCLUDE (Total)
GO
-- preparar
CREATE INDEX IX_Pedidos_Total ON dbo.Pedidos (Total)
GO
-- yearMonth (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE YEAR(Fecha) = 2026 AND MONTH(Fecha) = 9
GO
-- rango (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE Fecha >= '2026-09-01' AND Fecha < '2026-10-01'
GO
-- castDate (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE CAST(Fecha AS date) = '2026-09-15'
GO
-- rangoDia (medir)
SELECT PedidoId, Total FROM dbo.Pedidos WHERE Fecha >= '2026-09-15' AND Fecha < '2026-09-16'
GO
-- emailN (medir)
SELECT ClienteId, Nombre FROM dbo.Clientes WHERE Email = N'cliente777@ejemplo.com.ar'
GO
-- emailV (medir)
SELECT ClienteId, Nombre FROM dbo.Clientes WHERE Email = 'cliente777@ejemplo.com.ar'
GO
-- likePrefijo (medir)
SELECT ClienteId, Nombre FROM dbo.Clientes WHERE Email LIKE 'cliente777%'
GO
-- likeContiene (medir)
SELECT ClienteId, Nombre FROM dbo.Clientes WHERE Email LIKE '%777@%'
GO
-- totalExpr (medir)
SELECT PedidoId FROM dbo.Pedidos WHERE Total * 1.21 > 6000
GO
-- totalCol (medir)
SELECT PedidoId FROM dbo.Pedidos WHERE Total > 6000 / 1.21
GO
-- limpiar
DROP INDEX IX_Pedidos_Total ON dbo.Pedidos
GO

/* ====================== 8. ORDER BY, TOP y paginación ====================== */
-- top50Sin (medir)
SELECT TOP (50) PedidoId, Fecha, Total FROM dbo.Pedidos WITH (INDEX (PK_Pedidos)) ORDER BY Fecha DESC
GO
-- top50Con (medir)
SELECT TOP (50) PedidoId, Fecha, Total FROM dbo.Pedidos ORDER BY Fecha DESC
GO
-- offset0 (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos ORDER BY Fecha DESC, PedidoId DESC OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
GO
-- offset100k (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos ORDER BY Fecha DESC, PedidoId DESC OFFSET 100000 ROWS FETCH NEXT 50 ROWS ONLY
GO
-- offset350k (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos ORDER BY Fecha DESC, PedidoId DESC OFFSET 350000 ROWS FETCH NEXT 50 ROWS ONLY
GO
-- keyset (medir)
SELECT TOP (50) PedidoId, Fecha, Total FROM dbo.Pedidos WHERE Fecha < '2025-01-01' ORDER BY Fecha DESC, PedidoId DESC
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- limpiar
DROP INDEX IX_Pedidos_Fecha ON dbo.Pedidos
GO

/* ====================== 9. Índices filtrados ====================== */
-- preparar
CREATE INDEX IX_Pedidos_Pendientes ON dbo.Pedidos (Fecha) INCLUDE (ClienteId, Total) WHERE Estado = 3
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- literal (medir)
SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WHERE Estado = 3 AND Fecha >= '2026-06-01'
GO
-- parametro (medir)
EXEC sp_executesql N'SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WHERE Estado = @e AND Fecha >= @f', N'@e tinyint, @f datetime2(0)', @e = 3, @f = '2026-06-01'
GO
-- parametroFecha (medir)
EXEC sp_executesql N'SELECT PedidoId, ClienteId, Fecha, Total FROM dbo.Pedidos WHERE Estado = 3 AND Fecha >= @f', N'@f datetime2(0)', @f = '2026-06-01'
GO
-- limpiar
DROP INDEX IX_Pedidos_Pendientes ON dbo.Pedidos
GO

/* ====================== 10. Estadísticas, variables y parámetros ====================== */
-- histograma (consultar)
DBCC SHOW_STATISTICS ('dbo.Pedidos', IX_Pedidos_ClienteId) WITH HISTOGRAM
GO
-- densidad (consultar)
DBCC SHOW_STATISTICS ('dbo.Pedidos', IX_Pedidos_ClienteId) WITH DENSITY_VECTOR
GO
-- c1 (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = 1
GO
-- c4242 (medir)
SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = 4242
GO
-- variable1 (medir)
DECLARE @c int = 1; SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = @c
GO
-- variable4242 (medir)
DECLARE @c int = 4242; SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = @c
GO
-- variable1Recompile (medir)
DECLARE @c int = 1; SELECT PedidoId, Fecha, Total FROM dbo.Pedidos WHERE ClienteId = @c OPTION (RECOMPILE)
GO

/* ====================== 11. El costo de escribir ====================== */
-- preparar
IF OBJECT_ID('dbo.PedidosCopia') IS NOT NULL DROP TABLE dbo.PedidosCopia;
CREATE TABLE dbo.PedidosCopia (PedidoId int NOT NULL CONSTRAINT PK_PedidosCopia PRIMARY KEY CLUSTERED, ClienteId int NOT NULL, Fecha datetime2(0) NOT NULL, Estado tinyint NOT NULL, Total decimal(12,2) NOT NULL, Observaciones nvarchar(400) NULL);
GO
-- sinIndices (medir)
INSERT dbo.PedidosCopia (PedidoId, ClienteId, Fecha, Estado, Total, Observaciones) SELECT PedidoId, ClienteId, Fecha, Estado, Total, Observaciones FROM dbo.Pedidos WHERE PedidoId <= 100000
GO
-- vaciar
TRUNCATE TABLE dbo.PedidosCopia; CREATE INDEX IX1 ON dbo.PedidosCopia (ClienteId); CREATE INDEX IX2 ON dbo.PedidosCopia (Fecha); CREATE INDEX IX3 ON dbo.PedidosCopia (Estado); CREATE INDEX IX4 ON dbo.PedidosCopia (Total); CREATE INDEX IX5 ON dbo.PedidosCopia (Estado, Fecha) INCLUDE (ClienteId, Total);
GO
-- conIndices (medir)
INSERT dbo.PedidosCopia (PedidoId, ClienteId, Fecha, Estado, Total, Observaciones) SELECT PedidoId, ClienteId, Fecha, Estado, Total, Observaciones FROM dbo.Pedidos WHERE PedidoId <= 100000
GO
-- updateEstado (medir)
UPDATE dbo.PedidosCopia SET Estado = 4 WHERE PedidoId BETWEEN 1 AND 10000
GO
-- updateObs (medir)
UPDATE dbo.PedidosCopia SET Observaciones = N'Nada' WHERE PedidoId BETWEEN 10001 AND 20000
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.PedidosCopia') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- limpiar
DROP TABLE dbo.PedidosCopia
GO

/* ====================== 12. Columnstore ====================== */
-- agregadoFila (medir)
SELECT pr.Categoria, COUNT_BIG(*) AS Items, SUM(i.Cantidad * i.PrecioUnitario) AS Facturado FROM dbo.Items i JOIN dbo.Productos pr ON pr.ProductoId = i.ProductoId GROUP BY pr.Categoria
GO
-- crear
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_Items ON dbo.Items (PedidoId, ProductoId, Cantidad, PrecioUnitario)
GO
-- agregadoColumnar (medir)
SELECT pr.Categoria, COUNT_BIG(*) AS Items, SUM(i.Cantidad * i.PrecioUnitario) AS Facturado FROM dbo.Items i JOIN dbo.Productos pr ON pr.ProductoId = i.ProductoId GROUP BY pr.Categoria
GO
-- puntualColumnar (medir)
SELECT ItemId, Cantidad FROM dbo.Items WHERE PedidoId = 123456
GO
-- tamanos (consultar)
SELECT i.name AS indice, i.type_desc AS tipo, SUM(ps.used_page_count) AS paginas, SUM(ps.row_count) AS filas, i.has_filter AS filtrado
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.Items') GROUP BY i.name, i.type_desc, i.has_filter ORDER BY MIN(i.index_id)
GO
-- limpiar
DROP INDEX NCCI_Items ON dbo.Items
GO

/* ====================== 13. Lo que el servidor sabe de tus índices ====================== */
-- usoPedidos (consultar)
SELECT i.name AS indice, ISNULL(u.user_seeks, 0) AS seeks, ISNULL(u.user_scans, 0) AS scans, ISNULL(u.user_lookups, 0) AS lookups, ISNULL(u.user_updates, 0) AS updates
FROM sys.indexes i LEFT JOIN sys.dm_db_index_usage_stats u ON u.object_id = i.object_id AND u.index_id = i.index_id AND u.database_id = DB_ID()
WHERE i.object_id = OBJECT_ID('dbo.Pedidos') ORDER BY i.index_id
GO
-- faltantes (consultar)
SELECT TOP (8) d.statement AS tabla, d.equality_columns AS igualdad, d.inequality_columns AS desigualdad, d.included_columns AS incluidas, s.user_seeks AS veces, CAST(s.avg_user_impact AS int) AS impacto, CAST(s.avg_total_user_cost AS decimal(10,2)) AS costo
FROM sys.dm_db_missing_index_details d JOIN sys.dm_db_missing_index_groups g ON g.index_handle = d.index_handle JOIN sys.dm_db_missing_index_group_stats s ON s.group_handle = g.index_group_handle
WHERE d.database_id = DB_ID() ORDER BY s.avg_user_impact * s.avg_total_user_cost * s.user_seeks DESC
GO

/* ====================== Base de ejemplo: setup.sql ====================== */
IF DB_ID('Tienda') IS NULL CREATE DATABASE Tienda;
GO
ALTER DATABASE Tienda SET COMPATIBILITY_LEVEL = 160;
ALTER DATABASE Tienda SET QUERY_STORE = ON;
GO
USE Tienda;
GO
IF OBJECT_ID('dbo.Items') IS NOT NULL DROP TABLE dbo.Items;
IF OBJECT_ID('dbo.Pedidos') IS NOT NULL DROP TABLE dbo.Pedidos;
IF OBJECT_ID('dbo.Clientes') IS NOT NULL DROP TABLE dbo.Clientes;
IF OBJECT_ID('dbo.Productos') IS NOT NULL DROP TABLE dbo.Productos;
IF OBJECT_ID('dbo.fn_TotalConIva') IS NOT NULL DROP FUNCTION dbo.fn_TotalConIva;
IF OBJECT_ID('dbo.PedidosDeCliente') IS NOT NULL DROP PROCEDURE dbo.PedidosDeCliente;
IF OBJECT_ID('dbo.ResumenCliente') IS NOT NULL DROP PROCEDURE dbo.ResumenCliente;
GO
CREATE TABLE dbo.Clientes (
  ClienteId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Clientes PRIMARY KEY CLUSTERED,
  Nombre nvarchar(100) NOT NULL,
  Email varchar(200) NOT NULL,
  Provincia varchar(40) NOT NULL,
  FechaAlta datetime2(0) NOT NULL,
  Activo bit NOT NULL
);
CREATE TABLE dbo.Productos (
  ProductoId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Productos PRIMARY KEY CLUSTERED,
  Nombre nvarchar(120) NOT NULL,
  Categoria varchar(40) NOT NULL,
  Precio decimal(12,2) NOT NULL
);
CREATE TABLE dbo.Pedidos (
  PedidoId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Pedidos PRIMARY KEY CLUSTERED,
  ClienteId int NOT NULL CONSTRAINT FK_Pedidos_Clientes REFERENCES dbo.Clientes(ClienteId),
  Fecha datetime2(0) NOT NULL,
  Estado tinyint NOT NULL,
  Total decimal(12,2) NOT NULL,
  Observaciones nvarchar(400) NULL
);
CREATE TABLE dbo.Items (
  ItemId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Items PRIMARY KEY CLUSTERED,
  PedidoId int NOT NULL CONSTRAINT FK_Items_Pedidos REFERENCES dbo.Pedidos(PedidoId),
  ProductoId int NOT NULL CONSTRAINT FK_Items_Productos REFERENCES dbo.Productos(ProductoId),
  Cantidad int NOT NULL,
  PrecioUnitario decimal(12,2) NOT NULL
);
GO
;WITH n AS (SELECT TOP (50000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b)
INSERT dbo.Clientes (Nombre, Email, Provincia, FechaAlta, Activo)
SELECT N'Cliente ' + CAST(i AS nvarchar(10)),
       'cliente' + CAST(i AS varchar(10)) + '@ejemplo.com.ar',
       CASE i % 10 WHEN 0 THEN 'Buenos Aires' WHEN 1 THEN 'CABA' WHEN 2 THEN 'Córdoba' WHEN 3 THEN 'Santa Fe' WHEN 4 THEN 'Mendoza' WHEN 5 THEN 'Tucumán' WHEN 6 THEN 'Entre Ríos' WHEN 7 THEN 'Salta' WHEN 8 THEN 'Neuquén' ELSE 'Chubut' END,
       DATEADD(DAY, -(i % 1500), '2026-10-01'),
       CASE WHEN i % 7 = 0 THEN 0 ELSE 1 END
FROM n;
;WITH n AS (SELECT TOP (2000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b)
INSERT dbo.Productos (Nombre, Categoria, Precio)
SELECT N'Producto ' + CAST(i AS nvarchar(10)),
       CASE i % 6 WHEN 0 THEN 'Almacén' WHEN 1 THEN 'Bebidas' WHEN 2 THEN 'Limpieza' WHEN 3 THEN 'Electro' WHEN 4 THEN 'Librería' ELSE 'Jardín' END,
       CAST(100 + (i * 37) % 90000 AS decimal(12,2)) / 1
FROM n;
-- 400.000 pedidos: el cliente 1 (mayorista) tiene 100.000; el resto se reparte.
;WITH n AS (SELECT TOP (400000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b CROSS JOIN sys.all_columns c)
INSERT dbo.Pedidos (ClienteId, Fecha, Estado, Total, Observaciones)
SELECT CASE WHEN i <= 100000 THEN 1 ELSE 2 + ABS(CHECKSUM(NEWID())) % 49999 END,
       DATEADD(MINUTE, -(ABS(CHECKSUM(NEWID())) % 1051200), '2026-10-01'),
       CASE ABS(CHECKSUM(NEWID())) % 100 WHEN 0 THEN 3 WHEN 1 THEN 4 WHEN 2 THEN 4 ELSE 1 + ABS(CHECKSUM(NEWID())) % 2 END,
       CAST(ABS(CHECKSUM(NEWID())) % 500000 AS decimal(12,2)) / 100,
       CASE WHEN i % 3 = 0 THEN NULL ELSE N'Entregar por la tarde, timbre ' + CAST(i % 9 AS nvarchar(2)) + N'. ' + REPLICATE(N'Sin cambios. ', 1 + i % 12) END
FROM n;
;WITH n AS (SELECT TOP (1200000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b CROSS JOIN sys.all_columns c)
INSERT dbo.Items (PedidoId, ProductoId, Cantidad, PrecioUnitario)
SELECT 1 + (i - 1) / 3, 1 + ABS(CHECKSUM(NEWID())) % 2000, 1 + ABS(CHECKSUM(NEWID())) % 5, CAST(100 + ABS(CHECKSUM(NEWID())) % 90000 AS decimal(12,2)) / 1
FROM n;
GO
CREATE NONCLUSTERED INDEX IX_Pedidos_ClienteId ON dbo.Pedidos (ClienteId);
CREATE NONCLUSTERED INDEX IX_Clientes_Email ON dbo.Clientes (Email);
CREATE NONCLUSTERED INDEX IX_Items_PedidoId ON dbo.Items (PedidoId) INCLUDE (ProductoId, Cantidad, PrecioUnitario);
GO
CREATE FUNCTION dbo.fn_TotalConIva (@total decimal(12,2)) RETURNS decimal(12,2) WITH INLINE = OFF AS BEGIN RETURN ROUND(@total * 1.21, 2); END
GO
CREATE PROCEDURE dbo.PedidosDeCliente @ClienteId int AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.PedidoId, p.Fecha, p.Estado, p.Total FROM dbo.Pedidos p WHERE p.ClienteId = @ClienteId ORDER BY p.Fecha DESC;
END
GO
CREATE PROCEDURE dbo.ResumenCliente @ClienteId int AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @pedidos TABLE (PedidoId int PRIMARY KEY, Total decimal(12,2));
  INSERT @pedidos (PedidoId, Total) SELECT PedidoId, Total FROM dbo.Pedidos WHERE ClienteId = @ClienteId;
  SELECT c.Nombre, COUNT(*) AS Pedidos, SUM(t.Total) AS Total, SUM(i.Cantidad) AS Unidades
  FROM dbo.Clientes c
  JOIN @pedidos t ON 1 = 1
  JOIN dbo.Items i ON i.PedidoId = t.PedidoId
  WHERE c.ClienteId = @ClienteId
  GROUP BY c.Nombre;
END
GO
UPDATE STATISTICS dbo.Pedidos WITH FULLSCAN;
UPDATE STATISTICS dbo.Clientes WITH FULLSCAN;
UPDATE STATISTICS dbo.Items WITH FULLSCAN;
GO
