// Reproduce un escenario del simulador «El thread pool en vivo» contra el thread pool real de .NET:
// un generador de pedidos (llegadas Poisson) encola work items; cada uno quema CPU, «espera la I/O»
// de alguna de las tres formas (await / .Wait() sobre una Task / Thread.Sleep) y quema CPU otra vez.
// Un muestreador aparte anota cada 100 ms los hilos del pool, la cola y las latencias.
//   dotnet run -c Release -- modo=sync rps=100 io=100 cpu=2 cpu2=1 dur=30 min=0 rafaga=0 semilla=1
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;

var a = args.Select(x => x.Split('=')).ToDictionary(p => p[0], p => p[1]);
string modo = a.GetValueOrDefault("modo", "sync");           // async | result | sync
int rps = int.Parse(a.GetValueOrDefault("rps", "100"));
int ioMs = int.Parse(a.GetValueOrDefault("io", "100"));
double cpuMs = double.Parse(a.GetValueOrDefault("cpu", "2"), System.Globalization.CultureInfo.InvariantCulture);
double cpu2Ms = double.Parse(a.GetValueOrDefault("cpu2", "1"), System.Globalization.CultureInfo.InvariantCulture);
int durS = int.Parse(a.GetValueOrDefault("dur", "30"));
int minHilos = int.Parse(a.GetValueOrDefault("min", "0"));
int rafaga = int.Parse(a.GetValueOrDefault("rafaga", "0"));  // pedidos extra de golpe a los 2 s
int semilla = int.Parse(a.GetValueOrDefault("semilla", "1"));

if (minHilos > 0) { ThreadPool.GetMinThreads(out _, out var io); ThreadPool.SetMinThreads(minHilos, io); }
ThreadPool.GetMinThreads(out var minW, out _);

var reloj = Stopwatch.StartNew();
var completados = new ConcurrentQueue<(long fin, long lat)>();  // ticks
long llegados = 0; int activos = 0; long activosMax = 0;
string url = a.GetValueOrDefault("url", "http://127.0.0.1:18081/");
var http = new HttpClient();
double tps = Stopwatch.Frequency / 1000.0;

void QuemarCpu(double ms) { long hasta = Stopwatch.GetTimestamp() + (long)(ms * tps); while (Stopwatch.GetTimestamp() < hasta) { } }

void Terminar(long inicio) { long fin = Stopwatch.GetTimestamp(); completados.Enqueue((fin, fin - inicio)); Interlocked.Decrement(ref activos); }
void Entrar() { int n = Interlocked.Increment(ref activos); long m = activosMax; while (n > m && Interlocked.CompareExchange(ref activosMax, n, m) != m) m = activosMax; }

void Encolar()
{
    Interlocked.Increment(ref llegados);
    long inicio = Stopwatch.GetTimestamp();
    switch (modo)
    {
        case "async":
            ThreadPool.UnsafeQueueUserWorkItem<object?>(async _ => { Entrar(); QuemarCpu(cpuMs); await Task.Delay(ioMs); QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
        case "result":
            ThreadPool.UnsafeQueueUserWorkItem<object?>(_ => { Entrar(); QuemarCpu(cpuMs); Task.Delay(ioMs).Wait(); QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
        case "http-async":
            ThreadPool.UnsafeQueueUserWorkItem<object?>(async _ => { Entrar(); QuemarCpu(cpuMs); await http.GetStringAsync(url); QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
        case "http-result":
            ThreadPool.UnsafeQueueUserWorkItem<object?>(_ => { Entrar(); QuemarCpu(cpuMs); _ = http.GetStringAsync(url).Result; QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
        case "http-sync":
            ThreadPool.UnsafeQueueUserWorkItem<object?>(_ => { Entrar(); QuemarCpu(cpuMs); using (var r = http.Send(new HttpRequestMessage(HttpMethod.Get, url))) { r.Content.ReadAsStream().CopyTo(Stream.Null); } QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
        default:
            ThreadPool.UnsafeQueueUserWorkItem<object?>(_ => { Entrar(); QuemarCpu(cpuMs); Thread.Sleep(ioMs); QuemarCpu(cpu2Ms); Terminar(inicio); }, null, preferLocal: false);
            break;
    }
}

// Muestreador: cada 100 ms, hilos del pool, cola pendiente y latencias de lo que terminó en la ventana.
var muestras = new List<object>();
var todas = new List<long>();
long hilosMax = 0, colaMax = 0, hilosMaxT = 0;
var muestreador = new Thread(() =>
{
    long paso = (long)(100 * tps), proximo = paso;
    var ventana = new List<long>();
    while (reloj.ElapsedTicks < durS * Stopwatch.Frequency)
    {
        long ahora = reloj.ElapsedTicks;
        if (ahora < proximo) { Thread.Sleep(1); continue; }
        proximo += paso;
        ventana.Clear();
        while (completados.TryDequeue(out var c)) { ventana.Add(c.lat); todas.Add(c.lat); }
        ventana.Sort();
        long hilos = ThreadPool.ThreadCount, cola = ThreadPool.PendingWorkItemCount;
        if (hilos > hilosMax) { hilosMax = hilos; hilosMaxT = ahora; }
        if (cola > colaMax) colaMax = cola;
        lock (muestras) muestras.Add(new { t = Math.Round(ahora / tps / 1000, 1), hilos, cola, activos = Volatile.Read(ref activos), terminados = ventana.Count,
            p50 = ventana.Count > 0 ? Math.Round(Percentil(ventana, 0.5) / tps, 1) : (double?)null,
            p99 = ventana.Count > 0 ? Math.Round(Percentil(ventana, 0.99) / tps, 1) : (double?)null });
    }
}) { IsBackground = true, Priority = ThreadPriority.AboveNormal };

// Generador: llegadas Poisson con semilla fija, en un hilo propio (no del pool).
var generador = new Thread(() =>
{
    var rng = new Random(semilla);
    double media = Stopwatch.Frequency / (double)rps;
    double proximo = -Math.Log(1 - rng.NextDouble()) * media;
    bool rafagaHecha = rafaga == 0;
    long fin = durS * Stopwatch.Frequency;
    while (true)
    {
        long ahora = reloj.ElapsedTicks;
        if (ahora >= fin) break;
        if (!rafagaHecha && ahora >= 2 * Stopwatch.Frequency) { for (int i = 0; i < rafaga; i++) Encolar(); rafagaHecha = true; }
        if (ahora >= proximo) { Encolar(); proximo += -Math.Log(1 - rng.NextDouble()) * media; continue; }
        long falta = (long)proximo - ahora;
        if (falta > 2 * tps) Thread.Sleep(1); else Thread.SpinWait(50);
    }
}) { IsBackground = true, Priority = ThreadPriority.Highest };

muestreador.Start(); generador.Start();
generador.Join(); muestreador.Join();
Thread.Sleep(50);
while (completados.TryDequeue(out var c)) todas.Add(c.lat);
todas.Sort();

var recuperacion = Recuperacion(muestras);
var resumen = new
{
    opciones = new { modo, rps, ioMs, cpuMs, cpu2Ms, durS, minHilos = minW, rafaga, semilla, nucleos = Environment.ProcessorCount, runtime = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription, so = System.Runtime.InteropServices.RuntimeInformation.OSDescription },
    llegados, completados = todas.Count, enVuelo = llegados - todas.Count,
    p50 = Math.Round(Percentil(todas, 0.5) / tps, 1), p99 = Math.Round(Percentil(todas, 0.99) / tps, 1), max = Math.Round((todas.Count > 0 ? todas[^1] : 0) / tps, 1),
    media = Math.Round(todas.Count > 0 ? todas.Average() / tps : 0, 1),
    hilosMax, hilosMaxT = Math.Round(hilosMaxT / tps / 1000, 1), colaMax, activosMax, recuperacion,
    muestras,
};
Console.WriteLine(JsonSerializer.Serialize(resumen, new JsonSerializerOptions { WriteIndented = false }));

static long Percentil(List<long> xs, double p) { if (xs.Count == 0) return 0; int i = Math.Min(xs.Count - 1, Math.Max(0, (int)Math.Ceiling(p * xs.Count) - 1)); return xs[i]; }

// Igual que tiempoRecuperacion() del simulador: pico de la cola y cuándo volvió a (casi) cero.
static object Recuperacion(List<object> muestras)
{
    dynamic? pico = null; double tPico = 0; long maxCola = 0;
    foreach (dynamic m in muestras) if ((long)m.cola > maxCola) { maxCola = m.cola; tPico = m.t; pico = m; }
    if (maxCola < 10) return new { pico = maxCola, tPico, t = 0.0, ok = true };
    foreach (dynamic m in muestras) if ((double)m.t > tPico && (long)m.cola <= Math.Max(2, maxCola * 0.02)) return new { pico = maxCola, tPico, t = (double)m.t, ok = true };
    return new { pico = maxCola, tPico, t = (double?)null, ok = false };
}

