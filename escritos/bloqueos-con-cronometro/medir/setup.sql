-- Base «Bloqueos» para los experimentos. La crea desde cero medir.js; se puede correr a mano en SSMS.
IF DB_ID('Bloqueos') IS NOT NULL BEGIN ALTER DATABASE Bloqueos SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE Bloqueos; END
GO
CREATE DATABASE Bloqueos
GO
ALTER DATABASE Bloqueos SET READ_COMMITTED_SNAPSHOT OFF; ALTER DATABASE Bloqueos SET ALLOW_SNAPSHOT_ISOLATION OFF; ALTER DATABASE Bloqueos SET RECOVERY SIMPLE;
GO
USE Bloqueos
GO
CREATE TABLE dbo.Productos (ProductoId int NOT NULL CONSTRAINT PK_Productos PRIMARY KEY CLUSTERED, Nombre nvarchar(60) NOT NULL, Precio decimal(12,2) NOT NULL, Stock int NOT NULL, Version rowversion NOT NULL);
CREATE TABLE dbo.Clientes (ClienteId int NOT NULL CONSTRAINT PK_Clientes PRIMARY KEY CLUSTERED, Nombre nvarchar(80) NOT NULL, Email nvarchar(120) NOT NULL);
CREATE TABLE dbo.Pedidos (PedidoId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Pedidos PRIMARY KEY CLUSTERED, ClienteId int NOT NULL, Fecha datetime2(0) NOT NULL, Estado tinyint NOT NULL, Total decimal(12,2) NOT NULL, Codigo nvarchar(20) NOT NULL, Observaciones nvarchar(200) NULL);
CREATE INDEX IX_Pedidos_ClienteId ON dbo.Pedidos (ClienteId);
CREATE TABLE dbo.Cuentas (CuentaId int NOT NULL CONSTRAINT PK_Cuentas PRIMARY KEY CLUSTERED, Titular nvarchar(60) NOT NULL, Saldo decimal(12,2) NOT NULL);
CREATE TABLE dbo.Reservas (ReservaId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reservas PRIMARY KEY CLUSTERED, Sala int NOT NULL, Hora int NOT NULL, Quien nvarchar(60) NOT NULL);
CREATE INDEX IX_Reservas_Sala_Hora ON dbo.Reservas (Sala, Hora);
GO
-- 2.000 productos, 10.000 clientes, 200.000 pedidos (un mayorista, el cliente 1, con 20.000), 10 cuentas.
;WITH n AS (SELECT TOP (200000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b)
INSERT dbo.Productos (ProductoId, Nombre, Precio, Stock) SELECT i, N'Producto ' + CAST(i AS nvarchar(10)), 100 + (i * 37) % 9000, 100 FROM n WHERE i <= 2000;
;WITH n AS (SELECT TOP (200000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b)
INSERT dbo.Clientes (ClienteId, Nombre, Email) SELECT i, N'Cliente ' + CAST(i AS nvarchar(10)), N'cliente' + CAST(i AS nvarchar(10)) + N'@ejemplo.com' FROM n WHERE i <= 10000;
;WITH n AS (SELECT TOP (200000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i FROM sys.all_columns a CROSS JOIN sys.all_columns b)
INSERT dbo.Pedidos (ClienteId, Fecha, Estado, Total, Codigo, Observaciones)
SELECT CASE WHEN i % 10 = 0 THEN 1 ELSE 1 + (i * 7919) % 10000 END, DATEADD(MINUTE, i * 5, '2024-01-01'), i % 4, 100 + (i * 131) % 50000, N'PED-' + RIGHT(N'000000' + CAST(i AS nvarchar(10)), 6), N'Pedido de prueba número ' + CAST(i AS nvarchar(10)) FROM n ORDER BY i;
INSERT dbo.Cuentas (CuentaId, Titular, Saldo) VALUES (1, N'Ana', 1000), (2, N'Bruno', 1000), (3, N'Carla', 1000), (4, N'Dante', 1000);
GO
