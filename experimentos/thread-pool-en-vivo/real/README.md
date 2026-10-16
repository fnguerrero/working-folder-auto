# Medición contra el thread pool real

`Program.cs` reproduce un escenario del simulador contra el `ThreadPool` de .NET 8. Ver el README del
proyecto, sección «Contrastado contra un .NET 8 de verdad». `resultados-real.json` tiene lo medido
(10 escenarios, 2 vCPU, 30 s cada uno) y lo que da el modelo con los mismos parámetros.

```bash
node servidor-lento.js 100 18081 &          # para los escenarios http-*
dotnet build -c Release
dotnet bin/Release/net8.0/ThreadPoolReal.dll modo=sync rps=100 dur=30
# modo = async | result | sync | http-async | http-result | http-sync
# otros: io=100 cpu=2 cpu2=1 min=0 rafaga=0 semilla=1 url=http://127.0.0.1:18081/
```

`escenarios.sh` corre los diez escenarios de la página (está pensado para correr dentro de
`mcr.microsoft.com/dotnet/sdk:8.0` con `--network host --cpuset-cpus=2,3`).
