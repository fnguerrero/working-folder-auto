using BenchmarkDotNet.Attributes;
using Microsoft.Extensions.Logging;

namespace Bench;

public static partial class Mensajes
{
    [LoggerMessage(EventId = 1, Level = LogLevel.Debug, Message = "Pedido {Id} del cliente {ClienteId} por {Total}")]
    public static partial void PedidoProcesado(this ILogger logger, int id, int clienteId, decimal total);
    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "Pedido {Id} del cliente {ClienteId} por {Total}")]
    public static partial void PedidoProcesadoInfo(this ILogger logger, int id, int clienteId, decimal total);
}

// Capítulo: logging que no se ve pero se paga.
public class Logging
{
    private readonly ILogger _logger;
    private readonly int _id = 4821, _cliente = 17; private readonly decimal _total = 1234.5m;
    private static readonly Action<ILogger, int, int, decimal, Exception?> _define =
        LoggerMessage.Define<int, int, decimal>(LogLevel.Debug, new EventId(3), "Pedido {Id} del cliente {ClienteId} por {Total}");
    public Logging()
    {
        // Proveedor que descarta todo pero con el nivel mínimo en Information: lo normal en producción.
        var fabrica = LoggerFactory.Create(b => { b.SetMinimumLevel(LogLevel.Information); b.AddProvider(new ProveedorNulo()); });
        _logger = fabrica.CreateLogger("Bench");
    }
    [Benchmark(Baseline = true)] public void DebugInterpolado() => _logger.LogDebug($"Pedido {_id} del cliente {_cliente} por {_total}");
    [Benchmark] public void DebugPlantilla() => _logger.LogDebug("Pedido {Id} del cliente {ClienteId} por {Total}", _id, _cliente, _total);
    [Benchmark] public void DebugConIsEnabled() { if (_logger.IsEnabled(LogLevel.Debug)) _logger.LogDebug("Pedido {Id} del cliente {ClienteId} por {Total}", _id, _cliente, _total); }
    [Benchmark] public void DebugLoggerMessageDefine() => _define(_logger, _id, _cliente, _total, null);
    [Benchmark] public void DebugSourceGenerator() => _logger.PedidoProcesado(_id, _cliente, _total);
    [Benchmark] public void InfoInterpolado() => _logger.LogInformation($"Pedido {_id} del cliente {_cliente} por {_total}");
    [Benchmark] public void InfoPlantilla() => _logger.LogInformation("Pedido {Id} del cliente {ClienteId} por {Total}", _id, _cliente, _total);
    [Benchmark] public void InfoSourceGenerator() => _logger.PedidoProcesadoInfo(_id, _cliente, _total);

    private sealed class ProveedorNulo : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new LoggerNulo();
        public void Dispose() { }
        private sealed class LoggerNulo : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) { _ = formatter(state, exception); }
        }
    }
}

// Capítulo: fechas y GUID.
public class Fechas
{
    private readonly DateTime _f = new(2026, 10, 16, 3, 0, 0, DateTimeKind.Utc);
    private readonly char[] _buffer = new char[32];
    [Benchmark(Baseline = true)] public DateTime UtcNow() => DateTime.UtcNow;
    [Benchmark] public DateTime Now() => DateTime.Now;
    [Benchmark] public DateTimeOffset OffsetNow() => DateTimeOffset.Now;
    [Benchmark] public long StopwatchTimestamp() => System.Diagnostics.Stopwatch.GetTimestamp();
    [Benchmark] public string ToStringFormato() => _f.ToString("yyyy-MM-dd HH:mm:ss");
    [Benchmark] public string ToStringO() => _f.ToString("O");
    [Benchmark] public int TryFormat() { _f.TryFormat(_buffer, out var n, "yyyy-MM-dd HH:mm:ss"); return n; }
    [Benchmark] public DateTime ParseExact() => DateTime.ParseExact("2026-10-16 03:00:00", "yyyy-MM-dd HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture);
    [Benchmark] public DateTime Parse() => DateTime.Parse("2026-10-16 03:00:00", System.Globalization.CultureInfo.InvariantCulture);
    [Benchmark] public Guid NewGuid() => Guid.NewGuid();
    [Benchmark] public string GuidToString() => Guid.Empty.ToString();
}
