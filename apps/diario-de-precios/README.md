# Diario de precios

Anotás el precio de lo que comprás siempre y ves tu propia inflación al lado del número oficial.
PWA sin servidor, sin cuentas y sin red: HTML, CSS y JavaScript puro, datos en `localStorage`.

**Estado:** terminado. La prueba de punta a punta pasó a 360 px, a 1280 px en tema oscuro y abierta como archivo; falta probarla en un celular real.

Link: https://fnguerrero.github.io/working-folder-auto/apps/diario-de-precios/

## Qué hace

- **Anotar:** tocás un producto, escribís el precio y Enter (o «Sigue igual»). Permite fechas pasadas. Un precio por producto y por día.
- **Productos:** nombre, unidad y cantidad que comprás por mes (su peso en la canasta; con 0 no cuenta).
- **Ficha:** gráfico SVG del precio en el tiempo, variación contra el mes pasado y contra hace un año, historial.
- **Canasta:** tu inflación mensual e interanual contra la oficial que cargás a mano, qué producto aportó cuánto, qué quedó afuera y los últimos 12 meses.
- **Alertas:** un producto que en dos meses subió al menos 10 %, el doble que el resto de la canasta y 10 puntos más (hacen falta otros dos productos comparables).
- **Datos:** copia completa en JSON (reemplaza al importar), CSV de productos y precios (se suma al importar), deshacer y datos de ejemplo inventados.

## Cómo calcula

- El precio de un mes es el **último anotado** hasta el cierre de ese mes (o hasta hoy).
- Un precio sirve como referencia hasta **62 días** después. Para comparar hace falta además un precio posterior a la base: un mismo dato nunca da un 0 % falso.
- La canasta usa cantidades fijas: `Σ cantidad × precio actual / Σ cantidad × precio base − 1`. Solo entran los productos con precio en las dos puntas, y la pantalla dice cuántos son y qué parte del gasto cubren.
- Las cantidades son las de hoy: si las cambiás, se recalculan también los meses pasados.
- Si cargaste los 12 mensuales oficiales y no el interanual, se calcula componiéndolos.
- «Mes por mes» muestra la variación contra el mes anterior de cada uno.

## Archivos

| Archivo | Qué es |
|---|---|
| `logica.js` | Cálculos, validación, importar y exportar. Sin DOM. |
| `app.js` | Pantallas y guardado. |
| `index.html` | Estructura y estilos. |
| `sw.js`, `manifest.json`, `icono.svg` | Instalación y uso sin conexión. |

## Cómo se prueba

Desde esta carpeta:

```
node --test
node tests/e2e.js
```

La segunda necesita Playwright (no es dependencia de la app). Con `CANAL=msedge` usa el Edge instalado y con `CAPTURAS=<carpeta>` guarda imágenes.

## Verificado (25/11/2026)

- 22 tests de lógica con `node --test`: pasan.
- Navegador sin ventana (Edge), 360×740 táctil, tema claro: pasaron los pasos de alta, carga rápida, deshacer, persistencia, edición, canasta, oficial, ficha con gráfico, exportar, importar, datos dañados, sin scroll horizontal y recarga sin conexión. La corrida terminó en rojo en la última comprobación («no pide nada afuera») porque contaba pedidos internos `edge://` de la ventana de descargas del navegador; el filtro se corrigió.

## Sin probar

- Después de la última corrida se cambiaron tres cosas sin volver a abrir el navegador: el filtro del test, el aviso flotante se oculta al abrir la carga rápida y el selector de mes del oficial se ensanchó.
- Celular real: instalación como app, teclado numérico y selector de archivos. Safari y Firefox.

## Quedó afuera

- La entrada en la vitrina (`proyectos.json` y la tabla del README de la raíz).
- Traer el índice oficial automáticamente (la app no usa red).
- Los números oficiales en el CSV (van en el JSON).
- Promedio mensual o marca de «oferta»: una promo anotada a fin de mes mueve el resultado.
- Varios comercios, fotos o código de barras, recordatorios para volver a anotar.
- Gráfico de la canasta en el tiempo (está la tabla).
- Deshacer de más de un paso y sincronización entre dispositivos.
- Íconos PNG para instalación en iOS.
