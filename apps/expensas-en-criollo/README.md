# Expensas en criollo

Pegás (o cargás a mano) los rubros de la liquidación de expensas de cada mes y ves en qué se va la
plata, cuánto subió contra el mes anterior y contra la inflación, y qué rubros saltaron. Todo en el
navegador: no se sube nada.

**Estado:** terminado (primera versión).
**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/expensas-en-criollo/
(anda cuando el proyecto esté publicado), o abriendo `index.html`.

## Cómo se usa

1. La primera vez aparece un ejemplo de un consorcio **inventado** (nombres de rubros genéricos,
   importes e inflación de mentira).
2. En «Cargar mes» pegás el texto de la liquidación: un rubro por renglón, con el importe al final.
   La app propone nombre, categoría e importe; revisás, corregís y guardás. Si el texto trae un
   renglón de total, avisa si no coincide con la suma.
3. Cargás la inflación de cada mes (opcional; la app no la trae sola, se copia del INDEC).
4. En «Resumen» está la explicación en castellano, el peso de cada categoría, los saltos y las
   preguntas para la administración, listas para copiar.
5. En «Historial y datos»: evolución, editar o borrar meses, ajustes, exportar e importar JSON.

## Cómo se calcula

- Se compara contra el **mes anterior cargado**. Si hay meses salteados, la inflación se acumula y
  hacen falta todos los meses del medio.
- «Descontada la inflación»: `(1 + suba) / (1 + inflación) − 1`.
- Un rubro **salta** si quedó más de 10 puntos por encima de la inflación y la plata de más es al
  menos el 1 % del total del mes. Un rubro nuevo salta si pesa al menos ese 1 %. Los dos números se
  cambian en Ajustes. Sin inflación cargada, la referencia es la mediana de las subas de los rubros
  (hacen falta tres o más en común).
- Un rubro es el mismo entre meses si coincide el nombre sin acentos, números, nombres de mes ni
  palabras como «factura» o «cuota». Si la administración le cambia el nombre, figura como uno nuevo
  y otro que no está: se arregla editando el mes.

## Límites conocidos

- No lee PDF ni fotos: hay que copiar el texto. No se probó con ninguna liquidación real, solo con
  texto inventado, y cada administración las arma distinto.
- Si un renglón tiene varias columnas de importes, toma la última.
- No separa columnas con coma (`Luz,200000`) ni lee miles separados con espacios. La coma se toma
  como decimal.
- No distingue expensas ordinarias de extraordinarias ni gastos de ingresos: lo que quede en el
  formulario se suma. Conviene quitar lo que no sea un gasto.
- «Tu parte estimada» es el total cargado por tu coeficiente: no es lo que dice tu boleta.
- La categoría se adivina por palabras clave; se corrige a mano y se recuerda para el mismo rubro.

## Archivos

`index.html`, `estilo.css`, `app.js` (interfaz), `logica.js` (cálculos, sin DOM), `manifest.json`,
`sw.js`, `icono.svg`. Sin dependencias ni pedidos a otros sitios.

## Pruebas

Desde la raíz del repo:

```
node --test apps/expensas-en-criollo/tests/logica.test.js
npx --yes playwright@1.56.1 install chromium
node apps/expensas-en-criollo/tests/e2e.js
```

El segundo y tercer comando necesitan Playwright. `e2e.js` acepta las variables `PLAYWRIGHT` (ruta a
un módulo ya instalado), `CANAL` (`msedge` o `chrome`) y `CAPTURAS` (carpeta para capturas).

**Verificado el 2026-11-25** (Windows, Node 26): las 17 pruebas de lógica pasan. El recorrido de punta
a punta pasa en Edge headless (con el Playwright 1.60 que ya estaba instalado) a 360×740 táctil
emulado y a 1280×800: ejemplo, pegar y cargar a mano, comparación, borrar y deshacer, exportar e
importar, recarga, datos guardados rotos, recarga sin conexión y apertura como archivo local; sin
scroll horizontal de página, controles de al menos 44 px, sin errores de consola ni pedidos afuera.

**Sin probar:** un celular real, Safari y Firefox, la instalación como PWA, el sitio publicado en
GitHub Pages, lectores de pantalla y texto copiado de una liquidación o un PDF reales.
