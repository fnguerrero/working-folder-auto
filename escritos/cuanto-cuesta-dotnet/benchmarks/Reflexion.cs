using System.Linq.Expressions;
using System.Reflection;
using BenchmarkDotNet.Attributes;

namespace Bench;

// Capítulo: reflexión, expresiones compiladas, delegados, virtuales e interfaces.
public class Reflexion
{
    private readonly PedidoDto _p = new() { Total = 99.5m };
    private readonly PropertyInfo _prop = typeof(PedidoDto).GetProperty(nameof(PedidoDto.Total))!;
    private readonly Func<PedidoDto, decimal> _compilado;
    private readonly Func<PedidoDto, decimal> _delegado;
    public Reflexion()
    {
        var x = Expression.Parameter(typeof(PedidoDto));
        _compilado = Expression.Lambda<Func<PedidoDto, decimal>>(Expression.Property(x, _prop), x).Compile();
        _delegado = (Func<PedidoDto, decimal>)Delegate.CreateDelegate(typeof(Func<PedidoDto, decimal>), _prop.GetGetMethod()!);
    }
    [Benchmark(Baseline = true)] public decimal Directo() { decimal s = 0; for (int i = 0; i < 100; i++) s += _p.Total; return s; }
    [Benchmark] public decimal GetValueReflexion() { decimal s = 0; for (int i = 0; i < 100; i++) s += (decimal)_prop.GetValue(_p)!; return s; }
    [Benchmark] public decimal GetPropertyCadaVez() { decimal s = 0; for (int i = 0; i < 100; i++) s += (decimal)typeof(PedidoDto).GetProperty("Total")!.GetValue(_p)!; return s; }
    [Benchmark] public decimal ExpresionCompilada() { decimal s = 0; for (int i = 0; i < 100; i++) s += _compilado(_p); return s; }
    [Benchmark] public decimal CreateDelegate() { decimal s = 0; for (int i = 0; i < 100; i++) s += _delegado(_p); return s; }
    [Benchmark] public decimal DynamicCast() { decimal s = 0; dynamic d = _p; for (int i = 0; i < 100; i++) s += d.Total; return s; }
}

public interface ICalc { int Calc(int x); }
public class CalcBase { public virtual int Calc(int x) => x + 1; public int CalcNoVirtual(int x) => x + 1; }
public sealed class CalcSellada : CalcBase, ICalc { public override int Calc(int x) => x + 2; }
public class CalcAbierta : CalcBase, ICalc { public override int Calc(int x) => x + 3; }

public class Llamadas
{
    private readonly CalcBase _base = new CalcBase();
    private readonly CalcBase _comoBase = new CalcAbierta();
    private readonly CalcSellada _sellada = new();
    private readonly ICalc _interfaz = new CalcAbierta();
    private readonly Func<int, int> _func = x => x + 1;
    [Benchmark(Baseline = true)] public int NoVirtual() { int s = 0; for (int i = 0; i < 1000; i++) s += _base.CalcNoVirtual(i); return s; }
    [Benchmark] public int Virtual() { int s = 0; for (int i = 0; i < 1000; i++) s += _comoBase.Calc(i); return s; }
    [Benchmark] public int Sellada() { int s = 0; for (int i = 0; i < 1000; i++) s += _sellada.Calc(i); return s; }
    [Benchmark] public int Interfaz() { int s = 0; for (int i = 0; i < 1000; i++) s += _interfaz.Calc(i); return s; }
    [Benchmark] public int Delegado() { int s = 0; for (int i = 0; i < 1000; i++) s += _func(i); return s; }
}
