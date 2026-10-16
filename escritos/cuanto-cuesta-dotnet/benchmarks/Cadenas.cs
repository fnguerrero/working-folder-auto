using System.Globalization;
using System.Text;
using BenchmarkDotNet.Attributes;

namespace Bench;

// Capítulo: concatenar y armar texto.
public class Cadenas
{
    private readonly string[] _partes = Enumerable.Range(0, 20).Select(i => "parte" + i).ToArray();
    private readonly int _id = 4821; private readonly string _nombre = "Nicolás"; private readonly decimal _total = 1234.5m; private readonly DateTime _fecha = new(2026, 10, 16, 3, 0, 0);

    [Benchmark(Baseline = true)] public string ConcatEnBucle() { var s = ""; foreach (var p in _partes) s += p + ","; return s; }
    [Benchmark] public string StringBuilder_() { var sb = new StringBuilder(); foreach (var p in _partes) { sb.Append(p); sb.Append(','); } return sb.ToString(); }
    [Benchmark] public string StringJoin() => string.Join(",", _partes) + ",";

    [Benchmark] public string Interpolacion() => $"Pedido {_id} de {_nombre}: {_total} el {_fecha:yyyy-MM-dd}";
    [Benchmark] public string StringFormat() => string.Format("Pedido {0} de {1}: {2} el {3:yyyy-MM-dd}", _id, _nombre, _total, _fecha);
    [Benchmark] public string ConcatOperador() => "Pedido " + _id + " de " + _nombre + ": " + _total + " el " + _fecha.ToString("yyyy-MM-dd");
}

// Capítulo: comparar texto (cultura vs. ordinal).
public class Comparaciones
{
    private readonly string _a = "Facturación_2026_Octubre_Cliente_4821.pdf";
    private readonly string _b = "facturación_2026_octubre_cliente_4821.PDF";
    private readonly string[] _nombres = Enumerable.Range(0, 1000).Select(i => $"Archivo_{i:D5}_informe.pdf").ToArray();

    [Benchmark(Baseline = true)] public bool EqualsOrdinalIgnoreCase() => string.Equals(_a, _b, StringComparison.OrdinalIgnoreCase);
    [Benchmark] public bool ToLowerEquals() => _a.ToLower() == _b.ToLower();
    [Benchmark] public bool ToUpperInvariantEquals() => _a.ToUpperInvariant() == _b.ToUpperInvariant();
    [Benchmark] public bool EqualsCulturaIgnoreCase() => string.Equals(_a, _b, StringComparison.CurrentCultureIgnoreCase);

    [Benchmark] public int StartsWithDefault() { int n = 0; foreach (var s in _nombres) if (s.StartsWith("Archivo_00")) n++; return n; }
    [Benchmark] public int StartsWithOrdinal() { int n = 0; foreach (var s in _nombres) if (s.StartsWith("Archivo_00", StringComparison.Ordinal)) n++; return n; }
    [Benchmark] public int EndsWithDefault() { int n = 0; foreach (var s in _nombres) if (s.EndsWith(".pdf")) n++; return n; }
    [Benchmark] public int EndsWithOrdinal() { int n = 0; foreach (var s in _nombres) if (s.EndsWith(".pdf", StringComparison.Ordinal)) n++; return n; }
    [Benchmark] public int ContainsToLower() { int n = 0; foreach (var s in _nombres) if (s.ToLower().Contains("informe")) n++; return n; }
    [Benchmark] public int ContainsOrdinalIgnoreCase() { int n = 0; foreach (var s in _nombres) if (s.Contains("informe", StringComparison.OrdinalIgnoreCase)) n++; return n; }
}

// Capítulo: partir texto (Split vs Span).
public class Parseo
{
    private readonly string _linea = "4821;2026-10-16;1234.50;ARS;Nicolás;aprobado;3";
    private readonly string _csv = string.Join('\n', Enumerable.Range(0, 1000).Select(i => $"{i};2026-10-16;{i * 1.5:F2};ARS;Cliente {i};aprobado;{i % 7}"));

    [Benchmark(Baseline = true)] public decimal SplitYParse()
    {
        var c = _linea.Split(';');
        return int.Parse(c[0]) + decimal.Parse(c[2], CultureInfo.InvariantCulture) + int.Parse(c[6]);
    }
    [Benchmark] public decimal SpanYParse()
    {
        ReadOnlySpan<char> s = _linea;
        int p1 = s.IndexOf(';'); int id = int.Parse(s[..p1]);
        s = s[(p1 + 1)..]; s = s[(s.IndexOf(';') + 1)..];
        int p3 = s.IndexOf(';'); decimal total = decimal.Parse(s[..p3], CultureInfo.InvariantCulture);
        int cant = int.Parse(s[(s.LastIndexOf(';') + 1)..]);
        return id + total + cant;
    }
    [Benchmark] public decimal SplitMil()
    {
        decimal suma = 0;
        foreach (var linea in _csv.Split('\n')) { var c = linea.Split(';'); suma += decimal.Parse(c[2], CultureInfo.InvariantCulture); }
        return suma;
    }
    [Benchmark] public decimal SpanMil()
    {
        decimal suma = 0;
        ReadOnlySpan<char> resto = _csv;
        while (!resto.IsEmpty)
        {
            int fin = resto.IndexOf('\n');
            var linea = fin < 0 ? resto : resto[..fin];
            resto = fin < 0 ? ReadOnlySpan<char>.Empty : resto[(fin + 1)..];
            int p = linea.IndexOf(';'); linea = linea[(p + 1)..];
            p = linea.IndexOf(';'); linea = linea[(p + 1)..];
            p = linea.IndexOf(';'); suma += decimal.Parse(linea[..p], CultureInfo.InvariantCulture);
        }
        return suma;
    }
    [Benchmark] public int Substring_() { int n = 0; for (int i = 0; i < 100; i++) n += _linea.Substring(5, 10).Length; return n; }
    [Benchmark] public int AsSpanSlice() { int n = 0; for (int i = 0; i < 100; i++) n += _linea.AsSpan(5, 10).Length; return n; }
}
