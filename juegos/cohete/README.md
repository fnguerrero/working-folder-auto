# Cohete

Un cielo de noche con un cohete en la plataforma, para Valentín. Tocás el cohete y despega: tiembla,
larga humo y fuego, sube entre las estrellas y los planetas hasta la Luna, que se pone contenta y
canta una melodía cortita, y después baja despacio con un paracaídas de colores hasta la plataforma,
listo para otro viaje. Mientras tanto, cada estrella que tocás brilla y suena una nota, los planetas
giran y rebotan, deslizar el dedo deja una estrella fugaz, y cada tanto cruza un ovni o un cometa que
saludan si los tocás. Sin puntaje, sin perder, sin menú: se abre y ya está el cohete esperando.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/cohete/

**Estado:** terminado.

## Qué hace

- **Cohete**: tocarlo (o el botón **🚀 ¡Vamos!**, o espacio / `Enter`) arranca el viaje: 1,3 s de
  encendido con temblor y humo, subida con la cámara siguiéndolo y el cielo bajando con paralaje
  (tres capas de estrellas, planetas que pasan, un satélite que cruza), llegada a la **Luna**, que
  parpadea, sonríe, se pone colorada y suena una melodía de seis notas, y vuelta con **paracaídas**
  balanceándose hasta tocar el suelo con un «pof» y una nube de polvo. Si lo tocan en vuelo hace un
  «bip» y suelta chispas, nada más: el viaje no se interrumpe.
- **Estrellas** que titilan solas, de tres profundidades distintas. Tocar una la agranda con rayos y
  chispas y suena una nota de **campanita** (seno con armónicos y decaimiento largo) de la escala
  pentatónica de do mayor: cuanto más alta la estrella, más aguda la nota, y como es pentatónica
  cualquier combinación de dedos suena bien. **Multitáctil**: cada dedo, su estrella.
- Tocar el **cielo vacío** hace nacer una estrellita ahí mismo, con una nota más grave. Así todo
  toque responde.
- **Planetas** de colores (dos a la vista al arrancar, dos más durante la subida, algunos con anillo):
  tocarlos los hace girar y rebotar con un «boing».
- **Deslizar el dedo** por el cielo deja una estela de estrella fugaz con un «fiuuu».
- **Ovni** que cruza despacio cada tanto y, si lo tocan, se sacude, prende todas las luces y hace su
  sonido de ovni; **cometa** con carita que atraviesa el cielo y frena a saludar si lo tocan.
- **Luna**: cuando está en pantalla también se la puede tocar y se pone contenta.
- **Sonido con WebAudio**, sin archivos: campanita, rumble del motor (ruido grave filtrado que sube
  de tono mientras acelera), fiuuu (ruido con pasabanda que baja), boing, bip, ovni, pof y la
  melodía de la Luna. El botón 🔊/🔇 (o la tecla `M`) lo apaga y la elección se guarda.
- **Teclado**: espacio o `Enter` despegan; cualquier letra o número hace brillar y sonar una
  estrella al azar.
- Se pausa cuando la pestaña se oculta (y el motor se calla). Respeta `prefers-reduced-motion`
  (menos chispas, humo y estrellas).

## Decisiones

- Nada de pantallas de inicio ni de cuentas regresivas largas: un nene de un año necesita que lo que
  toca responda al instante. El audio se destraba con el primer toque, como exige el navegador.
- El mundo se mide en «altura sobre la plataforma» y cada cosa tiene una profundidad; la cámara sigue
  al cohete y las capas lejanas se mueven más despacio. Así el mismo código dibuja el cielo quieto y el
  viaje, y el humo queda atrás de verdad porque vive en coordenadas del mundo.
- El cohete no «tarda» en volver: ida y vuelta duran unos 15 segundos, suficiente para que se vea la
  Luna y vuelva antes de que el nene se aburra.
- Canvas 2D con `devicePixelRatio` tope 2 para que no se arrastre en celulares viejos; las figuras se
  agrandan un poco en pantallas grandes.
- `touch-action: none`, `overscroll-behavior: none` y `user-scalable=no` para que los manotazos no
  hagan zoom ni scroll. Pointer Events con captura para seguir cada dedo aunque se salga del canvas.

## Cómo se prueba

```bash
node --check <(sed -n '/<script>/,/<\/script>/p' juegos/cohete/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node juegos/cohete/tests/e2e.js
```

La prueba e2e corre en Chromium headless a 360×640 y a 1280×800: canvas a pantalla completa sin
scroll, estrellas y dos planetas a la vista, tocar una estrella la hace brillar con chispas, tocar un
planeta lo hace girar, tocar el cielo vacío crea una estrella, deslizar deja estela, tocar el cohete
pasa por encendido → subiendo → luna (contenta y en pantalla, con la cámara arriba) → bajando →
lista en la plataforma, tocarlo en vuelo hace chispas sin interrumpir, el botón y el teclado (espacio,
`Enter`, una letra, `M`) funcionan, el sonido apagado se recuerda al recargar, dos dedos a la vez
hacen brillar dos estrellas (con eventos táctiles de CDP) y la pestaña oculta pausa el juego. Sin
errores de consola.

Lo que **no se pudo probar** en la nube: el sonido en sí (no hay salida de audio en headless) y el
rendimiento real en un celular de gama baja.
