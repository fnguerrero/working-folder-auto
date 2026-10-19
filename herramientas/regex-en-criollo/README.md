# Regex en criollo

Pegás una expresión regular de .NET y te la explica en castellano, paso a paso, como un árbol («grupo «anio»
(número 1): captura…», «exactamente 4 veces: un dígito», «seguido de (mira sin consumir)…»). La probás contra
un texto y ves cada match marcado con sus grupos, numerados y nombrados como los numera .NET (primero los sin
nombre, después los con nombre). Te avisa de las trampas: no está anclada, `$` que acepta un salto de línea
final, `\d` que acepta dígitos de cualquier escritura, el punto que no matchea `\n`, `[A-z]`, backtracking
catastrófico (cuantificadores sin tope anidados), alternativas vacías, anclas que aplican a una sola rama,
referencias a grupos que no existen, puntos sin escapar en texto literal, mails, muchos grupos sin nombre,
`.*` goloso en el medio, IgnoreCase sin CultureInvariant. Y te deja el C#: `[GeneratedRegex]` con las
`RegexOptions` elegidas y el `Match` con cada grupo por nombre, o la versión clásica con `static readonly` y
timeout. Diez ejemplos (CUIT, patente, fecha, mail honesto, teléfono, connection string, importe con coma,
línea de Serilog, GUID y «el clásico que explota»).

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/regex-en-criollo/

**Estado:** terminado.

## Cómo funciona

`logica.js` tiene un parser propio de la sintaxis de .NET (literales, escapes, clases con rangos y resta
`[a-z-[aeiou]]`, `\p{..}`, cuantificadores golosos y vagos, grupos con nombre en las dos sintaxis, no
capturantes, atómicos, lookahead y lookbehind, balanceo, condicionales, opciones inline `(?imsnx-imsnx)` y
`(?i:…)`, comentarios `(?#…)`, modo `x`, backreferences `\1` y `\k<n>`), que devuelve un AST con errores con
posición. Sobre el AST: `explicar` (el árbol en castellano), `avisos`, `snippetCs` y `aJs`, que traduce a una
RegExp de JavaScript respetando la semántica de .NET: `$` → `(?=\n?(?![^]))`, `\d` → `\p{Nd}`, `\w` y `\b`
Unicode, `\A \Z \z`, el punto sin `\n`, las opciones inline como modificadores, la resta de clases en modo
`v`, y los grupos atómicos como `(?=(?<_at1>…))\k<_at1>` con un grupo oculto que no altera la numeración de
.NET. Lo que no tiene traducción (balanceo, condicionales, `\G`) se explica pero no se prueba, y la página lo
dice. La prueba corre en un Web Worker (`worker.js`) y se corta a los 2 segundos: con «el clásico que
explota» se ve en vivo qué es el backtracking catastrófico sin que se cuelgue la pestaña. Abierta como
archivo local (sin workers) la prueba corre en el hilo principal.

## Cómo se prueba

```bash
node --test herramientas/regex-en-criollo/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' herramientas/regex-en-criollo/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node herramientas/regex-en-criollo/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

Diez tests (numeración de .NET con y sin nombres y con ExplicitCapture; errores con posición; la explicación
de cada construcción; probar con grupos mapeados; la semántica de .NET al traducir: `$`, `\z`, `\d` Unicode,
ECMAScript, punto, Singleline, Multiline, `\b` con ñ, IgnoreCase, resta de clases, matches vacíos; grupos
atómicos; lo que no se puede probar; cada aviso; el C#; los diez ejemplos) y un e2e que recorre la explicación,
los matches con grupos, un error con posición, los avisos de `$` con y sin Multiline, el corte a los 2 segundos
del que explota (y que la página sigue viva después), el C# en las dos versiones con copiar, la memoria al
recargar y un patrón que no se puede probar. `localStorage` va dentro de try/catch.

Lo que **no se pudo probar**: contra el motor de .NET de verdad; la traducción a JavaScript sigue la
documentación, y las diferencias que quedan son finas (`\s` incluye un par de caracteres distintos; `\b` se
arma con lookarounds sobre `\w` Unicode; los modificadores inline fuera del inicio necesitan Chrome 125+).
