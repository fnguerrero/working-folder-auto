# Benchmarks

Proyecto .NET 8 con BenchmarkDotNet 0.14. Un archivo por grupo de capítulos; cada clase es una tabla del
escrito y el primer `[Benchmark]` de cada clase es la base (`Baseline = true`).

```bash
dotnet run -c Release -- --list flat            # los 129
dotnet run -c Release -- --filter '*Cadenas*'   # una clase
dotnet run -c Release -- --filter '*'           # todo: unos 45 minutos con ShortRun
python3 exportar.py . ../resultados.json        # BenchmarkDotNet.Artifacts/results/*-report-full.json → JSON compacto
node ../tablas.js                               # regenera las tablas de ../index.html
```

`Program.cs` define la configuración: `Job.ShortRun` (3 calentamientos, 5 iteraciones, 1 lanzamiento),
`MemoryDiagnoser`, exportador JSON completo y resumen conjunto.
