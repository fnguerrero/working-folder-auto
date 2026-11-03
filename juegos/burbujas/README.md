# Burbujas

Un juego para Valentín: burbujas grandes y transparentes suben despacio; al tocarlas explotan en gotitas
de colores con un «plop» (más grave cuanto más grande la burbuja). Cada tanto sale una burbuja con un
animal adentro (perro, gato, pato, chancho o pollito): al explotar se queda saludando un rato y hace su
sonido. Tocar el vacío también hace una burbujita que explota. Sin puntaje, sin final, sin perder.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/burbujas/

**Estado:** terminado (sugerencia #19).

## Detalles

- Un `index.html` autocontenido: canvas a pantalla completa, sonido sintetizado con WebAudio, sin archivos ni dependencias.
- Multitáctil: cada dedo explota la suya. Zona de toque un poco más grande que la burbuja.
- Botón 🔊/🔇 (o tecla `M`); la elección se guarda en `localStorage` (con try/catch).
- Teclado: espacio o Enter explota la burbuja más baja.
- Las burbujas que se escapan por arriba se van sin que pase nada.

## Cómo se probó

`node juegos/burbujas/tests/e2e.js` (Playwright, Chromium) a 360×740 con toques y a 1280×720 con mouse:
carga sin errores ni pedidos externos, sin scroll, explota y suena, el vacío suena, el animal saluda,
el silencio se recuerda al recargar. Captura revisada a 360 px.

**No se pudo probar:** el sonido real por parlantes (solo se verifica que se dispare) ni en un celular de verdad;
tampoco con un bebé de un año.
