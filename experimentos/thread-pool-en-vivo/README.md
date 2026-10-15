# Por qué se cuelga tu API: el thread pool en vivo

Un simulador del thread pool de .NET para ver con los ojos la inanición (*thread pool starvation*):
elegís núcleos, pedidos por segundo, cuánto tarda la I/O y cómo la esperás (`await`, `.Result` o I/O
sincrónica), en qué runtime (.NET 6+ o anterior) y con qué `SetMinThreads`, y ves cómo el pool va
agregando hilos, cuánto se encola, cuánto tarda cada pedido y qué hace cada hilo a lo largo del
tiempo. Con un diagnóstico en criollo, las cuentas de servilleta y un texto sobre cómo funciona el
pool, qué cambió en .NET 6, cómo detectarlo en producción y qué hacer.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/thread-pool-en-vivo/

**Estado:** terminado.

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
- **Gate thread**: cada 500 ms, si hay cola y todos los hilos están ocupados, un hilo más.
- **.NET 6+ y `Task.Wait`**: cuando un hilo se bloquea en `.Result` / `.Wait()` el pool sube la meta a
  mínimo + bloqueados y crea hilos sin demora hasta 1,25 × núcleos por encima del mínimo, y después
  de a 0,25 × núcleos con pausas de 25 ms que crecen hasta 250 ms (las constantes de
  `PortableThreadPool.Blocking.cs`). La I/O sincrónica, `lock` y `Thread.Sleep` no avisan.
- La CPU se reparte: si corren más hilos que núcleos, cada uno avanza proporcionalmente más lento.
- Hilos de más que llevan 20 s libres se retiran. Llegadas Poisson, I/O con ±20 % uniforme, semilla
  reproducible (mulberry32).

**No modela** el hill climbing, la presión de memoria sobre la inyección, el ajuste del gate thread por
uso de CPU, el costo de los cambios de contexto ni las colas locales por hilo. Los números son del
modelo; las formas de las curvas y los órdenes de magnitud son los de un servidor real.

## Cómo se prueba

```bash
node --test experimentos/thread-pool-en-vivo/tests/logica.test.js
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' experimentos/thread-pool-en-vivo/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node experimentos/thread-pool-en-vivo/tests/e2e.js
```

Los 13 tests de la lógica verifican: semilla reproducible; las cuentas (Little, capacidades, hilos
que faltan); que con `await` los hilos se quedan en el mínimo y el throughput iguala la carga; que
en el clásico la inyección va a 2 hilos por segundo, la cola llega a lo que dice la cuenta y se
recupera; que la I/O sincrónica en .NET 6+ se comporta igual que el clásico; que `.Result` en .NET 6+
inyecta rápido y baja el p99 de segundos a milisegundos; que `SetMinThreads` alto funciona; colapso
por CPU aunque sea async; la ráfaga que se traba bloqueando y pasa con async; conservación de
pedidos; y el diagrama de hilos. El e2e corre en Chromium headless a 360×740 y 1280×720: presets,
diagnóstico, controles, gráficos dibujados, otra tirada, link que reproduce la tirada, sin errores de
consola y sin scroll horizontal.

Lo que **no se pudo probar** esta noche: contrastar el modelo contra un .NET real. En la nube no se
pudo instalar el SDK (la descarga está bloqueada) ni levantar Docker. Para hacerlo en tu máquina: una
API mínima con un endpoint que haga `Thread.Sleep(100)` (o `Task.Delay(100).Wait()`), 200 pedidos/s
con `bombardier -c 200 -r 200 -d 30s` y `dotnet-counters monitor System.Runtime` al lado; tendrían
que verse `threadpool-thread-count` subiendo de a uno cada 500 ms y `threadpool-queue-length`
inflándose, como en el gráfico.
