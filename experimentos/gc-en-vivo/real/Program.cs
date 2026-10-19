// El GC en vivo: medición contra un .NET 8 real.
// Uso: dotnet GcReal.dll escenario=corta dur=20 rate=200 hilos=2 [obj=1024] [vida=500] [cache=512] [latencia=sustained]
// Imprime un JSON con las colecciones por generación, cada pausa (de los eventos del runtime), los
// «congelamientos» que vio un hilo centinela (lo que sentiría un pedido) y el estado del heap.
using System.Buffers;
using System.Diagnostics;
using System.Diagnostics.Tracing;
using System.Runtime;
using System.Text.Json;

var args_ = args.Select(a => a.Split('=', 2)).ToDictionary(p => p[0], p => p.Length > 1 ? p[1] : "1");
string A(string k, string d) => args_.TryGetValue(k, out var v) ? v : d;
int I(string k, int d) => int.Parse(A(k, d.ToString()));
double D(string k, double d) => double.Parse(A(k, d.ToString(System.Globalization.CultureInfo.InvariantCulture)), System.Globalization.CultureInfo.InvariantCulture);

string escenario = A("escenario", "corta");
int dur = I("dur", 20);              // segundos
double rateMB = D("rate", 200);      // MB/s en total (todos los hilos)
int hilos = I("hilos", 2);
int obj = I("obj", 1024);            // bytes por objeto
int vidaMs = I("vida", 500);         // vida media de los objetos de vida media
int cacheMB = I("cache", 512);       // tamaño del caché de larga vida
string latencia = A("latencia", "");

if (latencia == "sustained") GCSettings.LatencyMode = GCLatencyMode.SustainedLowLatency;
if (latencia == "batch") GCSettings.LatencyMode = GCLatencyMode.Batch;

// ---- escucha de eventos del runtime: cada suspensión del motor de ejecución es una pausa que ven todos los hilos ----
var oyente = new OyenteGc();

// ---- caché de larga vida (para los escenarios que lo usan) ----
List<byte[]>? cache = null;
if (escenario is "cache" or "cache-corta" or "cache-media") {
    cache = new List<byte[]>(cacheMB * 1024);
    for (int i = 0; i < cacheMB * 1024; i++) cache.Add(new byte[1024 - 24]); // ~1 KB cada uno, ~1M objetos por GB
    GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect(); // que quede todo en gen2 antes de medir
}

// ---- base: contadores antes de empezar ----
oyente.Reiniciar();
long alloc0 = GC.GetTotalAllocatedBytes(true);
var pausa0 = GC.GetTotalPauseDuration();
int[] cnt0 = { GC.CollectionCount(0), GC.CollectionCount(1), GC.CollectionCount(2) };
var proc = Process.GetCurrentProcess();
var cpu0 = proc.TotalProcessorTime;
var sw = Stopwatch.StartNew();
long committedMax = 0;

// ---- centinela: un hilo que mira el reloj; cada hueco de más de 1 ms es un congelamiento que sintió ----
var congelamientos = new List<double>();
var parar = false;
var centinela = new Thread(() => {
    var reloj = Stopwatch.StartNew(); double ant = reloj.Elapsed.TotalMilliseconds;
    while (!Volatile.Read(ref parar)) {
        Thread.Yield();
        double ahora = reloj.Elapsed.TotalMilliseconds;
        if (ahora - ant > 1.0) lock (congelamientos) congelamientos.Add(ahora - ant);
        ant = ahora;
    }
}) { IsBackground = true, Priority = ThreadPriority.Highest };
centinela.Start();

// ---- trabajadores: asignan al ritmo pedido según el escenario ----
long[] hechos = new long[hilos];
var sinkRef = new object?[hilos * 16];
double bytesPorMsPorHilo = rateMB * 1024 * 1024 / 1000.0 / hilos;
var ts = new Thread[hilos];
for (int h = 0; h < hilos; h++) {
    int id = h;
    ts[h] = new Thread(() => Trabajar(id)) { IsBackground = true };
    ts[h].Start();
}
void Trabajar(int id) {
    var reloj = Stopwatch.StartNew();
    long bytes = 0; long n = 0;
    // anillo para objetos de vida media: se reemplaza una posición por asignación; cada objeto vive vidaMs
    object?[]? anillo = null; int pos = 0;
    if (escenario is "media" or "cache-media") {
        int porMs = Math.Max(1, (int)(bytesPorMsPorHilo / obj));
        anillo = new object?[Math.Max(1, porMs * vidaMs)];
    }
    List<byte[]>? crecer = escenario == "crecer" ? new List<byte[]>() : null;
    var pool = ArrayPool<byte>.Shared;
    var rnd = new Random(id);
    while (sw.Elapsed.TotalSeconds < dur) {
        switch (escenario) {
            case "corta": case "cache": case "cache-corta": case "latencia": {
                var b = new byte[obj - 24]; b[0] = 1; sinkRef[id * 16] = b; sinkRef[id * 16] = null; break; }
            case "media": case "cache-media": {
                var b = new byte[obj - 24]; b[0] = 1; anillo![pos] = b; pos = (pos + 1) % anillo.Length; break; }
            case "loh": {
                var b = new byte[obj]; b[0] = 1; sinkRef[id * 16] = b; sinkRef[id * 16] = null; break; }
            case "loh-pool": {
                var b = pool.Rent(obj); b[0] = 1; pool.Return(b); break; }
            case "finalizador": {
                var f = new ConFinalizador(); sinkRef[id * 16] = f; sinkRef[id * 16] = null; break; }
            case "crecer": {
                var b = new byte[obj - 24]; b[0] = 1; crecer!.Add(b); break; }
            case "nada": { Thread.Sleep(1); break; }
            default: throw new ArgumentException("escenario desconocido: " + escenario);
        }
        bytes += obj; n++;
        // ritmo: si vamos adelantados respecto del reloj, esperamos
        double deberia = reloj.Elapsed.TotalMilliseconds * bytesPorMsPorHilo;
        if (bytes > deberia + bytesPorMsPorHilo * 2) Thread.Sleep(1);
    }
    hechos[id] = n;
}
// mientras tanto, muestreamos la memoria comprometida
while (sw.Elapsed.TotalSeconds < dur) { Thread.Sleep(200); var mi = GC.GetGCMemoryInfo(); committedMax = Math.Max(committedMax, mi.TotalCommittedBytes); }
foreach (var t in ts) t.Join();
Volatile.Write(ref parar, true); centinela.Join();
double segundos = sw.Elapsed.TotalSeconds;
Thread.Sleep(300); // que lleguen los últimos eventos
var cpu1 = proc.TotalProcessorTime; proc.Refresh();

// ---- resultados ----
long alloc1 = GC.GetTotalAllocatedBytes(true);
var pausa1 = GC.GetTotalPauseDuration();
int[] cnt1 = { GC.CollectionCount(0), GC.CollectionCount(1), GC.CollectionCount(2) };
var info = GC.GetGCMemoryInfo(GCKind.Any);
var pausas = oyente.Pausas();
object Resumen(IEnumerable<double> xs) {
    var l = xs.OrderBy(x => x).ToList();
    if (l.Count == 0) return new { n = 0, sumMs = 0.0, maxMs = 0.0, p50Ms = 0.0, p99Ms = 0.0 };
    double P(double p) => l[Math.Min(l.Count - 1, (int)Math.Floor(p * l.Count))];
    return new { n = l.Count, sumMs = Math.Round(l.Sum(), 2), maxMs = Math.Round(l[^1], 2), p50Ms = Math.Round(P(0.5), 2), p99Ms = Math.Round(P(0.99), 2) };
}
long hechosTotal = hechos.Sum();
var salida = new {
    escenario, args = args_,
    config = new {
        server = GCSettings.IsServerGC, concurrente = Environment.GetEnvironmentVariable("DOTNET_gcConcurrent") != "0",
        datas = Environment.GetEnvironmentVariable("DOTNET_GCDynamicAdaptationMode") == "1",
        gen0size = Environment.GetEnvironmentVariable("DOTNET_GCgen0size"), hardLimit = Environment.GetEnvironmentVariable("DOTNET_GCHeapHardLimit"),
        latencia = GCSettings.LatencyMode.ToString(), cores = Environment.ProcessorCount, version = Environment.Version.ToString(),
    },
    segundos = Math.Round(segundos, 2),
    asignadoMB = Math.Round((alloc1 - alloc0) / 1048576.0, 1),
    asignadoMBs = Math.Round((alloc1 - alloc0) / 1048576.0 / segundos, 1),
    pedidoMBs = rateMB, objetos = hechosTotal, bytesObjeto = obj,
    colecciones = new { gen0 = cnt1[0] - cnt0[0] - (cnt1[1] - cnt0[1]), gen1 = cnt1[1] - cnt0[1] - (cnt1[2] - cnt0[2]), gen2 = cnt1[2] - cnt0[2] },
    pausaTotalMs = Math.Round((pausa1 - pausa0).TotalMilliseconds, 1),
    pausaPct = Math.Round((pausa1 - pausa0).TotalMilliseconds / (segundos * 1000) * 100, 2),
    cpuMs = Math.Round((cpu1 - cpu0).TotalMilliseconds, 0),
    pausas = new {
        gen0 = Resumen(pausas.Where(p => p.gen == 0).Select(p => p.ms)),
        gen1 = Resumen(pausas.Where(p => p.gen == 1).Select(p => p.ms)),
        gen2Bloqueante = Resumen(pausas.Where(p => p.gen == 2 && p.tipo != 1).Select(p => p.ms)),
        gen2Fondo = Resumen(pausas.Where(p => p.gen == 2 && p.tipo == 1).Select(p => p.ms)),
        todas = Resumen(pausas.Select(p => p.ms)),
        gen2FondoCount = pausas.Count(p => p.gen == 2 && p.tipo == 1 && p.inicio),
        motivos = pausas.GroupBy(p => p.motivo).ToDictionary(g => g.Key, g => g.Count()),
    },
    congelamientos = Resumen(congelamientos),
    heap = new {
        committedMaxMB = Math.Round(committedMax / 1048576.0, 1),
        heapMB = Math.Round(info.HeapSizeBytes / 1048576.0, 1),
        gen0MB = Math.Round(info.GenerationInfo[0].SizeAfterBytes / 1048576.0, 2),
        gen1MB = Math.Round(info.GenerationInfo[1].SizeAfterBytes / 1048576.0, 2),
        gen2MB = Math.Round(info.GenerationInfo[2].SizeAfterBytes / 1048576.0, 1),
        lohMB = Math.Round(info.GenerationInfo[3].SizeAfterBytes / 1048576.0, 1),
        pohMB = Math.Round(info.GenerationInfo[4].SizeAfterBytes / 1048576.0, 2),
        fragmentadoMB = Math.Round(info.FragmentedBytes / 1048576.0, 1),
        pausaPctRuntime = info.PauseTimePercentage,
    },
    cacheObjetos = cache?.Count ?? 0,
    muestraPausas = pausas.Take(4000).Select(p => new { t = Math.Round(p.t, 1), g = p.gen, k = p.tipo, ms = Math.Round(p.ms, 3), m = p.motivo }).ToList(),
    inicios = oyente.Inicios().Take(4000).Select(i => new { t = Math.Round(i.t, 1), n = i.numero, g = i.gen, m = i.motivo, k = i.tipo }).ToList(),
};
Console.WriteLine(JsonSerializer.Serialize(salida, new JsonSerializerOptions { WriteIndented = false }));
GC.KeepAlive(cache); GC.KeepAlive(sinkRef);

class ConFinalizador { public byte[] b = new byte[1000]; ~ConFinalizador() { b = null!; } }

/// Escucha los eventos de GC del runtime (keyword 0x1 de Microsoft-Windows-DotNETRuntime) y arma la lista de
/// suspensiones del motor: desde GCSuspendEEBegin hasta GCRestartEEEnd ningún hilo administrado corre.
sealed class OyenteGc : EventListener {
    record struct Pausa(double t, int gen, int tipo, double ms, string motivo, bool inicio);
    record struct Inicio(double t, int numero, int gen, int motivo, int tipo);
    readonly List<Pausa> lista = new(); readonly List<Inicio> inicios = new(); bool enFondo;
    DateTime? suspendio; int gen = -1, tipo = 0; string motivo = ""; bool primera;
    readonly DateTime origen = DateTime.UtcNow;
    protected override void OnEventSourceCreated(EventSource src) {
        if (src.Name == "Microsoft-Windows-DotNETRuntime") EnableEvents(src, EventLevel.Informational, (EventKeywords)0x1);
    }
    protected override void OnEventWritten(EventWrittenEventArgs e) {
        switch (e.EventName) {
            case "GCSuspendEEBegin_V1": lock (lista) { suspendio = e.TimeStamp; motivo = Convert.ToString(e.Payload![0]) ?? ""; gen = -1; tipo = 0; primera = false; } break;
            case "GCStart_V2": lock (lista) { int g = Convert.ToInt32(e.Payload![1]), k = Convert.ToInt32(e.Payload![3]); if (k == 1) { gen = 2; tipo = 1; primera = true; enFondo = true; } else if (!primera) { gen = g; tipo = k; } inicios.Add(new Inicio((e.TimeStamp - origen).TotalMilliseconds, Convert.ToInt32(e.Payload![0]), g, Convert.ToInt32(e.Payload![2]), k)); } break;
            case "GCEnd_V1": lock (lista) { if (Convert.ToInt32(e.Payload![1]) == 2 && enFondo) enFondo = false; } break;
            case "GCRestartEEEnd_V1": lock (lista) {
                if (suspendio is DateTime s) {
                    // motivo 6 = SuspendForGCPrep: la segunda pausa corta de un GC de fondo (no tiene GCStart propio).
                    // La primera pausa de un GC de fondo trae adentro un GCStart de tipo 1 y después uno efímero: se cuenta como gen2 de fondo.
                    int g = gen, k = tipo; if (motivo == "6") { g = 2; k = 1; }
                    lista.Add(new Pausa((s - origen).TotalMilliseconds, g, k, (e.TimeStamp - s).TotalMilliseconds, motivo, primera)); suspendio = null; primera = false;
                }
            } break;
        }
    }
    public void Reiniciar() { lock (lista) { lista.Clear(); inicios.Clear(); } }
    public List<(double t, int numero, int gen, int motivo, int tipo)> Inicios() { lock (lista) return inicios.Select(i => (i.t, i.numero, i.gen, i.motivo, i.tipo)).ToList(); }
    public List<(double t, int gen, int tipo, double ms, string motivo, bool inicio)> Pausas() { lock (lista) return lista.Select(p => (p.t, p.gen, p.tipo, p.ms, p.motivo, p.inicio)).ToList(); }
}
