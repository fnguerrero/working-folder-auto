using System.Collections;
using BenchmarkDotNet.Attributes;

namespace Bench;

// Capítulo: excepciones como control de flujo.
public class Excepciones
{
    private readonly string[] _entradas = Enumerable.Range(0, 100).Select(i => i % 10 == 0 ? "abc" : i.ToString()).ToArray(); // 10 % inválidas
    private readonly string[] _todasMalas = Enumerable.Range(0, 100).Select(_ => "abc").ToArray();

    [Benchmark(Baseline = true)] public int TryParse10PorCiento() { int s = 0; foreach (var e in _entradas) if (int.TryParse(e, out var n)) s += n; return s; }
    [Benchmark] public int ParseConCatch10PorCiento() { int s = 0; foreach (var e in _entradas) { try { s += int.Parse(e); } catch (FormatException) { } } return s; }
    [Benchmark] public int TryParseTodasMalas() { int s = 0; foreach (var e in _todasMalas) if (int.TryParse(e, out var n)) s += n; return s; }
    [Benchmark] public int ParseConCatchTodasMalas() { int s = 0; foreach (var e in _todasMalas) { try { s += int.Parse(e); } catch (FormatException) { } } return s; }
    [Benchmark] public int UnThrowCatch() { try { throw new InvalidOperationException("no"); } catch (InvalidOperationException) { return 1; } }
    [Benchmark] public int UnThrowCatchProfundo() => Nivel(20);
    private static int Nivel(int n) { if (n == 0) { try { throw new InvalidOperationException("no"); } catch (InvalidOperationException) { return 1; } } return Nivel(n - 1) + 1; }
}

// Capítulo: boxing, struct vs class, closures y params.
public struct PuntoStruct { public double X, Y; public PuntoStruct(double x, double y) { X = x; Y = y; } }
public class PuntoClass { public double X, Y; public PuntoClass(double x, double y) { X = x; Y = y; } }

public class Asignaciones
{
    private readonly int[] _nums = Enumerable.Range(0, 1000).ToArray();

    [Benchmark(Baseline = true)] public long ListGenerica() { var l = new List<int>(1000); foreach (var n in _nums) l.Add(n); long s = 0; foreach (var n in l) s += n; return s; }
    [Benchmark] public long ArrayListBoxing() { var l = new ArrayList(1000); foreach (var n in _nums) l.Add(n); long s = 0; foreach (var o in l) s += (int)o!; return s; }
    [Benchmark] public string ConcatBoxeaInt() { var n = 42; return string.Concat("n=", n); }
    [Benchmark] public string ConcatSinBoxeo() { var n = 42; return string.Concat("n=", n.ToString()); }

    [Benchmark] public double MilStructs() { var a = new PuntoStruct[1000]; for (int i = 0; i < a.Length; i++) a[i] = new PuntoStruct(i, i); double s = 0; for (int i = 0; i < a.Length; i++) s += a[i].X; return s; }
    [Benchmark] public double MilClases() { var a = new PuntoClass[1000]; for (int i = 0; i < a.Length; i++) a[i] = new PuntoClass(i, i); double s = 0; for (int i = 0; i < a.Length; i++) s += a[i].X; return s; }

    [Benchmark] public int LambdaSinCaptura() { int s = 0; for (int i = 0; i < 100; i++) s += Aplicar(i, static x => x * 2); return s; }
    [Benchmark] public int LambdaConCaptura() { int s = 0; int factor = 2; for (int i = 0; i < 100; i++) s += Aplicar(i, x => x * factor); return s; }
    private static int Aplicar(int x, Func<int, int> f) => f(x);

    [Benchmark] public int ParamsArray() { int s = 0; for (int i = 0; i < 100; i++) s += Suma(i, 1, 2); return s; }
    [Benchmark] public int SobrecargaFija() { int s = 0; for (int i = 0; i < 100; i++) s += Suma3(i, 1, 2); return s; }
    private static int Suma(params int[] xs) { int s = 0; foreach (var x in xs) s += x; return s; }
    private static int Suma3(int a, int b, int c) => a + b + c;
}

// Capítulo: enums.
public enum EstadoPedido { Pendiente, Aprobado, Enviado, Entregado, Cancelado }

public class Enums
{
    private readonly EstadoPedido[] _estados = Enumerable.Range(0, 100).Select(i => (EstadoPedido)(i % 5)).ToArray();
    private readonly string[] _nombres = Enumerable.Range(0, 100).Select(i => ((EstadoPedido)(i % 5)).ToString()).ToArray();
    private static readonly Dictionary<EstadoPedido, string> _cache = Enum.GetValues<EstadoPedido>().ToDictionary(e => e, e => e.ToString());
    private static readonly Dictionary<string, EstadoPedido> _cacheParse = Enum.GetValues<EstadoPedido>().ToDictionary(e => e.ToString(), e => e);

    [Benchmark(Baseline = true)] public int EnumToString() { int n = 0; foreach (var e in _estados) n += e.ToString().Length; return n; }
    [Benchmark] public int SwitchANombre() { int n = 0; foreach (var e in _estados) n += Nombre(e).Length; return n; }
    [Benchmark] public int DiccionarioCache() { int n = 0; foreach (var e in _estados) n += _cache[e].Length; return n; }
    [Benchmark] public int EnumParse() { int n = 0; foreach (var s in _nombres) n += (int)Enum.Parse<EstadoPedido>(s); return n; }
    [Benchmark] public int DiccionarioParse() { int n = 0; foreach (var s in _nombres) n += (int)_cacheParse[s]; return n; }
    [Benchmark] public int EnumIsDefined() { int n = 0; foreach (var e in _estados) if (Enum.IsDefined(e)) n++; return n; }
    private static string Nombre(EstadoPedido e) => e switch { EstadoPedido.Pendiente => "Pendiente", EstadoPedido.Aprobado => "Aprobado", EstadoPedido.Enviado => "Enviado", EstadoPedido.Entregado => "Entregado", EstadoPedido.Cancelado => "Cancelado", _ => "?" };
}
