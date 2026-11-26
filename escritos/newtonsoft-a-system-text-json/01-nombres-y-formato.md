# 1. Nombres, forma del objeto y formato

[Índice](README.md) · [Siguiente](02-nulos-y-tipos.md) · Tests: [C01_Nombres.cs](ejemplos/GuiaStj.Tests/C01_Nombres.cs)

## Mayúsculas y camelCase

Sin opciones, los dos escriben el nombre tal cual está en C# (`T0101`). Al **leer** cambia todo: NJ no distingue mayúsculas y STJ sí. No hay error, las propiedades quedan en su valor por defecto (`T0102`).

```csharp
var o = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
```

`JsonSerializerOptions.Web` trae camelCase y lectura sin distinguir mayúsculas; produce lo mismo que NJ con `CamelCasePropertyNamesContractResolver` para un objeto simple (`T0103`).

**Diferencia:** el resolver camelCase de NJ también pasa a camelCase las **claves de los diccionarios**. STJ no, salvo que lo pidas (`T0104`):

```csharp
var o = new JsonSerializerOptions(JsonSerializerDefaults.Web)
{
    DictionaryKeyPolicy = JsonNamingPolicy.CamelCase
};
```

## Qué miembros entran

| Caso | NJ | STJ | Arreglo | Test |
|---|---|---|---|---|
| Campo público | Lo serializa | Lo ignora | `IncludeFields = true` | `T0105` |
| Propiedad con `private set`, sin atributos | No la asigna | No la asigna | `[JsonInclude]` | `T0106` |
| Parámetro del constructor que no coincide con ninguna propiedad | Le pasa el valor por defecto | `InvalidOperationException` | Renombrar el parámetro | `T0110` |

## Colecciones inicializadas

```csharp
public List<string> Roles { get; set; } = new() { "lector" };
```

Con `{"Roles":["admin"]}`, NJ **agrega** (`lector`, `admin`) y STJ **reemplaza** (`admin`). Si tu código dependía de que el valor inicial sobreviviera, se pierde. Si al revés querés que NJ se comporte como STJ mientras migrás: `ObjectCreationHandling.Replace` (`T0107`).

Sin setter es peor:

```csharp
public List<string> Roles { get; } = new();
```

NJ la llena; STJ la deja **vacía y sin avisar**. Se arregla por propiedad o para todo (`T0108`):

```csharp
[JsonObjectCreationHandling(JsonObjectCreationHandling.Populate)]
public List<string> Roles { get; } = new();

var o = new JsonSerializerOptions { PreferredObjectCreationHandling = JsonObjectCreationHandling.Populate };
```

## Constructores

Con un único constructor con parámetros, los dos lo usan. STJ vincula el parámetro `id` con la propiedad `Id` sin mirar mayúsculas, pero el nombre **en el JSON** sigue las reglas de siempre: `{"id":5}` deja `Id` en 0 si no activaste `PropertyNameCaseInsensitive` (`T0109`).

## JSON de entrada desprolijo

| Entrada | NJ | STJ por defecto | Arreglo | Test |
|---|---|---|---|---|
| Propiedad que sobra | Ignora | Ignora | Para rechazar: `UnmappedMemberHandling.Disallow` (NJ: `MissingMemberHandling.Error`) | `T0111` |
| Propiedad repetida | Gana la última | Gana la última | Para rechazar: `AllowDuplicateProperties = false` | `T0112` |
| Comentarios, coma final | Acepta | `JsonException` | `ReadCommentHandling = JsonCommentHandling.Skip`, `AllowTrailingCommas = true` | `T0113` |
| Comillas simples, nombres sin comillas | Acepta | `JsonException`, aun con lo anterior | Corregir el origen | `T0114` |

## Escapado

STJ escapa por defecto los caracteres no ASCII y `<`, `>`, `&`, `'`, `+`. NJ no (`T0115`). El JSON es equivalente, pero rompe comparaciones de texto, firmas sobre el cuerpo y snapshots.

```csharp
// Como NJ para este caso. "Unsafe": no sirve para incrustar el JSON en HTML o <script>
Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping

// Intermedio: deja la ñ y los acentos, sigue escapando < > & ' +
Encoder = JavaScriptEncoder.Create(UnicodeRanges.All)
```

Los emojis siguen saliendo escapados aun con el encoder relajado. Al leerlos vuelven bien (`T0116`).

## Referencias circulares

Los dos tiran por defecto (`T0117`).

| NJ | STJ | Ojo |
|---|---|---|
| `ReferenceLoopHandling.Ignore` | `ReferenceHandler.IgnoreCycles` | NJ **omite** la propiedad; STJ la escribe como `null` (`T0117`) |
| `PreserveReferencesHandling.Objects` | `ReferenceHandler.Preserve` | Mismo `$id` / `$ref` en el caso probado (`T0118`) |

## Formato y límites

- `Formatting.Indented` es `WriteIndented = true`; para un objeto simple la salida es idéntica en Windows (`T0119`).
- Al parsear un árbol, los dos cortan por defecto en 64 niveles de anidamiento (`T0120`). Se probó `JToken.Parse` y `JsonNode.Parse`, no otros caminos.
