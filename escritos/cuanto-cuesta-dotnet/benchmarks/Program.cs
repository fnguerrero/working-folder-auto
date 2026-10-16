using BenchmarkDotNet.Configs;
using BenchmarkDotNet.Diagnosers;
using BenchmarkDotNet.Exporters.Json;
using BenchmarkDotNet.Jobs;
using BenchmarkDotNet.Running;

var config = ManualConfig.Create(DefaultConfig.Instance)
    .AddJob(Job.ShortRun.WithWarmupCount(3).WithIterationCount(5))
    .AddDiagnoser(MemoryDiagnoser.Default)
    .AddExporter(JsonExporter.Full)
    .WithOptions(ConfigOptions.JoinSummary | ConfigOptions.DisableLogFile);

BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args, config);
