# 2. Nulos, números y tipos sueltos

[Anterior](01-nombres-y-formato.md) · [Índice](README.md) · [Siguiente](03-fechas.md) · Tests: [C02_Tipos.cs](ejemplos/GuiaStj.Tests/C02_Tipos.cs)

## Nulos

`null` en un `int` falla en los dos (`T0201`).

| NJ | STJ | Test |
|---|---|---|
| `NullValueHandling.Ignore` (al escribir) | `DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull` | `T0202` |
| `DefaultValueHandling.Ignore` | `JsonIgnoreCondition.WhenWritingDefault` | `T0207` |

### La trampa: NJ también ignora al leer

```csharp
public string Moneda { get; set; } = "ARS";
```

Con `{"Moneda":null}` y `NullValueHandling.Ignore`, NJ conserva `"ARS"`. STJ con `WhenWritingNull` **pisa el valor con `null`**: esa opción solo actúa al escribir (`T0203`).

Si dependías de eso, este modificador lo imita para propiedades de tipo referencia (`T0204`; no cubre `int?` y compañía):

```csharp
static void IgnorarNullAlLeer(JsonTypeInfo info)
{
    foreach (var p in info.Properties)
    {
        var set = p.Set;
        if (set is null || p.PropertyType.IsValueType) continue;
        p.Set = (obj, valor) => { if (valor is not null) set(obj, valor); };
    }
}

var o = new JsonSerializerOptions
{
    TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { IgnorarNullAlLeer } }
};
```

### `WhenWritingDefault` no mira `[DefaultValue]`

NJ omite una propiedad que vale lo que dice `[DefaultValue(10)]`. STJ compara contra `default(T)`, así que la escribe (`T0207`).

### Referencias no anulables y `required`

- `string Nombre` con `{"Nombre":null}` queda en `null` en los dos. STJ puede rechazarlo con `RespectNullableAnnotations = true` (`T0205`).
- `required string Nombre`: STJ falla si la propiedad **falta**; NJ la deja en `null`. Un `null` explícito pasa en STJ (`T0206`).

## Conversiones que NJ hacía solo

| JSON | Destino | NJ | STJ | STJ `Web` | Test |
|---|---|---|---|---|---|
| `"42"` | `int` | 42 | Error | 42 | `T0208` |
| `123`, `true` | `string` | `"123"`, `"true"` | Error | Error | `T0209` |
| `"true"`, `1` | `bool` | `true` | No probado sin `Web` | Error | `T0210` |
| `""` | `int?` | `null` | No probado sin `Web` | Error | `T0211` |
| `1.5` | `int` | Error | Error | No probado | `T0212` |

Para números entre comillas fuera de `Web`: `NumberHandling = JsonNumberHandling.AllowReadingFromString` (`T0208`). Para el resto hace falta un converter propio ([capítulo 6](06-converters-y-opciones.md)).

## `object` y `Dictionary<string, object>`

NJ mete tipos de .NET; STJ mete `JsonElement`. Un `Convert.ToInt64(d["n"])` que antes andaba ahora tira `InvalidCastException` (`T0213`).

Tres salidas:

1. Usar la API de `JsonElement`: `((JsonElement)d["n"]).GetInt32()` (`T0213`).
2. `UnknownTypeHandling = JsonUnknownTypeHandling.JsonNode` para recibir `JsonNode` (`T0219`).
3. Un converter de `object` a primitivos (`T0220`): ver `ObjetoAPrimitivo` en los tests. Decide `long` o `decimal` para los números, deja los strings como string y los objetos y arrays como `JsonElement`.

## Números grandes y decimales

- **Más grande que `long`:** en `object`, NJ da `BigInteger`. STJ conserva el texto: `GetRawText()` devuelve todos los dígitos y al reserializar sale igual (`T0214`).
- **Propiedad `BigInteger`:** STJ no falla, serializa las propiedades del struct (`{"N":{...}}`). Necesita converter; el de los tests usa `WriteRawValue` (`T0215`).
- **Decimales en `object`:** acá el que pierde es NJ, que usa `double` salvo `FloatParseHandling.Decimal`. STJ reescribe el texto original (`T0216`).
- **IDs `long` hacia JavaScript:** escribilos como string ([`T0515`](05-atributos.md)).

| Valor | NJ escribe | STJ escribe | Test |
|---|---|---|---|
| `1.0` (`double`) | `1.0` | `1` | `T0217` |
| `1m` | `1.0` | `1` | `T0217` |
| `1.10m` | `1.10` | `1.10` | `T0217` |
| `double.NaN` | `"NaN"` | `ArgumentException` | `T0218` |

Para `NaN`: `NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals` (`T0218`).

## De `JObject` a `JsonNode`

| NJ | STJ | Test |
|---|---|---|
| `JObject.Parse(s)` | `JsonNode.Parse(s)!.AsObject()` | `T0221` |
| `(string?)o["a"]!["b"]` | Igual | `T0221` |
| `o.SelectToken("a.tags[1]")` | Encadenar indexadores: `o["a"]!["tags"]![1]` | `T0221` |
| `o.ToString(Formatting.None)` | `o.ToJsonString()` | `T0614` |
| `JToken.DeepEquals` | `JsonNode.DeepEquals` | `T0222` (solo STJ) |

Dos diferencias que rompen código:

- Un `JsonNode` tiene **un solo padre**. Asignarlo a otro árbol tira `InvalidOperationException`; NJ lo clonaba. Usá `DeepClone()` (`T0222`).
- `GetValue<T>()` no convierte: pedir `string` a un número (o `int` a un string) tira. En NJ, `(string?)` sobre un número devolvía el texto. En STJ, `ToString()` sirve para obtener el texto (`T0223`).
