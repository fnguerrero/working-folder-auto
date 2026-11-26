# Cuentos para Valentín

Cinco cuentos cortos para leer de a dos desde el celular: seis páginas cada uno, un dibujo grande en SVG y una o dos oraciones en letra grande. Sin puntaje, sin derrota y sin nada que apure.

**Estado:** terminado.

| Cuento | De qué va | Para imprimir |
|---|---|---|
| ¿Quién hace muuu? | Los animales del campo y sus voces | [texto](cuentos/quien-hace-muuu.md) |
| La pelota roja | Se escapó la pelota: ¿dónde estará? | [texto](cuentos/la-pelota-roja.md) |
| Osito al agua | Del barro a la bañadera | [texto](cuentos/osito-al-agua.md) |
| La merienda de Osito | Frutas, colores y panza contenta | [texto](cuentos/la-merienda.md) |
| Hasta mañana | Para decirle chau al día antes de dormir | [texto](cuentos/hasta-maniana.md) |

## Cómo se usa

- Se pasa de página deslizando el dedo, con las flechas de la pantalla o con las del teclado.
- Tocar un dibujo lo hace saltar y sonar (la vaca hace «¡Muuu!»). Tocar el fondo hace sonar lo principal de la página.
- **Leer** lee la página en voz alta; el mismo botón pausa y sigue. Al seguir, retoma desde el comienzo de la frase interrumpida.
- 📢 hace que cada página se lea sola al pasarla. 🔔 apaga los sonidos.
- Teclado: espacio lee o pausa, Enter hace sonar el dibujo, Escape vuelve a la portada.
- Con `?mudo` en la dirección (`index.html?mudo`) no hay sonidos ni voz.

## Cómo se prueba

Publicado: https://fnguerrero.github.io/working-folder-auto/escritos/cuentos-para-valentin/

En local alcanza con abrir `index.html`. Las pruebas, desde esta carpeta y sin que suene nada:

```bash
node --test tests/datos.test.js
py -3 tests/e2e.py
```

La segunda necesita Playwright para Python (usa su Chromium o, si no está descargado, el Chrome instalado). Recorre todas las páginas a 360×640, 1366×768 y 740×360.

## Cómo está hecho

HTML, CSS y JavaScript sin dependencias ni archivos externos.

- `cuentos.js`: texto, composición del dibujo y sonidos de cada página.
- `dibujos.js`: personajes, fondos y objetos en SVG, reutilizables.
- `sonidos.js`: sonidos sintetizados con WebAudio.
- `voz.js`: lectura con `speechSynthesis`, prefiriendo una voz rioplatense o latinoamericana.
- `app.js` e `index.html`: portada, páginas y gestos.

Para sumar un cuento: agregarlo en `cuentos.js`, correr `node generar-md.js` (escribe los `.md`) y las pruebas.

## Qué no se pudo probar

- Cómo suenan los sonidos: se verificó que cada uno genera señal sin saturar, pero nadie los escuchó. Son sintetizados, así que los animales suenan a dibujito.
- La lectura en voz alta con voces reales: las pruebas usan una voz de mentira. La voz, el acento y la pronunciación de las onomatopeyas dependen de cada equipo; si no hay ninguna en español, conviene instalarla desde los ajustes del celular.
- Un celular de verdad (iPhone o Android): el táctil y los tamaños se probaron solo en navegador de escritorio emulando.
- No funciona sin conexión como app instalada (abierto en local, sí).
