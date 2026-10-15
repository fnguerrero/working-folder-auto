# Pecera

Una pecera para Valentín. Los peces nadan solos; si tocás el agua cae comida y van a buscarla, si
apoyás el dedo se acercan a curiosear, si tocás un pez da una vuelta carnero, si tocás una burbuja se
revienta y si tocás al cangrejo cierra las pinzas y sale corriendo. Cada tanto pasa una tortuga.
Sin puntaje, sin perder, sin menú: se abre y ya hay peces.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/pecera/

**Estado:** terminado.

## Qué hace

- **Peces** de ocho combinaciones de colores, con rayas o sin, distintos tamaños, que nadan con
  ondita, mueven la cola, parpadean y se dan vuelta cuando cambian de rumbo. Entre 5 y 8 al arrancar
  según el ancho de la pantalla; el botón **🐟 +1** (o la tecla `P`) suma uno que entra por la derecha,
  hasta 14 (después los más viejos se van).
- **Comida**: cada toque en el agua tira unas bolitas que se hunden despacio y los peces más cercanos
  se apuran a comerlas (abren la boca, hacen «ñam», sueltan una burbuja y se contonean). Las que
  llegan al fondo se quedan un rato y después desaparecen.
- **Dedo apoyado**: los peces se acercan y orbitan alrededor sin pegarse, con burbujitas. Multitáctil:
  cada dedo llama a los peces que tiene más cerca.
- **Cangrejo** caminando por la arena; tocarlo lo asusta: «clac» con las pinzas y sale disparado.
- **Tortuga** que cruza la pecera de vez en cuando (más o menos cada 45 segundos).
- **Burbujas** que suben de una piedra; tocarlas las revienta con un «blup».
- **Sonido con WebAudio**, sin archivos: burbuja (seno con barrido hacia arriba), comer (dos notitas
  en triángulo), dedo en el agua (ruido filtrado) y pinza (ruido corto agudo). El botón 🔊/🔇 (o la
  tecla `M`) lo apaga y la elección se guarda.
- **Teclado**: espacio o `Enter` tiran comida en un lugar al azar.
- Se pausa cuando la pestaña se oculta. Respeta `prefers-reduced-motion` (menos chispas y burbujas).

## Decisiones

- Nada de pantallas de inicio: lo que un nene de un año toca tiene que responder al instante. El audio
  se destraba con el primer toque, como exige el navegador.
- Los peces no «pierden» ni se mueren: la comida que sobra se disuelve sola.
- Canvas 2D con `devicePixelRatio` tope 2 para que no se arrastre en celulares viejos. Los peces se
  agrandan un poco en pantallas grandes.
- `touch-action: none`, `overscroll-behavior: none` y `user-scalable=no` para que los manotazos no
  hagan zoom ni scroll. Pointer Events con captura para seguir cada dedo aunque se salga del canvas.

## Cómo se prueba

```bash
node --check <(sed -n '/<script>/,/<\/script>/p' juegos/pecera/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node juegos/pecera/tests/e2e.js
```

La prueba e2e corre en Chromium headless a 360×740 y a 1280×720: canvas a pantalla completa sin
scroll, peces que nadan solos y dentro del agua, tocar tira comida y un pez se la come, tocar un pez
lo hace girar, el cangrejo cierra la pinza, el botón y la tecla suman peces con tope de 14, espacio
tira comida, el sonido apagado se recuerda al recargar, dos dedos a la vez atraen a los peces (con
eventos táctiles de CDP) y la pestaña oculta pausa el juego. Sin errores de consola.

Lo que **no se pudo probar** en la nube: el sonido en sí (no hay salida de audio en headless) y el
rendimiento real en un celular de gama baja.
