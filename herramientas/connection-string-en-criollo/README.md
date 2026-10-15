# Connection string en criollo

Pegás una cadena de conexión de SQL Server (Microsoft.Data.SqlClient), PostgreSQL (Npgsql, en formato
clave=valor o como URI), MySQL/MariaDB (MySqlConnector) o Redis (StackExchange.Redis) y te dice en
castellano qué significa cada clave, cuál es su valor por defecto, qué es peligroso (cifrado sin
validar, superusuarios, timeouts infinitos, pools desmedidos, contraseñas de manual) y dónde
guardarla (appsettings sin la contraseña, user-secrets, variable de entorno, el `GetConnectionString`).
Todo corre en el navegador: no hay red ni «copiar link», porque la cadena tiene secretos.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/connection-string-en-criollo/

**Estado:** terminado.

## Qué hace

- **Detecta el proveedor** por las claves (con puntaje: claves exclusivas, puerto, barra de instancia,
  valores típicos de `SSL Mode`) o lo elegís a mano. Seis ejemplos para tocar.
- **Resumen en una frase**: «Te conectás a SQL Server en «srv,1433», base «Ventas», como «sa» con
  contraseña, cifrado pero sin validar el certificado, pool de hasta 500 conexiones.»
- **Avisos** en tres niveles (peligro, ojo, dato), distintos si el servidor es localhost. Entre otros:
  `Encrypt=False`, `TrustServerCertificate=True` (y el caso Azure SQL), `sa`/`postgres`/`root`,
  `SSL Mode=Disable|Prefer|Require` de Npgsql, `SslMode=None` y `AllowPublicKeyRetrieval` de MySQL,
  Redis sin `ssl` o sin contraseña, `allowAdmin`, `abortConnect`, `Connect Timeout=0`,
  `Command Timeout=0`, `Pooling=False`, pools de más o de menos, `Persist Security Info`,
  `Include Error Detail`, `No Reset On Close`, instancia con nombre sin puerto, base sin indicar,
  claves repetidas, claves desconocidas (el proveedor tira `Keyword not supported`), contraseñas de
  manual, el cambio de default de `Encrypt` en Microsoft.Data.SqlClient 4.0 y el de `SSL Mode` en
  Npgsql 6.0.
- **Tabla por categoría** (dónde, quién, seguridad, tiempos, pool, comportamiento): nombre canónico,
  cómo la escribiste, tu valor (la contraseña tapada salvo que marques «Mostrar contraseñas»),
  default y qué es. Diccionarios con 36 claves de SqlClient, 52 de Npgsql, 44 de MySqlConnector y 26
  de StackExchange.Redis, con sus alias.
- **Formatos**: la cadena normalizada con nombres canónicos y la contraseña reemplazada; la URI de
  libpq/MySQL (y qué claves no tienen equivalente); `appsettings.json` sin la contraseña;
  `dotnet user-secrets set`; `export ConnectionStrings__Nombre=`; y el `GetConnectionString` en C#.
  Los botones «Copiar» de user-secrets y de la variable de entorno copian la cadena real, que es para
  pegar en la terminal.
- **Texto** con lo que conviene saber (cifrar ≠ validar, los dos timeouts, el pool es por cadena y por
  proceso, `Application Name`, superusuarios) y fuentes.

## Cómo funciona

`logica.js` tiene el parser estilo `DbConnectionStringBuilder` (comillas simples o dobles, comilla
duplicada como escape, llaves al estilo ODBC, `==` en la clave, clave repetida gana la última), el
parser de URIs, los diccionarios por proveedor, la detección, los avisos, el resumen, la
reconstrucción, la conversión a URI y los snippets. `index.html` solo pinta.

## Cómo se prueba

```bash
node --test herramientas/connection-string-en-criollo/tests/logica.test.js
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' herramientas/connection-string-en-criollo/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/connection-string-en-criollo/tests/e2e.js
```

Los 13 tests de la lógica cubren el parser (comillas, escapes, llaves, errores), las URIs, la
detección de cada proveedor en casos ambiguos, alias y claves repetidas, la traducción de una URI de
Postgres, los avisos de cada proveedor con su nivel (y que contra localhost bajan de nivel), el
resumen, la reconstrucción, la URI de salida y los snippets, y que todos los alias de los diccionarios
resuelven. El e2e corre en Chromium headless a 360×740 y 1280×720: ejemplos, detección, avisos,
tabla, contraseña tapada y destapada, proveedor forzado, claves desconocidas, texto que no es una
cadena, limpiar, que no sale ningún pedido a otro dominio, sin errores de consola y sin scroll
horizontal.

Lo que **no se pudo probar**: abrir cada cadena con el driver real. Las claves y los defaults salen de
la documentación de cada proveedor (links en la página); si uno cambió en una versión nueva, el
lugar para corregirlo es el diccionario de `logica.js`.
