using System.Text.RegularExpressions;
using BenchmarkDotNet.Attributes;

namespace Bench;

// Capítulo: Regex interpretada, compilada y generada.
public partial class Regexes
{
    private const string Patron = @"^(?<usuario>[\w.+-]+)@(?<dominio>[\w-]+(\.[\w-]+)+)$";
    private static readonly Regex _interpretada = new(Patron);
    private static readonly Regex _compilada = new(Patron, RegexOptions.Compiled);
    [GeneratedRegex(Patron)] private static partial Regex Generada();
    private readonly string[] _mails = Enumerable.Range(0, 100).Select(i => i % 4 == 0 ? $"nombre{i}.apellido" : $"nombre{i}.apellido@empresa{i % 7}.com.ar").ToArray();

    [Benchmark(Baseline = true)] public int Interpretada() { int n = 0; foreach (var m in _mails) if (_interpretada.IsMatch(m)) n++; return n; }
    [Benchmark] public int Compilada() { int n = 0; foreach (var m in _mails) if (_compilada.IsMatch(m)) n++; return n; }
    [Benchmark] public int Generada_() { int n = 0; foreach (var m in _mails) if (Generada().IsMatch(m)) n++; return n; }
    [Benchmark] public int RegexNuevaCadaVez() { int n = 0; foreach (var m in _mails) if (new Regex(Patron).IsMatch(m)) n++; return n; }
    [Benchmark] public int RegexEstatica() { int n = 0; foreach (var m in _mails) if (Regex.IsMatch(m, Patron)) n++; return n; }
    [Benchmark] public int AManoSinRegex() { int n = 0; foreach (var m in _mails) if (EsMail(m)) n++; return n; }
    private static bool EsMail(string s) { int at = s.IndexOf('@'); if (at <= 0 || at != s.LastIndexOf('@')) return false; int punto = s.IndexOf('.', at); return punto > at + 1 && punto < s.Length - 1; }
}
