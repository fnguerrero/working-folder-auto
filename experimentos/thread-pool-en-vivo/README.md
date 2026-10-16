# Por qué se cuelga tu API: el thread pool en vivo

Un simulador del thread pool de .NET para ver con los ojos la inanición (*thread pool starvation*):
elegís núcleos, pedidos por segundo, cuánto tarda la I/O y cómo la esperás (`await`, `.Result` o I/O
sincrónica), en qué runtime (.NET 6+ o anterior) y con qué `SetMinThreads`, y ves cómo el pool va
agregando hilos, cuánto se encola, cuánto tarda cada pedido y qué hace cada hilo a lo largo del
tiempo. Con un diagnóstico en criollo, las cuentas de servilleta y un texto sobre cómo funciona el
pool, qué cambió en .NET 6, cómo detectarlo en producción y qué hacer.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/thread-pool-en-vivo/

**Estado:** terminado. La segunda noche (2026-10-16) se contrastó contra un .NET 8 real y se corrigió el
modelo: ver «Contrastado contra un .NET 8 de verdad» abajo.

## Qué hay

- **Escenario**: núcleos (= hilos mínimos), pedidos por segundo, I/O en ms, CPU antes y después de la
  I/O, cómo se espera la I/O (`await` / `.Result` / sincrónica), runtime (.NET 6+ o clásico),
  `SetMinThreads`, tráfico constante o con una ráfaga a los 2 s, y segundos simulados. Ocho presets:
  el clásico `.Result` en .NET Core 3.1, lo mismo en .NET 8, async de punta a punta, I/O sincrónica en
  .NET 8, el parche `SetMinThreads(64)`, «en tu PC anda, en el pod de 2 vCPU explota», pico de tráfico
  bloqueando y «la base se puso lenta». «Otra tirada» cambia la semilla; «Copiar link» arma una URL
  con todo.
- **Resultados**: p50, p99, máximo, hilos como máximo y bloqueados a la vez, pico de la cola y cuándo
  volvió a cero, CPU promedio, pedidos terminados.
- **Diagnóstico**: zona (ok, degradado, inanición, colapso), título, por qué pasa con los números del
  escenario (hilos necesarios por Little, segundos de inyección a un hilo cada 500 ms, pedidos
  acumulados) y qué hacer (incluido el `SetMinThreads` concreto como parche).
- **Tres gráficos** en canvas: hilos del pool / bloqueados / en CPU con la cola en el eje derecho;
  p50 y p99 de los pedidos que terminan en cada momento con el mínimo posible; y un diagrama con una
  fila por hilo (corriendo, bloqueado, libre) que muestra la «escalera» de la inyección.
- **Las cuentas de servilleta** en una tabla y un **texto**: qué es el thread pool y por qué la API
  depende de él, las tres formas de esperar la I/O (con código malo y bueno), qué cambió en .NET 6 y
  por qué es un airbag y no una solución, cómo saber si te está pasando en producción
  (`dotnet-counters`, `dotnet-stack`, eventos), qué hacer, qué es y qué no es el modelo, y fuentes.

## Cómo funciona el modelo

`logica.js` es una simulación con reloj de 1 ms que sigue las reglas documentadas del
`PortableThreadPool`:

- Cada pedido es un work item: CPU antes de la I/O, la I/O, CPU después. Con `await` el hilo se libera
  durante la I/O y la continuación vuelve a la cola como otro work item; con `.Result` o I/O
  sincrónica el hilo queda bloqueado.
- Hilos mínimos = núcleos (o `SetMinThreads`), creados sin demora cuando hay trabajo.
- **Inyección sin aviso de bloqueo**: cada `inyeccionMs` (500 por defecto, el gate thread documentado;
  1.800 en el preset medido), si hay cola y todos los hilos están ocupados, un hilo más.
- **.NET 6+ y `Task.Wait`**: cuando un hilo se bloquea en `.Result` / `.Wait()` el pool sube la meta a
  mínimo + bloqueados y crea hilos sin demora hasta 1,25 × núcleos por encima del mínimo, y después
  de a 0,25 × núcleos con pausas de 25 ms que crecen hasta 250 ms (las constantes de
  `PortableThreadPool.Blocking.cs`). La I/O sincrónica, `lock` y `Thread.Sleep` no avisan.
- **Finalización por la cola del pool** (`finalizacionPorPool`, default `true`, solo con `.Result`): cuando
  la I/O de un hilo bloqueado termina, su finalización es un work item más que va al final de la cola FIFO;
  el hilo bloqueado despierta recién cuando un hilo libre lo corre. Es lo que pasa con los timers
  (`Task.Delay`) y con los sockets en Linux y en Windows desde .NET 7. Con `false` el hilo despierta solo
  (IOCP en Windows antes de .NET 7): es el modelo «optimista» de la primera versión.
- La CPU se reparte: si corren más hilos que núcleos, cada uno avanza proporcionalmente más lento.
- Hilos de más que llevan 20 s libres se retiran. Llegadas Poisson, I/O con ±20 % uniforme, semilla
  reproducible (mulberry32).

**No modela** el hill climbing, la presión de memoria sobre la inyección, el ajuste del gate thread por
uso de CPU, el costo de los cambios de contexto ni las colas locales por hilo. Los números son del
modelo; las formas de las curvas y los órdenes de magnitud son los de un servidor real.

## Contrastado contra un .NET 8 de verdad

En `real/` está una consola .NET 8 (`Program.cs`) que reproduce los escenarios contra el thread pool real:
un hilo propio genera pedidos con llegadas Poisson y los encola en el `ThreadPool`; cada pedido quema
2 ms de CPU, espera 100 ms de I/O (`await Task.Delay`, `Task.Delay(…).Wait()`, `Thread.Sleep`, o las tres
variantes con `HttpClient` contra `servidor-lento.js`, un Node que tarda 100 ms) y quema 1 ms más; otro
hilo muestrea cada 100 ms `ThreadPool.ThreadCount`, `PendingWorkItemCount`, pedidos en curso y latencias.
Corrió en Docker (`mcr.microsoft.com/dotnet/sdk:8.0`, 2 vCPU por `cpuset`), 30 s por escenario, con
`escenarios.sh`. Los resultados tal cual, junto con lo que da el modelo para los mismos parámetros, están
en `real/resultados-real.json`, y resumidos en la tabla de la página.

Lo que salió:

- **Async** y **SetMinThreads** se comportan como el modelo (p99 ≈ I/O, hilos mínimos; 24 hilos y sin cola).
- **I/O sincrónica**: la forma es la del modelo pero el pool crece más lento de lo que decía: un hilo cada
  1,5 a 2 s, no cada 500 ms. El gate thread exige que *nadie* haya sacado nada de la cola en 500 ms, y con
  hilos que se bloquean 100 ms y vuelven eso no pasa; lo que crece el pool es el hill climbing. Con
  `inyeccionMs = 1800` el modelo da p99 de 7,0 s contra 7,2 s real (100 pedidos/s), 5,0 s contra 5,3 s
  (ráfaga) y 2,7 s contra 2,9 s (50 pedidos/s, 90 s), con la misma cantidad de hilos y la misma cola pico.
- **`.Result` en .NET 8**: la primera versión del modelo decía que la detección de bloqueos lo salvaba.
  Es falso. Con `Task.Delay(100).Wait()` a 100 pedidos/s en 2 núcleos el pool llegó a 129 hilos y contestó
  286 pedidos de 3.005 en 30 s; con `HttpClient…Result` y con `HttpClient.Send` sincrónico, 132 hilos y
  **cero** pedidos contestados. La finalización de la I/O es un work item que va al final de la cola, detrás
  de los pedidos; cada hilo nuevo toma un pedido y se bloquea también. El modelo ahora lo reproduce con
  `finalizacionPorPool`, con un umbral más optimista que el real (a 50 pedidos/s el .NET real se clavó a
  los 2 s y el modelo aguanta; a 70 se clavan los dos).

Para repetirlo en tu máquina (hace falta el SDK de .NET 8 y Node):

```bash
node experimentos/thread-pool-en-vivo/real/servidor-lento.js 100 18081 &
cd experimentos/thread-pool-en-vivo/real && dotnet build -c Release
dotnet bin/Release/net8.0/ThreadPoolReal.dll modo=result rps=100 dur=30   # async | result | sync | http-async | http-result | http-sync
```

En Windows, `http-result` debería degradar en vez de clavarse solo en .NET 6 (desde .NET 7 las
finalizaciones de IOCP también pasan por la cola del pool); `result` sobre `Task.Delay` se clava en
cualquier .NET Core. No se midió en Windows ni con más de 2 núcleos.

## Cómo se prueba

```bash
node --test experimentos/thread-pool-en-vivo/tests/logica.test.js
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' experimentos/thread-pool-en-vivo/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node experimentos/thread-pool-en-vivo/tests/e2e.js
```

Los 15 tests de la lógica verifican: semilla reproducible; las cuentas (Little, capacidades, hilos
que faltan); que con `await` los hilos se quedan en el mínimo y el throughput iguala la carga; que
en el clásico la inyección va a 2 hilos por segundo, la cola llega a lo que dice la cuenta y se
recupera; que la I/O sincrónica en .NET 6+ se comporta igual que el clásico; que `.Result` en .NET 6+ con la
finalización por la cola se clava aunque inyecte más de 100 hilos (y con poca carga anda), y que sin ella
(modelo optimista) inyecta rápido y baja el p99 a milisegundos; que `inyeccionMs = 1800` frena la
inyección y las cuentas lo reflejan; que `SetMinThreads` alto funciona; colapso
por CPU aunque sea async; la ráfaga que se traba bloqueando y pasa con async; conservación de
pedidos; y el diagrama de hilos. El e2e corre en Chromium headless a 360×740 y 1280×720: presets,
diagnóstico, controles, gráficos dibujados, otra tirada, link que reproduce la tirada, sin errores de
consola y sin scroll horizontal, la casilla de finalización y el preset medido con la tabla real vs. modelo.

Lo que **no se pudo probar**: el experimento real en Windows, en .NET Framework / .NET Core 3.1 (el preset
«El clásico» sigue siendo modelo), ni con más de 2 núcleos.
