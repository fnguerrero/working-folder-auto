using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.CompilerServices;

namespace Cronometro;

public static class Casos
{
    static int _valor = 1_234_567;           // fuera del rango de Task<int> que el runtime ya tiene cacheados
    static int _contador;
    static readonly Task<int> TareaGuardada = Task.FromResult(1_234_567);

    // Convierte un bucle async en un caso: el hilo principal espera a que termine.
    static Caso A(string cap, string id, string nombre, Func<int, Task<long>> bucle, bool varios = false) =>
        new(cap, id, nombre, n => bucle(n).GetAwaiter().GetResult(), varios);

    // <codigo:await>
    [MethodImpl(MethodImplOptions.NoInlining)]
    static int Sincrono() => _valor;

    static async Task<int> AsyncSinEsperar() { await Task.CompletedTask; return _valor; }
    static async Task<int> AsyncAwaitTareaLista() => await TareaGuardada;
    static async Task<int> AsyncConYield() { await Task.Yield(); return _valor; }
    static async Task<int> AsyncConDelay() { await Task.Delay(1); return _valor; }
    // </codigo:await>

    // <codigo:valuetask>
    // Un método que casi siempre tiene el valor en caché.
    // "cada" = 1 de cada cuántas llamadas tiene que ir a buscarlo (0 = nunca).
    static bool EnCache(int cada) => cada == 0 || ++_contador % cada != 0;

    static async Task<int> LeerTask(int cada)
    {
        if (EnCache(cada)) return _valor;
        await Task.Yield(); return _valor;
    }

    static async ValueTask<int> LeerValueTask(int cada)
    {
        if (EnCache(cada)) return _valor;
        await Task.Yield(); return _valor;
    }

    // Sin "async" en el camino rápido: devuelve siempre la misma Task ya terminada.
    static Task<int> LeerTaskGuardada(int cada) => EnCache(cada) ? TareaGuardada : Buscar();
    static async Task<int> Buscar() { await Task.Yield(); return _valor; }

    [AsyncMethodBuilder(typeof(PoolingAsyncValueTaskMethodBuilder<>))]
    static async ValueTask<int> LeerValueTaskConPool(int cada)
    {
        if (EnCache(cada)) return _valor;
        await Task.Yield(); return _valor;
    }
    // </codigo:valuetask>

    // <codigo:configureawait>
    // "Biblioteca": diez esperas reales seguidas. El que la llama espera una sola vez.
    static async Task<int> DiezEsperas(bool seguirContexto)
    {
        int t = 0;
        for (int i = 0; i < 10; i++)
            t += await Task.Run(static () => 1).ConfigureAwait(seguirContexto);
        return t;
    }
    // </codigo:configureawait>

    // <codigo:asyncvoid>
    static int _acumulado;
    static async void NadaVoid() { await Task.CompletedTask; _acumulado++; }
    static async Task NadaTask() { await Task.CompletedTask; _acumulado++; }
    // </codigo:asyncvoid>

    // <codigo:taskrun>
    [MethodImpl(MethodImplOptions.NoInlining)]
    static int Trabajo(int vueltas)
    {
        int h = _valor;
        for (int i = 0; i < vueltas; i++) h = unchecked(h * 31 + i);
        return h;
    }
    static Task<int> Directo(int vueltas) => Task.FromResult(Trabajo(vueltas));
    static async Task<int> ConTaskRun(int vueltas) => await Task.Run(() => Trabajo(vueltas));
    // </codigo:taskrun>

    // <codigo:streaming>
    public sealed record Fila(int Id, int Monto);

    static async Task<List<Fila>> TraerLista(int total, int pagina)
    {
        var lista = new List<Fila>();
        for (int i = 0; i < total; i++)
        {
            if (pagina > 0 && i % pagina == 0) await Task.Yield();   // "llegó otra página"
            lista.Add(new Fila(i, i % 100));
        }
        return lista;
    }

    static async IAsyncEnumerable<Fila> Recorrer(int total, int pagina)
    {
        for (int i = 0; i < total; i++)
        {
            if (pagina > 0 && i % pagina == 0) await Task.Yield();
            yield return new Fila(i, i % 100);
        }
    }
    // </codigo:streaming>

    // <codigo:valuetaskmal>
    static ValueTask<int> Listo() => new(_valor);
    static async ValueTask<int> ListoAsync() { await Task.CompletedTask; return _valor; }

    [MethodImpl(MethodImplOptions.NoInlining)]
    static int Consumir(object o) => o is ValueTask<int> v ? v.Result & 1 : 0;
    // </codigo:valuetaskmal>

    public static IEnumerable<Caso> Todos(ContextoDeUnHilo ui)
    {
        const string c1 = "await";
        yield return new Caso(c1, "sincrono", "Método sincrónico", n => { long s = 0; for (int i = 0; i < n; i++) s += Sincrono(); return s; });
        yield return A(c1, "completado", "async + await Task.CompletedTask", async n => { long s = 0; for (int i = 0; i < n; i++) s += await AsyncSinEsperar(); return s; });
        yield return A(c1, "tarealista", "async + await de una Task ya terminada", async n => { long s = 0; for (int i = 0; i < n; i++) s += await AsyncAwaitTareaLista(); return s; });
        yield return A(c1, "yield", "await Task.Yield() (suspende de verdad)", async n => { long s = 0; for (int i = 0; i < n; i++) s += await AsyncConYield(); return s; }, true);
        yield return A(c1, "delay", "await Task.Delay(1) (timer)", async n => { long s = 0; for (int i = 0; i < n; i++) s += await AsyncConDelay(); return s; }, true);

        const string c2 = "valuetask";
        foreach (var (cada, etiqueta) in new[] { (0, "100"), (10, "90"), (1, "0") })
        {
            bool v = cada != 0;
            yield return A(c2, $"task{etiqueta}", $"{etiqueta} % en caché · async Task<int>", async n => { long s = 0; for (int i = 0; i < n; i++) s += await LeerTask(cada); return s; }, v);
            yield return A(c2, $"valuetask{etiqueta}", $"{etiqueta} % en caché · async ValueTask<int>", async n => { long s = 0; for (int i = 0; i < n; i++) s += await LeerValueTask(cada); return s; }, v);
            yield return A(c2, $"guardada{etiqueta}", $"{etiqueta} % en caché · Task guardada y reusada", async n => { long s = 0; for (int i = 0; i < n; i++) s += await LeerTaskGuardada(cada); return s; }, v);
            yield return A(c2, $"pool{etiqueta}", $"{etiqueta} % en caché · ValueTask con builder de pool", async n => { long s = 0; for (int i = 0; i < n; i++) s += await LeerValueTaskConPool(cada); return s; }, v);
        }

        const string c3 = "configureawait";
        foreach (var seguir in new[] { true, false })
        {
            string cfg = seguir ? "true" : "false";
            yield return A(c3, $"sin_{cfg}", $"Sin contexto (como ASP.NET Core) · ConfigureAwait({cfg})", async n => { long s = 0; for (int i = 0; i < n; i++) s += await DiezEsperas(seguir); return s; }, true);
            yield return new Caso(c3, $"ui_{cfg}", $"Contexto de un hilo (como la UI) · ConfigureAwait({cfg})",
                n => ui.Ejecutar(async () => { long s = 0; for (int i = 0; i < n; i++) s += await DiezEsperas(seguir); return s; }), true);
        }

        const string c5 = "asyncvoid";
        yield return new Caso(c5, "void", "async void", n => { for (int i = 0; i < n; i++) NadaVoid(); return _acumulado; });
        yield return A(c5, "task", "async Task con await", async n => { for (int i = 0; i < n; i++) await NadaTask(); return _acumulado; });

        const string c6 = "taskrun";
        foreach (var (vueltas, et) in new[] { (10, "chico"), (10_000, "grande") })
        {
            yield return A(c6, $"directo_{et}", $"Trabajo {et} · llamada directa", async n => { long s = 0; for (int i = 0; i < n; i++) s += await Directo(vueltas); return s; });
            yield return A(c6, $"run_{et}", $"Trabajo {et} · await Task.Run", async n => { long s = 0; for (int i = 0; i < n; i++) s += await ConTaskRun(vueltas); return s; }, true);
        }

        const string c7 = "streaming";
        foreach (var (pagina, et) in new[] { (0, "memoria"), (1000, "paginas") })
        {
            string pre = pagina == 0 ? "10.000 filas sin esperas" : "10.000 filas en páginas de 1.000";
            yield return A(c7, $"lista_{et}", $"{pre} · List<Fila>", async n => { long s = 0; for (int i = 0; i < n; i++) foreach (var f in await TraerLista(10_000, pagina)) s += f.Monto; return s; }, pagina > 0);
            yield return A(c7, $"stream_{et}", $"{pre} · IAsyncEnumerable<Fila>", async n => { long s = 0; for (int i = 0; i < n; i++) await foreach (var f in Recorrer(10_000, pagina)) s += f.Monto; return s; }, pagina > 0);
        }

        const string c8 = "valuetaskmal";
        yield return A(c8, "directo", "await de un ValueTask, como corresponde", async n => { long s = 0; for (int i = 0; i < n; i++) s += await Listo(); return s; });
        yield return A(c8, "asyncvt", "método async ValueTask que no espera", async n => { long s = 0; for (int i = 0; i < n; i++) s += await ListoAsync(); return s; });
        yield return A(c8, "astask", ".AsTask() antes del await", async n => { long s = 0; for (int i = 0; i < n; i++) s += await Listo().AsTask(); return s; });
        yield return new Caso(c8, "boxing", "ValueTask pasado como object (boxing)", n => { long s = 0; for (int i = 0; i < n; i++) s += Consumir(Listo()); return s; });
        yield return A(c8, "whenall", "Task.WhenAll de dos ValueTask (.AsTask())", async n => { long s = 0; for (int i = 0; i < n; i++) { var r = await Task.WhenAll(Listo().AsTask(), Listo().AsTask()); s += r[0]; } return s; });
        yield return A(c8, "dosawait", "dos ValueTask guardados y esperados en orden", async n => { long s = 0; for (int i = 0; i < n; i++) { var a = Listo(); var b = Listo(); s += await a; s += await b; } return s; });
    }

    // <codigo:deadlock>
    static async Task<int> Pide(bool seguirContexto)
    {
        await Task.Delay(50).ConfigureAwait(seguirContexto);
        return 1;
    }

    // En el hilo del contexto, bloquea con .Wait() esperando un método async. ¿Termina?
    static bool TerminaBloqueando(bool seguirContexto)
    {
        var ui = new ContextoDeUnHilo();        // un hilo descartable: puede quedar trabado para siempre
        var fin = new ManualResetEventSlim();
        ui.Post(_ => { Pide(seguirContexto).Wait(); fin.Set(); }, null);
        return fin.Wait(2000);
    }
    // </codigo:deadlock>

    /// <summary>Cosas que no son un tiempo por operación: comportamiento, primer elemento y memoria viva.</summary>
    public static async Task<object> Hechos(ContextoDeUnHilo ui)
    {
        // El -1 descuenta el Post que usa Ejecutar para entrar al hilo.
        int Posts(bool seguir) { int antes = ui.Posts; ui.Ejecutar(async () => (long)await DiezEsperas(seguir)); return ui.Posts - antes - 1; }

        var streaming = new List<object>();
        foreach (var modo in new[] { "lista", "stream" })
        {
            var primeros = new List<double>(); var totales = new List<double>(); var vivos = new List<double>();
            for (int rep = 0; rep < 5; rep++)
            {
                // Pasada 1: tiempos (sin tocar el GC en el medio).
                var sw = Stopwatch.StartNew(); double primero = 0; long suma = 0; int i = 0;
                if (modo == "lista")
                {
                    var l = await ListaLenta(100_000, 1000);
                    primero = sw.Elapsed.TotalMilliseconds;
                    foreach (var f in l) suma += f.Monto;
                }
                else
                {
                    await foreach (var f in StreamLento(100_000, 1000))
                    {
                        if (i++ == 0) primero = sw.Elapsed.TotalMilliseconds;
                        suma += f.Monto;
                    }
                }
                primeros.Add(primero); totales.Add(sw.Elapsed.TotalMilliseconds);

                // Pasada 2: bytes vivos cuando va por el último elemento (sin esperas).
                long base0 = GC.GetTotalMemory(true), vivo = 0;
                if (modo == "lista")
                {
                    var l = await TraerLista(100_000, 0);
                    foreach (var f in l) suma += f.Monto;
                    vivo = GC.GetTotalMemory(true) - base0; GC.KeepAlive(l);
                }
                else
                {
                    i = 0;
                    await foreach (var f in Recorrer(100_000, 0))
                    {
                        suma += f.Monto;
                        if (++i == 99_999) vivo = GC.GetTotalMemory(true) - base0;
                    }
                }
                vivos.Add(Math.Max(0, vivo)); Arnes.Sumidero += suma;
            }
            double Med(List<double> x) => Arnes.Cuantil(x.OrderBy(v => v).ToArray(), .5);
            streaming.Add(new { modo, primerElementoMs = Med(primeros), totalMs = Med(totales), bytesVivos = Med(vivos),
                muestrasPrimeroMs = primeros, muestrasTotalMs = totales, muestrasBytesVivos = vivos });
        }

        return new
        {
            postsPorLlamada = new { conTrue = Posts(true), conFalse = Posts(false) },
            deadlock = new { configureAwaitTrueTermina = TerminaBloqueando(true), configureAwaitFalseTermina = TerminaBloqueando(false) },
            streaming
        };
    }

    // Igual que arriba, pero cada página tarda lo que tarda un Task.Delay(5).
    static async Task<List<Fila>> ListaLenta(int total, int pagina)
    {
        var l = new List<Fila>();
        await foreach (var f in StreamLento(total, pagina)) l.Add(f);
        return l;
    }

    static async IAsyncEnumerable<Fila> StreamLento(int total, int pagina)
    {
        for (int i = 0; i < total; i++)
        {
            if (i % pagina == 0) await Task.Delay(5);
            yield return new Fila(i, i % 100);
        }
    }
}

/// <summary>Un SynchronizationContext de un solo hilo con su cola, como el de WinForms o WPF.</summary>
public sealed class ContextoDeUnHilo : SynchronizationContext
{
    readonly BlockingCollection<(SendOrPostCallback, object?)> _cola = new();
    public int Posts;

    public ContextoDeUnHilo()
    {
        new Thread(() =>
        {
            SetSynchronizationContext(this);
            foreach (var (f, s) in _cola.GetConsumingEnumerable()) f(s);
        }) { IsBackground = true }.Start();
    }

    public override void Post(SendOrPostCallback d, object? state) { Interlocked.Increment(ref Posts); _cola.Add((d, state)); }

    public long Ejecutar(Func<Task<long>> trabajo)
    {
        var tcs = new TaskCompletionSource<long>(TaskCreationOptions.RunContinuationsAsynchronously);
        Post(async _ => { try { tcs.SetResult(await trabajo()); } catch (Exception e) { tcs.SetException(e); } }, null);
        return tcs.Task.GetAwaiter().GetResult();
    }
}
