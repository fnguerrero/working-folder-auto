# El caché en vivo

«Por qué el 90 % de aciertos no alcanza, cuánto caché hace falta de verdad y por qué se te cae la base cuando
vence una clave caliente.» Un simulador de caché en el navegador: elegís el catálogo (10 mil a un millón de
claves), cuán concentrada es la popularidad (Zipf, de parejo a muy concentrado), el tamaño del caché, cuántas
claves se piden una sola vez (un scan, bots), si la popularidad rota (trending), el TTL (absoluto o deslizante,
como `AbsoluteExpiration` y `SlidingExpiration`), los pedidos por segundo y lo que cuesta un hit y un miss. Corre
el mismo tráfico contra siete políticas (LRU, LFU, FIFO, aleatorio, LRU muestreado de a 5 como Redis, compactación
del 5 % como `MemoryCache` de .NET, y el óptimo de Belady que conoce el futuro) y muestra el hit rate, lo que
llega al backend, la latencia media y el p99, **cuántas entradas hacen falta para el 90, 95 y 99 %**, el hit rate
contra el tamaño (simulado y según la **aproximación de Che**, que coincide a menos de dos puntos), el hit rate a
lo largo de la simulación y un diagnóstico en criollo. Aparte, **la estampida**: unas claves calientes que vencen
juntas, con y sin protección (single flight, refresco temprano, TTL con jitter), con las consultas al backend cada
100 ms, el pico en vuelo y el p99 de la espera. Seis escenarios. Texto: cómo funciona un caché en cinco párrafos,
la estampida, cómo se traduce a .NET (`GetOrCreateAsync` que no es atómico, `HybridCache`, `SizeLimit` que descarta
entradas sin avisar, `ExpirationScanFrequency`, `maxmemory-policy` de Redis, BitFaster) y qué es y qué no es.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/cache-en-vivo/

**Estado:** terminado.

## Cómo funciona

`logica.js`: generador de trazas (Zipf por acumulada y búsqueda binaria, claves de una sola vez, rotación por
escalones del 1 % del catálogo), las siete políticas implementadas tal cual (LRU y FIFO con un `Map` ordenado, LFU
exacto con baldes por frecuencia y desempate LRU, aleatorio, muestreo de 5 por último acceso, compactación de a 5 %,
Belady con el próximo uso precalculado y un montículo), TTL absoluto o deslizante con expiración activa cada
TTL/4 pedidos, la aproximación de Che para LRU (tiempo característico T por bisección; con TTL deslizante la entrada
vive min(T, TTL); con TTL absoluto, una clave con tasa p acierta p·TTL/(1 + p·TTL), y con el caché lleno lo que
sea menor entre eso y el término de Che), las entradas necesarias para un hit rate (una sola bisección sobre T), la
estampida (modelo de a milisegundo con llegadas Poisson y backend de latencia fija) y el diagnóstico. La página
corre la simulación en un Web Worker (`worker.js`) y, si se abre como archivo local, en el hilo principal. Los
gráficos son canvas a mano. Todo queda en `localStorage` (dentro de try/catch).

## Qué salió

Con 100.000 claves, α = 0,9 y 5.000 entradas (5 % del catálogo): LRU 51 %, la fórmula 51,5 %, LFU 55 %, Belady 65 %;
para el 95 % hacen falta 77.000 entradas y para el 99 %, 95.000: con esta concentración el caché chico rinde mucho
y después cada punto cuesta carísimo. Con 30 % de claves de una sola vez, LFU le saca 6 puntos a LRU; con la
popularidad rotando cada 5.000 pedidos, LRU le saca 16 a LFU. TTL de 30 s a 2.000 pedidos/s: absoluto 45 %,
deslizante 50 %. Estampida de 10 claves a 200 pedidos/s con backend de 80 ms y TTL 10 s: sin protección 300 y pico
consultas al backend en 30 s con 158 en vuelo a la vez; single flight 20 y pico 10; refresco temprano 100 % de
aciertos; jitter desarma el pico pero no baja las consultas.

## Cómo se prueba

```bash
node --test experimentos/cache-en-vivo/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' experimentos/cache-en-vivo/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node experimentos/cache-en-vivo/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

Siete tests (Zipf y trazas; las políticas sobre trazas chicas con la respuesta calculada a mano, Belady como techo,
Redis ≈ LRU; Che contra LRU simulado con y sin TTL en los dos modos y con novedades, a menos de 2 puntos; entradas
para un hit rate; scan donde gana LFU y rotación donde gana LRU; la estampida con las cuatro protecciones; `correrTodo`
y el diagnóstico) y un e2e que recorre el escenario por defecto, las siete políticas con Belady arriba, los cuatro
gráficos dibujados, el scan, el trending, el TTL absoluto contra deslizante, agrandar el caché, la estampida con
refresco temprano y la memoria al recargar.

Lo que **no se pudo probar**: contra un `MemoryCache` o un Redis de verdad (esta noche no había .NET ni Docker en
la nube). Los detalles de cada uno (compactar el 5 %, muestrear 5 claves, el escaneo de vencidos cada minuto,
`GetOrCreateAsync` sin atomicidad) salen de su código fuente y su documentación, no de una medición.
