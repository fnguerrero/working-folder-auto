# Generador de trazas reales

Proyecto .NET 8 que provoca ~170 excepciones típicas de un backend y guarda `ex.ToString()` de cada una
en `trazas/<caso>.txt`. Es el origen del corpus de `../tests/trazas/` y de los ejemplos de la página.

Casos: nulos, LINQ, colecciones, parseo y cultura, casts, async (`await`, `.Result`, `GetAwaiter().GetResult()`,
`WhenAll`, `Parallel`, fire and forget, hilos, timers), lambdas, funciones locales, iteradores, genéricos,
constructores estáticos, reflexión, archivos y permisos, ensamblados, JSON (System.Text.Json y Newtonsoft),
expresiones compiladas, HTTP (timeout, rechazada, DNS, status, cancelación), sockets, Redis, ASP.NET Core
(excepción no manejada, body inválido) y DI; con `SQL_CS`: ADO.NET (duplicados, FK, NULL, truncamiento,
objetos inexistentes, conversiones, parámetros, timeout, deadlock, login, red, reader, MARS, pool,
transacciones, bulk copy), Dapper y EF Core 8 (duplicados, FK, concurrencia, LINQ no traducible, disposed,
segunda operación, tracking, sin proveedor, timeout, deadlock); con `PG_CS`: Npgsql 8 (duplicados, FK, NULL,
relaciones y columnas inexistentes, tipos, truncamiento, CHECK, timeouts, deadlock, RAISE, conexiones).

```bash
dotnet run -c Release -- ../tests/trazas          # sin bases: solo los casos que no las necesitan
SQL_CS='…' PG_CS='…' dotnet run -c Release -- ../tests/trazas
DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 dotnet run -c Release -- ../tests/trazas   # el caso de modo invariante
```

Las cadenas de conexión van por variables de entorno; no hay secretos en el código. El proyecto levanta un
servidor web en `127.0.0.1:5088` para los casos de HTTP y ASP.NET Core. Corrió en Docker
(`mcr.microsoft.com/dotnet/sdk:8.0`) contra SQL Server 2022 y PostgreSQL 16 en contenedores.
