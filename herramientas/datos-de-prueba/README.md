# Datos de prueba argentinos

Genera personas y empresas inventadas con pinta argentina para seeds, tests de integración y demos: nombre (según la
época en que nació: una Graciela de 1955, una Sofía de 2003), DNI acorde al año de nacimiento, CUIL o CUIT con el
dígito verificador bien calculado (con el 23 cuando 20 o 27 dan 10, y el 33 para las sociedades), fecha de nacimiento
o de inicio de actividades, mail, celular o fijo con la característica de la localidad, dirección con calle, número,
piso y depto, localidad, provincia y código postal, condición frente al IVA, banco, **CBU con sus dos dígitos de
control**, alias y patente vieja (`ABC 123`) o Mercosur (`AB 123 CD`).

Elegís cuántos (hasta 10.000), qué campos, una **semilla** (la misma semilla da siempre los mismos datos, y el registro
7 es el mismo pidas 10 o 10.000) y el formato: **JSON**, **CSV** (coma, punto y coma o tabulación; el descargado lleva
BOM para Excel), **SQL** (`CREATE TABLE` + `INSERT` en tandas de 1000 filas, para SQL Server con `N''` o PostgreSQL en
snake_case) o **C#** (un `record` con `init`, `DateOnly` y `string?` para lo que puede faltar, más la lista
inicializada). Copiar y descargar.

Al lado, un **validador**: pegás un CUIT/CUIL, un CBU/CVU, un DNI, una patente o un alias y te dice si cierra, con
la cuenta a la vista, el dígito que correspondería, de qué banco es el CBU, los dos CUIL posibles de un DNI y el
formato de la patente. Tocando un DNI, CUIT, CBU o patente de la vista previa se valida ahí mismo.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/datos-de-prueba/

**Estado:** terminado.

## Qué es real y qué no

- Nombres, apellidos, calles, razones sociales y alias salen de listas propias de palabras comunes y se combinan al
  azar: no son ninguna persona ni empresa.
- Los mails usan `example.com`, `example.net`, `example.org` y `.example`, dominios reservados para ejemplos
  (RFC 2606): un mail de prueba no le llega a nadie.
- Los códigos de banco (BCRA), las localidades con su código postal y las características telefónicas son reales,
  porque los validadores los miran; los números de cuenta y de teléfono son al azar. DNI, CUIT, CBU, mail y alias no
  se repiten dentro de una misma tanda.
- El DNI sigue el año de nacimiento por una tabla aproximada (1960 → 12,5 millones, 2000 → 42 millones).

## Cómo funciona

`logica.js` tiene todo, sin dependencias: el azar con semilla (`cyrb128` para pasar la semilla a 128 bits y `sfc32`
como generador; cada registro tiene su propio flujo `semilla|tipo|número`, por eso cambiar la cantidad, los campos,
el tipo de patente o los separadores no cambia los demás datos), los algoritmos (CUIT: pesos `5432765432`, módulo
11; CBU: pesos `7139713` y `3971397139713`, complemento a 10), las listas, la generación y los cuatro exportadores.
`index.html` es la página. Se acuerda de las opciones en `localStorage` (dentro de try/catch).

## Cómo se prueba

```bash
node --test herramientas/datos-de-prueba/tests/logica.test.js
sed -n '/^<script>$/,/^<\/script>$/p' herramientas/datos-de-prueba/index.html | sed '1d;$d' > /tmp/inline.js && node --check /tmp/inline.js
node herramientas/datos-de-prueba/tests/e2e.js     # Chromium headless a 360×740 y 1280×800
```

Once tests: el dígito de CUIT contra CUIT públicos conocidos (ARCA, YPF, Banco Nación, Mercado Libre) y el
`20-12345678-6` de los manuales; los inválidos (dígito, largo, prefijo, resto 10 con la sugerencia); el 23 con 9 y 4;
que con 30 dando 10 el 33 siempre cierra; CBU contra ejemplos conocidos con cada bloque, CVU y bancos fuera de la
tabla; patentes, alias, DNI y el detector; 2000 personas y 1000 empresas generadas donde todo cierra y nada se repite;
la reproducibilidad (con el primer registro de la semilla «mate» fijado); y los exportadores (comillas y separadores
en CSV, `O'Brien` y tandas de 1000 en SQL, escapes y nulos en C#). El e2e recorre la tabla, el validador con cada
ejemplo, semillas, campos, separadores, los cuatro formatos, 10.000 empresas descargadas y copiadas, el CSV con BOM,
la memoria al recargar, que no haya scroll horizontal ni pedidos a otros dominios.

Lo que **no se pudo probar**: el SQL y el C# generados contra SQL Server, PostgreSQL y el compilador de verdad (se
revisaron a mano). La tabla de bancos está al día a fines de 2026 según lo que se sabía; si un banco cambió de nombre,
el CBU sigue validando igual.
