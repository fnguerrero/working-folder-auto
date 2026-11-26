using System.Collections.Concurrent;
using System.Diagnostics;

namespace Cronometro;

/// <summary>Sync-over-async bajo carga. No hay HTTP: cada "pedido" es un trabajo que entra al thread pool a un
/// ritmo fijo (llegan igual aunque el servidor esté atrasado) y espera 100 ms de "base de datos".</summary>
public static class Hambre
{
    const int EsperaMs = 100;

    // <codigo:hambre>
    // Espera sin ocupar un hilo.
    static async Task PedidoAsync() => await Task.Delay(EsperaMs);

    // Sync-over-async: una operación async a la que alguien le pone .Result.
    static async Task<int> Consulta() { await Task.Delay(EsperaMs); return 1; }
    static int PedidoResult() => Consulta().Result;

    // Bloqueo "a secas", sin Task de por medio.
    static void PedidoSleep() => Thread.Sleep(EsperaMs);
    // </codigo:hambre>

    public static object Correr(string modo, int ritmo, int segundos)
    {
        if (modo == "result200") { ThreadPool.GetMinThreads(out _, out var io); ThreadPool.SetMinThreads(200, io); }
        ThreadPool.GetMinThreads(out int minimo, out _);

        int total = ritmo * segundos, enviados = 0, terminados = 0;
        var latencias = new double[total];
        var sondas = new ConcurrentQueue<double>();
        int sondasEnviadas = 0;
        var serie = new List<object>();
        var reloj = Stopwatch.StartNew();
        double Ahora() => reloj.Elapsed.TotalMilliseconds;

        void Lanzar(int i)
        {
            double llegada = Ahora();
            void Fin() { latencias[i] = Ahora() - llegada; Interlocked.Increment(ref terminados); }
            // preferLocal: false = a la cola global, como entra un pedido nuevo.
            if (modo == "async")
                ThreadPool.QueueUserWorkItem(async _ => { await PedidoAsync(); Fin(); }, 0, preferLocal: false);
            else if (modo == "sleep")
                ThreadPool.QueueUserWorkItem(_ => { PedidoSleep(); Fin(); }, 0, preferLocal: false);
            else
                ThreadPool.QueueUserWorkItem(_ => { PedidoResult(); Fin(); }, 0, preferLocal: false);
        }

        // El generador y el muestreo corren en un hilo propio, fuera del pool.
        var generador = new Thread(() =>
        {
            double proximaMuestra = 500, proximaSonda = 0, tAnterior = 0; int antes = 0;
            while (true)
            {
                double t = Ahora();
                int deberian = Math.Min(total, (int)(Math.Min(t, segundos * 1000.0) / 1000 * ritmo));
                while (enviados < deberian) Lanzar(enviados++);
                if (t >= proximaSonda && t < segundos * 1000)
                {
                    proximaSonda += 250; double e = t; sondasEnviadas++;   // un pedido que no hace nada (el "health check")
                    ThreadPool.QueueUserWorkItem(_ => sondas.Enqueue(Ahora() - e), 0, preferLocal: false);
                }
                if (t >= proximaMuestra)
                {
                    int hechos = Volatile.Read(ref terminados);
                    serie.Add(new { s = Math.Round(t / 1000, 2), hilos = ThreadPool.ThreadCount, enCola = ThreadPool.PendingWorkItemCount,
                        enviados, terminados = hechos, porSegundo = Math.Round((hechos - antes) / ((t - tAnterior) / 1000), 0) });
                    antes = hechos; tAnterior = t; proximaMuestra += 500;
                }
                if (t >= segundos * 1000) break;
                Thread.Sleep(5);
            }
        });
        generador.Start(); generador.Join();
        int alCorte = Volatile.Read(ref terminados), hilosAlCorte = ThreadPool.ThreadCount;
        var limite = Stopwatch.StartNew();
        while (Volatile.Read(ref terminados) < enviados && limite.Elapsed.TotalSeconds < 45) Thread.Sleep(20);
        double drenaje = limite.Elapsed.TotalSeconds;
        Thread.Sleep(200);

        int alFinal = Volatile.Read(ref terminados);
        var lat = latencias.Take(enviados).Where(x => x > 0).OrderBy(x => x).ToArray();
        var son = sondas.OrderBy(x => x).ToArray();
        double Q(double[] a, double q) => a.Length == 0 ? -1 : Arnes.Cuantil(a, q);
        return new
        {
            modo, ritmo, segundos, esperaMs = EsperaMs, minHilos = minimo, enviados, terminadosAlCorte = alCorte,
            porSegundo = Math.Round(alCorte / (double)segundos, 1), hilosAlCorte,
            terminadosAlFinal = alFinal, drenajeSegundos = Math.Round(drenaje, 2),
            latenciaP50Ms = Q(lat, .5), latenciaP99Ms = Q(lat, .99),
            sondasEnviadas, sondasRespondidas = son.Length, sondaP50Ms = Q(son, .5), sondaMaxMs = Q(son, 1),
            serie
        };
    }
}
