# JSON a C#

Pegás un JSON y salen las clases de C# para deserializarlo con `System.Text.Json` o Newtonsoft,
listas para copiar. También saca interfaces de TypeScript. Todo pasa en el navegador: el JSON no
sale de tu máquina.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/json-a-csharp/

## Qué hace

- **Infiere tipos** mirando todos los valores: `int`, `long`, `double` (o `decimal`), `bool`,
  `string`, `DateTime` (ISO 8601 y `AAAA-MM-DD`), `Guid`, listas y objetos anidados.
  `1.0` es `double` aunque valga 1, porque el parser es propio y mira cómo estaba escrito.
- **Unifica** los elementos de una lista: si en un objeto falta una propiedad o viene `null`,
  queda anulable (`int?`, `string?`); si en uno es entero y en otro decimal, queda `double`; si
  son tipos incompatibles, queda `JsonElement` (o `JToken` con Newtonsoft, u `object`).
- **Diccionarios**: un objeto cuyas claves son números, fechas o GUIDs (`{"2026-01": 10, "2026-02": 12}`)
  sale como `Dictionary<string, T>` en vez de una clase con propiedades `_202601`.
- **Nombres**: claves `snake_case`, `kebab-case`, `camelCase` o con espacios pasan a PascalCase
  y, si el nombre cambia, lleva `[JsonPropertyName("...")]` (o `[JsonProperty]`). Las listas
  nombran su clase en singular (`items` → `Item`, `direcciones` → `Direccion`). Dos objetos con
  la misma forma comparten clase; dos clases distintas con el mismo nombre se numeran.
- **Opciones**: nombre de la clase raíz, namespace (file-scoped), `class { get; set; }`,
  `class { get; init; }` o `record` posicional; `List<T>`, `T[]` o `IReadOnlyList<T>`;
  `double` o `decimal`; tipos anulables (`string?`) con o sin `required`; detección de fechas y
  GUID; atributo en todas las propiedades o solo donde el nombre cambia.
- **Errores** de JSON con línea y columna y un mensaje que dice qué sobra o qué falta
  (coma de más, comillas simples, clave sin comillas, cadena sin cerrar).
- **Formatear**, **Copiar** (también con Ctrl+Enter), **Descargar** como `.cs` o `.ts`. El último
  JSON y las opciones quedan en `localStorage` para la próxima vez.
- Si la raíz es una lista o un diccionario, lo dice en un comentario con el tipo para deserializar.

## Cómo se usa

1. Abrí la página (o `index.html` en local; no necesita servidor).
2. Pegá el JSON. Las clases aparecen al toque; **Ejemplo** carga un pedido de muestra.
3. Elegí estilo, atributos y demás arriba. Poné el nombre de la clase raíz y, si querés, el namespace.
4. **Copiar** y pegar en el proyecto. Con `ImplicitUsings` los `using` de `System` y
   `System.Collections.Generic` sobran, pero no molestan.

## Decisiones

- Con tipos anulables activados, las propiedades de referencia no anulables llevan `required`
  (C# 11, .NET 7+) para que el compilador no dé el aviso CS8618. Si lo desactivás, sale un
  comentario avisando.
- Un valor que siempre es `null` sale como `object?`: no hay forma de saber qué era.
- Una lista vacía sale como `List<JsonElement>` (o `JToken`/`object`): tampoco se puede saber más.
- Los `DateTime` cubren fecha y fecha con hora. No se usa `DateOnly` ni `DateTimeOffset` para no
  depender de la versión de .NET; se cambia a mano si hace falta.
- Las claves se consideran diccionario si hay al menos dos y todas empiezan con dígito o son GUID.
- Es JSON estricto: sin comentarios ni comas finales, pero el error dice dónde está el problema.

## Cómo se prueba

Lógica pura, sin navegador:

```bash
node --test herramientas/json-a-csharp/tests/*.test.js
```

Recorrido completo en Chromium headless a 360 px y a 1280 px (ejemplo, opciones, TypeScript,
errores, formatear, copiar, descargar, recarga, tamaño de los controles):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/json-a-csharp/tests/e2e.js
```

Las interfaces de TypeScript generadas se verificaron con `tsc --strict`. Lo que **no se pudo
probar** en la nube es compilar el C# generado con `dotnet` (no está instalado ahí); se revisó a
mano contra la sintaxis de C# 11.

## Archivos

```
index.html        interfaz, estilos y el script de la página
logica.js         parser JSON, inferencia de tipos y generadores de C# y TypeScript; anda en el navegador y en Node
tests/            logica.test.js (node --test) y e2e.js (Playwright)
```
