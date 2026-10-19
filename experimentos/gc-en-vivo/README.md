# Por qué tu API se traba cada tanto: el GC en vivo

Un modelo del recolector de basura de .NET con reloj de 1 ms, en el navegador. Elegís cuánto asigna la app
(MB/s y tamaño de objeto), cuánto de eso sobrevive un rato y cuánto, si hay un caché grande vivo o una fuga,
si hay finalizadores o `ArrayPool`, cuántos núcleos, workstation, server o server con DATAS, con o sin GC de
fondo, el presupuesto de gen0, y cuántos pedidos por segundo de cuántos ms atiende. Muestra cada pausa en el
tiempo (gen0, gen1, gen2 bloqueante o de fondo), el heap por generación, las pausas por generación, el p99 de
los pedidos y un diagnóstico en criollo (crisis de la mediana edad, churn en el LOH, fuga, finalizadores,
gen2 bloqueantes…), con once escenarios listos. Y un texto: cómo funciona el GC en cinco párrafos, cómo verlo
en producción, qué hacer, y la tabla de lo medido en un .NET 8 de verdad.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/gc-en-vivo/

**Estado:** terminado.

## Lo medido

`real/Program.cs` corre en un .NET 8 real (Docker, `mcr.microsoft.com/dotnet/sdk:8.0`, 4 vCPU): asigna al
ritmo pedido desde dos hilos según el escenario (vida corta, vida media con un anillo, caché de larga vida,
LOH con y sin `ArrayPool`, finalizadores, fuga), un `EventListener` sobre `Microsoft-Windows-DotNETRuntime`
(keyword GC) registra cada suspensión del motor (`GCSuspendEEBegin` → `GCRestartEEEnd`, atribuida a la
generación y al tipo del `GCStart`; la primera pausa de un GC de fondo incluye un gen1 y se cuenta como de
fondo, y la segunda llega con motivo `SuspendForGCPrep`), y un hilo centinela anota cada hueco de más de
1 ms. Al final imprime un JSON con las colecciones, las pausas por generación (mediana, p99, máxima, total),
los congelamientos, `GC.GetTotalPauseDuration()`, `GC.GetGCMemoryInfo()` y la lista de pausas.
`real/escenarios.sh` corre las 36 corridas (workstation, `DOTNET_gcConcurrent=0`, `DOTNET_gcServer=1`,
DATAS, `DOTNET_GCgen0size` de 4 y 256 MB, `SustainedLowLatency`); `tablas.js` las compacta en
`resultados-real.json` y genera la tabla de `index.html`. Las constantes del modelo (`K` y `PRESUPUESTOS`
en `logica.js`) están ajustadas a mano contra esas corridas; la sección «Contrastado» de la página dice qué
salió y qué copia el modelo.

Para repetirlo (hace falta Docker; el script pasa el proxy y el certificado al contenedor):

```bash
cd experimentos/gc-en-vivo/real
./docker.sh "dotnet build -c Release"
./docker.sh ./escenarios.sh          # ~12 minutos, deja salida/*.json
node ../tablas.js                    # resultados-real.json y la tabla de la página
```

## Cómo se prueba

```bash
node --test experimentos/gc-en-vivo/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' experimentos/gc-en-vivo/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node experimentos/gc-en-vivo/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

Doce tests del modelo (sin asignar no hay GC; gen0 por presupuesto y a medio milisegundo; vida media con
gen1, gen2 de fondo y diagnóstico; caché quieto gratis y caché más promoción caro; fuga sin concurrente con
gen2 bloqueantes proporcionales al heap; LOH, pool y 80 KB; fuga que crece; server y DATAS; finalizadores;
latencia de los pedidos; presupuesto de gen0) y un e2e que recorre escenarios, cifras, gráficos, diagnóstico,
controles, modo, memoria al recargar, la tabla real y las fuentes. `localStorage` va dentro de try/catch.

Lo que **no se pudo probar**: lo mismo en Windows, con más núcleos o con regiones distintas de memoria; el
modelo no tiene card table, compactar/barrer, ajuste dinámico del gen0 (salvo el de DATAS, simplificado) ni
pinning, y las vidas de los objetos son todas iguales. En otra máquina los presupuestos cambian (el de gen0
depende del caché del procesador): la tabla dice lo que dio acá.

## Archivos

```
index.html            la página (la tabla entre <!-- tabla:real --> y <!-- /tabla --> la genera tablas.js)
logica.js             el modelo: simular(), diagnosticar(), ESCENARIOS, K, PRESUPUESTOS
tablas.js             compacta real/salida/*.json en resultados-real.json y genera la tabla
resultados-real.json  lo medido, compactado
real/                 Program.cs, GcReal.csproj, escenarios.sh, docker.sh y salida/ con un JSON por corrida
tests/                logica.test.js y e2e.js
```
