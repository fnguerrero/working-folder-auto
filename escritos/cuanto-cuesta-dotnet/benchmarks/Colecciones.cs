using BenchmarkDotNet.Attributes;

namespace Bench;

public record Pedido(int Id, int ClienteId, decimal Total, string Estado);

// Capítulo: listas, capacidad y LINQ.
public class Colecciones
{
    private readonly int[] _numeros = Enumerable.Range(0, 1000).ToArray();
    private readonly List<int> _lista = Enumerable.Range(0, 1000).ToList();
    private readonly List<Pedido> _pedidos = Enumerable.Range(0, 1000).Select(i => new Pedido(i, i % 50, i * 10.5m, i % 3 == 0 ? "aprobado" : "pendiente")).ToList();

    [Benchmark(Baseline = true)] public List<int> ListSinCapacidad() { var l = new List<int>(); for (int i = 0; i < 1000; i++) l.Add(i); return l; }
    [Benchmark] public List<int> ListConCapacidad() { var l = new List<int>(1000); for (int i = 0; i < 1000; i++) l.Add(i); return l; }

    [Benchmark] public long ForSobreArray() { long s = 0; for (int i = 0; i < _numeros.Length; i++) s += _numeros[i]; return s; }
    [Benchmark] public long ForeachSobreList() { long s = 0; foreach (var n in _lista) s += n; return s; }
    [Benchmark] public long LinqSum() => _lista.Sum(n => (long)n);
    [Benchmark] public long ForeachSobreIEnumerable() { long s = 0; IEnumerable<int> e = _lista; foreach (var n in e) s += n; return s; }

    [Benchmark] public decimal LinqWhereSelectSum() => _pedidos.Where(p => p.Estado == "aprobado").Select(p => p.Total).Sum();
    [Benchmark] public decimal BucleWhereSelectSum() { decimal s = 0; foreach (var p in _pedidos) if (p.Estado == "aprobado") s += p.Total; return s; }
    [Benchmark] public List<decimal> LinqWhereSelectToList() => _pedidos.Where(p => p.Estado == "aprobado").Select(p => p.Total).ToList();

    [Benchmark] public bool AnySobreList() => _pedidos.Any();
    [Benchmark] public bool CountMayorQueCero() => _pedidos.Count > 0;
    [Benchmark] public int LinqCount() => _pedidos.Count(p => p.Estado == "aprobado");
    [Benchmark] public Pedido OrderByFirst() => _pedidos.OrderBy(p => p.Total).First();
    [Benchmark] public Pedido MinBy_() => _pedidos.MinBy(p => p.Total)!;
}

// Capítulo: buscar por clave.
public class Busquedas
{
    private readonly List<Pedido> _lista = Enumerable.Range(0, 1000).Select(i => new Pedido(i, i % 50, i * 10.5m, "ok")).ToList();
    private readonly Dictionary<int, Pedido> _dic;
    private readonly int[] _claves = Enumerable.Range(0, 100).Select(i => i * 10).ToArray();
    public Busquedas() { _dic = _lista.ToDictionary(p => p.Id); }

    [Benchmark(Baseline = true)] public int ListFind100() { int n = 0; foreach (var k in _claves) if (_lista.Find(p => p.Id == k) is not null) n++; return n; }
    [Benchmark] public int ListFirstOrDefault100() { int n = 0; foreach (var k in _claves) if (_lista.FirstOrDefault(p => p.Id == k) is not null) n++; return n; }
    [Benchmark] public int Dictionary100() { int n = 0; foreach (var k in _claves) if (_dic.TryGetValue(k, out _)) n++; return n; }
    [Benchmark] public int ToDictionaryYBuscar100() { var d = _lista.ToDictionary(p => p.Id); int n = 0; foreach (var k in _claves) if (d.TryGetValue(k, out _)) n++; return n; }
    [Benchmark] public int JoinLinq100() => _claves.Join(_lista, k => k, p => p.Id, (k, p) => p).Count();
}

// Capítulo: struct como clave de diccionario.
public struct ClaveSinEquatable { public int A; public int B; }
public struct ClaveConEquatable : IEquatable<ClaveConEquatable>
{
    public int A; public int B;
    public bool Equals(ClaveConEquatable o) => A == o.A && B == o.B;
    public override bool Equals(object? o) => o is ClaveConEquatable c && Equals(c);
    public override int GetHashCode() => HashCode.Combine(A, B);
}
public readonly record struct ClaveRecord(int A, int B);

public class ClavesStruct
{
    private readonly Dictionary<ClaveSinEquatable, int> _sin = new();
    private readonly Dictionary<ClaveConEquatable, int> _con = new();
    private readonly Dictionary<ClaveRecord, int> _rec = new();
    private readonly Dictionary<(int, int), int> _tupla = new();
    public ClavesStruct()
    {
        for (int i = 0; i < 1000; i++) { _sin[new ClaveSinEquatable { A = i, B = i * 2 }] = i; _con[new ClaveConEquatable { A = i, B = i * 2 }] = i; _rec[new ClaveRecord(i, i * 2)] = i; _tupla[(i, i * 2)] = i; }
    }
    [Benchmark(Baseline = true)] public int StructSinEquatable() { int s = 0; for (int i = 0; i < 1000; i++) s += _sin[new ClaveSinEquatable { A = i, B = i * 2 }]; return s; }
    [Benchmark] public int StructConEquatable() { int s = 0; for (int i = 0; i < 1000; i++) s += _con[new ClaveConEquatable { A = i, B = i * 2 }]; return s; }
    [Benchmark] public int RecordStruct() { int s = 0; for (int i = 0; i < 1000; i++) s += _rec[new ClaveRecord(i, i * 2)]; return s; }
    [Benchmark] public int TuplaValor() { int s = 0; for (int i = 0; i < 1000; i++) s += _tupla[(i, i * 2)]; return s; }
}
