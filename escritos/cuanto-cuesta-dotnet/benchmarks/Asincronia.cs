using BenchmarkDotNet.Attributes;

namespace Bench;

// Capítulo: lo que cuesta async cuando no hace falta, y lo que cuesta cuando sí.
public class Asincronia
{
    private readonly Dictionary<int, int> _cache = Enumerable.Range(0, 100).ToDictionary(i => i, i => i * 2);

    private int Sync(int k) => _cache[k];
    private Task<int> TaskFromResult(int k) => Task.FromResult(_cache[k]);
    #pragma warning disable CS1998
    private async Task<int> AsyncSinAwait(int k) => _cache[k];
#pragma warning restore CS1998
    private async Task<int> AsyncConAwaitCompletado(int k) => await TaskFromResult(k);
    private ValueTask<int> ValueTaskSync(int k) => new(_cache[k]);
    private async ValueTask<int> ValueTaskAsync(int k) => await ValueTaskSync(k);
    private async Task<int> AsyncConYield(int k) { await Task.Yield(); return _cache[k]; }

    [Benchmark(Baseline = true)] public int Sincronico() { int s = 0; for (int i = 0; i < 100; i++) s += Sync(i); return s; }
    [Benchmark] public async Task<int> TaskFromResult_() { int s = 0; for (int i = 0; i < 100; i++) s += await TaskFromResult(i); return s; }
    [Benchmark] public async Task<int> AsyncQueCompletaSincronico() { int s = 0; for (int i = 0; i < 100; i++) s += await AsyncSinAwait(i); return s; }
    [Benchmark] public async Task<int> AsyncConAwaitYaCompletado() { int s = 0; for (int i = 0; i < 100; i++) s += await AsyncConAwaitCompletado(i); return s; }
    [Benchmark] public async ValueTask<int> ValueTaskSincronica() { int s = 0; for (int i = 0; i < 100; i++) s += await ValueTaskSync(i); return s; }
    [Benchmark] public async ValueTask<int> ValueTaskAsincronica() { int s = 0; for (int i = 0; i < 100; i++) s += await ValueTaskAsync(i); return s; }
    [Benchmark] public async Task<int> TaskYield100() { int s = 0; for (int i = 0; i < 100; i++) s += await AsyncConYield(i); return s; }
    [Benchmark] public async Task<int> TaskRun100() { int s = 0; for (int i = 0; i < 100; i++) s += await Task.Run(() => _cache[i]); return s; }
    [Benchmark] public int ResultBloqueante100() { int s = 0; for (int i = 0; i < 100; i++) s += Task.Run(() => _cache[i]).Result; return s; }
    [Benchmark] public async Task<int> WhenAll100() { var ts = new Task<int>[100]; for (int i = 0; i < 100; i++) { var k = i; ts[i] = Task.Run(() => _cache[k]); } var r = await Task.WhenAll(ts); int s = 0; foreach (var x in r) s += x; return s; }
}

// Capítulo: compartir estado entre hilos.
public class Concurrencia
{
    private readonly object _candado = new();
    private int _contador;
    private readonly Dictionary<int, int> _dic = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<int, int> _cdic = new();
    private readonly Random _rnd = new(1);

    [Benchmark(Baseline = true)] public int SumaSinSincronizar() { _contador = 0; for (int i = 0; i < 1000; i++) _contador++; return _contador; }
    [Benchmark] public int LockIncrement() { _contador = 0; for (int i = 0; i < 1000; i++) lock (_candado) _contador++; return _contador; }
    [Benchmark] public int InterlockedIncrement() { _contador = 0; for (int i = 0; i < 1000; i++) Interlocked.Increment(ref _contador); return _contador; }
    [Benchmark] public int DictionaryConLock() { int s = 0; for (int i = 0; i < 1000; i++) { lock (_candado) { if (!_dic.TryGetValue(i % 100, out var v)) { v = i; _dic[i % 100] = v; } s += v; } } return s; }
    [Benchmark] public int ConcurrentDictionaryGetOrAdd() { int s = 0; for (int i = 0; i < 1000; i++) s += _cdic.GetOrAdd(i % 100, i); return s; }
    [Benchmark] public int ConcurrentDictionaryGetOrAddConLambda() { int s = 0; for (int i = 0; i < 1000; i++) s += _cdic.GetOrAdd(i % 100, k => k * 2); return s; }
    [Benchmark] public int LockContencion4Hilos()
    {
        int total = 0;
        Parallel.For(0, 4, new ParallelOptions { MaxDegreeOfParallelism = 4 }, _ => { for (int i = 0; i < 250; i++) lock (_candado) total++; });
        return total;
    }
    [Benchmark] public int InterlockedContencion4Hilos()
    {
        int total = 0;
        Parallel.For(0, 4, new ParallelOptions { MaxDegreeOfParallelism = 4 }, _ => { for (int i = 0; i < 250; i++) Interlocked.Increment(ref total); });
        return total;
    }
}
