# El tren

Para Valentín. Un tren de colores (locomotora roja y tres vagones con una oveja, un chancho y una gallina) que
anda por el campo, larga humo, pasa por un túnel y por una barrera que baja y hace ding-ding. Tocás el tren y
silba (y el maquinista saluda); tocás el sol y se ríe y tira chispas; tocás una nube y llueve un rato con cara de
nube; tocás una vaca y muge; tocás una flor y salta; tocás el cielo y pasa un pájaro cantando; tocás el pasto y
brota una flor nueva. Sin puntaje, sin derrota, sin menú: una pantalla y a tocar. En la compu, espacio o Enter
hacen silbar al tren.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/tren/

**Estado:** terminado.

## Cómo está hecho

Un `index.html` autocontenido: canvas a pantalla completa con `pointerdown` (anda con dedos y con mouse), todo
dibujado con primitivas (los animales de los vagones son emoji del sistema) y sonido sintetizado con WebAudio:
silbato de tres notas con armónico, chucu-chucu de ruido filtrado, campana, mugido de diente de sierra con
filtro pasabajos y glissando, lluvia de ruido blanco pasaaltos, trino de pájaro y la risa del sol en arpegio. El
botón de arranque existe solo para habilitar el audio en el celular. `?rapido` en la URL acelera el tren (lo usa
el test).

## Cómo se prueba

```bash
sed -n '/^<script>$/,/^<\/script>$/p' juegos/tren/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node juegos/tren/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

El e2e arranca el juego, comprueba que el tren avanza y larga humo, que no hay scroll, y que cada toque hace lo
suyo (silbato, sol, nube con lluvia que después para, vaca, pájaro, flor, barra espaciadora), sin errores de
consola ni pedidos afuera. No se pudo probar el sonido más allá de que no tire errores: Chromium headless no
reproduce audio.
