# Clementina y los que vinieron después

Historia corta de la computación en la Argentina (1958 a la Economía del Conocimiento): índice con línea de tiempo, siete capítulos, bibliografía con enlaces y un apartado con lo que no se pudo confirmar. Sale del [issue #12](https://github.com/fnguerrero/working-folder-auto/issues/12).

**Estado:** primera versión completa (26/11/2026).

## Cómo se prueba

- En línea, una vez publicado: https://fnguerrero.github.io/working-folder-auto/escritos/historia-computacion-argentina/
- En local: abrir `index.html`.

## Cómo se edita

El texto, las fuentes y la línea de tiempo están en `contenido.js`. Los HTML se generan, no se editan a mano:

```
node build.js
node tests/verificar.js
```

## Criterio

Cada dato lleva cita a una página abierta al redactar. Las contradicciones entre fuentes y los relatos van en recuadros aparte. Texto propio, sin dependencias ni recursos externos.

## Qué no se pudo probar o quedó afuera

- No se probó en un celular real: solo Edge sin ventana a 360 px y 1280 px.
- Los huecos de investigación están en `no-confirmado.html`.
