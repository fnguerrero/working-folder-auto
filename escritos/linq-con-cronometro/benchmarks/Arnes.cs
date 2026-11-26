using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace Cronometro;

/// <summary>Un caso: Correr(n) ejecuta la operación n veces y devuelve algo que depende del resultado,
/// para que el JIT no la pueda borrar.</summary>
public sealed record Caso(string Capitulo, string Grupo, string Id, string Nombre, Func<int, long> Correr, bool VariosHilos = false);

public sealed record Medicion(string Capitulo, string Id, string Nombre, int OpsPorMuestra, double[] NsPorOp,
    double MedianaNs, double MinNs, double MaxNs, double P25Ns, double P75Ns, double BytesPorOp, string Contador);

/// <summary>Arnés propio (no es BenchmarkDotNet): calibra cuántas operaciones entran en una muestra, calienta
/// para que el JIT por niveles termine, toma varias muestras y las guarda todas.</summary>
public static class Arnes
{
    public const int Muestras = 12;
    const double MsPorMuestra = 30;
    public static long Sumidero;

    public static Medicion Medir(Caso c)
    {
        int n = 1;
        while (Cronometrar(c, n) < MsPorMuestra && n < (1 << 28)) n *= 2;

        // Calentamiento: tandas separadas por pausas, para que la recompilación en segundo plano llegue.
        for (int ronda = 0; ronda < 3; ronda++)
        {
            var w = Stopwatch.StartNew();
            do { Sumidero += c.Correr(n); } while (w.ElapsedMilliseconds < 120);
            Thread.Sleep(120);
        }
        // Recalibrar con el código ya optimizado.
        double ms = Cronometrar(c, n);
        n = (int)Math.Clamp(n * (MsPorMuestra / Math.Max(ms, 0.001)), 1, 1 << 28);

        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        var ns = new double[Muestras];
        var bytes = new double[Muestras];
        for (int i = 0; i < Muestras; i++)
        {
            long a0 = c.VariosHilos ? GC.GetTotalAllocatedBytes(true) : GC.GetAllocatedBytesForCurrentThread();
            long t0 = Stopwatch.GetTimestamp();
            Sumidero += c.Correr(n);
            long t1 = Stopwatch.GetTimestamp();
            long a1 = c.VariosHilos ? GC.GetTotalAllocatedBytes(true) : GC.GetAllocatedBytesForCurrentThread();
            ns[i] = (t1 - t0) * 1e9 / Stopwatch.Frequency / n;
            bytes[i] = (double)(a1 - a0) / n;
        }
        var o = ns.OrderBy(x => x).ToArray();
        var ob = bytes.OrderBy(x => x).ToArray();
        return new Medicion(c.Capitulo, c.Id, c.Nombre, n, ns.Select(x => Math.Round(x, 3)).ToArray(),
            Cuantil(o, .5), Math.Round(o[0], 3), Math.Round(o[^1], 3), Cuantil(o, .25), Cuantil(o, .75), Math.Round(Cuantil(ob, .5), 1),
            c.VariosHilos ? "GC.GetTotalAllocatedBytes" : "GC.GetAllocatedBytesForCurrentThread");
    }

    static double Cronometrar(Caso c, int n)
    {
        long t0 = Stopwatch.GetTimestamp();
        Sumidero += c.Correr(n);
        return Stopwatch.GetElapsedTime(t0).TotalMilliseconds;
    }

    public static double Cuantil(double[] ordenados, double q)
    {
        double p = q * (ordenados.Length - 1);
        int i = (int)p;
        double r = i + 1 < ordenados.Length ? ordenados[i] + (ordenados[i + 1] - ordenados[i]) * (p - i) : ordenados[i];
        return Math.Round(r, 3);
    }

    /// <summary>Datos del entorno. A propósito no incluye nombre de la máquina, del usuario ni rutas.</summary>
    public static object Entorno() => new
    {
        fecha = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
        runtime = RuntimeInformation.FrameworkDescription,
        so = RuntimeInformation.OSDescription,
        arquitectura = RuntimeInformation.ProcessArchitecture.ToString(),
        procesadoresLogicos = Environment.ProcessorCount,
        gcServidor = System.Runtime.GCSettings.IsServerGC,
        arnes = "propio (Stopwatch); no es BenchmarkDotNet"
    };

    public static readonly JsonSerializerOptions Json = new() { WriteIndented = false, PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
}
