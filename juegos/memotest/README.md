# Memotest de animales

Un memotest para Valentín. Las cartas están boca abajo; al tocar una se da vuelta y el animal hace su
sonido. Si las dos que están abiertas son el mismo animal, festejan (saltan, tiran estrellitas y suena un
arpegio) y se quedan abiertas con una estrella; si no, se cierran solas al segundo. Cuando aparecen
todos los pares cae confeti, las cartas bailan y aparece un botón grande para jugar de nuevo.
Sin puntaje, sin tiempo, sin perder y sin menú: se abre y ya hay cartas.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/memotest/

**Estado:** terminado.

## Qué hace

- **Ocho animales** dibujados en SVG, cada uno con su color de fondo: perro, gato, vaca, pato, león,
  oveja, chancho y pajarito. En cada partida se eligen al azar los que entran y se mezclan las cartas.
- **Tres tamaños**: 4, 6 u 8 pares, con los botones de arriba (una grilla de cartas en miniatura, para
  no tener que leer) o las teclas `4`, `6` y `8`. Arranca en 4 y el elegido se recuerda.
- **Cartas grandes**: el tablero busca la cantidad de columnas que deja las cartas más grandes en esa
  pantalla. En un celular de 360 px, con 8 pares, quedan de 80 × 116 px; con 6, de 109 × 158; con 4, de 159 px.
- **Sonido de cada animal sintetizado con WebAudio**, sin archivos: guau guau (diente de sierra con un
  pasabanda que sube y baja), miau (el tono sube y baja mientras el filtro pasa de «i» a «u»), muuu
  (grave, con vibrato lento), cuac cuac (onda cuadrada con un pasabanda angosto, nasal), el rugido de
  dibujito del león (trémolo rápido sobre un grave más ruido), beee (vibrato y trémolo rápidos), oinc
  oinc (cuadrada con trémolo de 38 Hz) y pío pío con trino. Todo pasa por un compresor.
  El botón 🔊/🔇 (o la tecla `M`) lo apaga y la elección se guarda.
- **Un toque nunca espera**: si hay dos distintas abiertas y se toca una tercera, las dos se cierran en
  el acto y se abre la nueva. Tocar una carta ya encontrada la hace sonar y saltar otra vez.
- **Multitáctil**: dos dedos a la vez dan vuelta dos cartas a la vez.
- **Teclado**: `Tab` y las flechas para moverse por las cartas, `Enter` o espacio para darlas vuelta.
- El confeti es un canvas que solo corre mientras hay algo cayendo y se pausa con la pestaña oculta.
  Respeta `prefers-reduced-motion` (sin giros ni bailes, menos confeti).

## Decisiones

- Sin pantalla de inicio: el audio se destraba con el primer toque sobre una carta, como exige el
  navegador, y ese mismo toque ya da vuelta la carta.
- Cartas como botones del DOM con un giro 3D de CSS en vez de dibujarlas en canvas: el lector de
  pantalla anuncia cada carta («Carta 3: vaca, encontrada») y el foco de teclado anda solo.
- Nada que suene a error: cuando dos cartas no coinciden se cierran con un «fiu» suave.
- Los toques van por `pointerdown` (responde al instante, también con varios dedos) y el teclado por el
  `click` sin puntero (`detail === 0`), así un mismo toque no cuenta dos veces.
- `touch-action: none`, `overscroll-behavior: none` y `user-scalable=no` para que los manotazos no hagan
  zoom ni scroll.

## Cómo se prueba

```bash
node --check <(sed -n '/<script>/,/<\/script>/p' juegos/memotest/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node juegos/memotest/tests/e2e.js
```

La prueba e2e corre en Chromium headless a 360×740 y a 1280×720: el tablero entra sin scroll con cartas
de al menos 72 px en los tres tamaños, cada animal aparece dos veces, la carta tocada se da vuelta y
pide el sonido de su animal, dos distintas siguen abiertas a los 0,7 s y cerradas a los 1,3 s, un par
queda abierto, festeja y tira chispas, una encontrada vuelve a sonar sin cerrarse, el tercer toque
cierra las dos anteriores, al terminar hay confeti, las cartas bailan y aparece el botón grande (que
reparte de nuevo), con 8 pares suenan los ocho animales, el tamaño y el sonido apagado se recuerdan
al recargar (y apagado ni siquiera se crea el audio), las flechas y `Enter` andan, la pestaña oculta
pausa el confeti y dos dedos a la vez (con eventos táctiles de CDP) dan vuelta dos cartas o encuentran
un par. Sin errores de consola ni pedidos afuera.

Lo que **no se pudo probar** en la nube: cómo suenan los animales (no hay salida de audio en headless;
la prueba solo verifica que cada sonido se pide y se arma sin errores) y si a Valentín le resultan
reconocibles. Si alguno no se parece, se ajusta su función en `SONIDOS`.
