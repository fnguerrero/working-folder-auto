# Por qué explota el p99

Un simulador de colas para entender la latencia de un backend. Elegís cuántos workers hay (hilos,
instancias, conexiones del pool), cuántos pedidos por segundo llegan y qué tan desparejos son los
tiempos de servicio, y ves la utilización, el p50, el p99, la espera en cola y cuántos pedidos
se rechazan si la cola tiene límite. Al lado, lo que dicen las fórmulas (Erlang C, Kingman y
Allen-Cunneen, Little) y un diagnóstico en criollo con qué podés hacer. Todo corre en el navegador.

**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/colas-p99/

**Estado:** terminado.

## Qué hay

- **Escenario**: workers (1 a 512), pedidos por segundo, tiempo de servicio promedio, distribución
  del servicio (exponencial, pareja, lognormal con coeficiente de variación elegible, bimodal con
  una fracción de pedidos N veces más lentos), cola máxima opcional y cantidad de pedidos a
  simular. Cinco presets: API típica, pool de la base, un consumidor de cola, al límite y con cola
  máxima. "Otra tirada" cambia la semilla; "Copiar link" arma una URL con todo el escenario.
- **Resultados**: utilización medida, p50, p99, p99,9, espera media en cola, rechazados, y una
  tabla "fórmula vs. simulado" (ρ, probabilidad de esperar, Wq, W, Lq y, con servicio exponencial,
  el p99 de la espera).
- **Diagnóstico**: zona verde, amarilla, roja o inestable con el porqué; la cuenta de Little con
  los números del escenario; aviso cuando la variabilidad es el problema; y acciones concretas con
  números (un worker más, un 10% menos de carga, achicar la cola de los lentos).
- **Tres gráficos** en canvas: la curva de latencia según utilización con los mismos workers (el
  "palo de hockey": media teórica, p50 y p99 simulados, con tu escenario marcado), el histograma
  de latencias con p50 y p99, y el largo de la cola a lo largo de la simulación.
- **Texto**: las tres ideas (la curva dobla al 70-80%, la variabilidad cuesta como la carga,
  Little), qué hacer con eso en un backend, qué es y qué no es el modelo, y fuentes.

## Cómo funciona

- `logica.js` tiene dos caminos independientes que deben coincidir:
  - **Teoría**: Erlang C para M/M/c (probabilidad de esperar y espera media) y la aproximación de
    Allen-Cunneen para otras distribuciones de servicio, que multiplica la espera por
    (ca² + cs²)/2 (con llegadas Poisson, ca² = 1). Little para Lq y L.
  - **Simulación** de eventos discretos: llegadas Poisson, una cola FIFO, c workers idénticos que
    toman el siguiente pedido apenas se liberan, con semilla reproducible (mulberry32). Descarta el
    primer 10% como calentamiento. Con cola máxima, el pedido que la encuentra llena se rechaza.
- La curva de utilización se calcula para 14 puntos de ρ con la misma cantidad de workers y
  distribución, con 20.000 a 60.000 pedidos por punto, y se cachea mientras no cambien esos
  parámetros (no depende de λ).

## Decisiones

- El modelo es M/G/c: no modela ráfagas correlacionadas, prioridades, servicio que se degrada con
  la carga ni colas encadenadas. El texto lo dice: es un piso, no un techo.
- Las fórmulas son exactas con servicio exponencial y aproximadas con las otras distribuciones;
  la tabla de comparación lo muestra en vez de esconderlo. Con cola máxima las fórmulas no aplican
  y se avisa.
- Los sliders de pedidos/s y de servicio son logarítmicos (0,5 a 5.000 pedidos/s, 1 ms a 10 s);
  el cuadro numérico al lado acepta más.
- Los percentiles a utilización muy alta tienen ruido estadístico real: en vez de suavizarlo,
  se ofrece subir la cantidad de pedidos o tirar de nuevo.
- Escenario en `localStorage` (dentro de try/catch) y también en la URL, para compartir.

## Cómo se prueba

Lógica pura, sin navegador (Erlang C contra valores de tabla, M/M/1 y M/D/1 contra las fórmulas
cerradas, simulación contra teoría con tolerancia, Little, cola máxima, percentiles, histograma,
diagnóstico, formatos):

```bash
node --test experimentos/colas-p99/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (presets, sliders, distribución, cola máxima,
otra tirada, URL, recarga, copiar link, modo oscuro, controles de 40 px, sin errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node experimentos/colas-p99/tests/e2e.js
```

## Archivos

```
index.html        interfaz, gráficos en canvas y texto
logica.js         distribuciones, Erlang C, Allen-Cunneen, simulación, diagnóstico; anda en el navegador y en Node
tests/            logica.test.js (node --test) y e2e.js (Playwright)
```
