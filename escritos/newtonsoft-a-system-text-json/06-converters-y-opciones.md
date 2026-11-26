# 6. Converters y opciones

[Anterior](05-atributos.md) · [Índice](README.md) · [Siguiente](07-polimorfismo.md) · Tests: [C06_Converters.cs](ejemplos/GuiaStj.Tests/C06_Converters.cs)

## Un converter de cada lado

```csharp
// NJ
public class SiNoNj : NJ.JsonConverter<bool>
{
    public override void WriteJson(NJ.JsonWriter writer, bool value, NJ.JsonSerializer serializer)
        => writer.WriteValue(value ? "S" : "N");

    public override bool ReadJson(NJ.JsonReader reader, Type t, bool existing, bool hasExisting, NJ.JsonSerializer serializer)
        => reader.Value switch
        {
            "S" => true,
            "N" => false,
            _ => throw new NJ.JsonSerializationException("Se esperaba S o N.")
        };
}

// STJ
public class SiNoStj : JsonConverter<bool>
{
    public override bool Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        => reader.GetString() switch
        {
            "S" => true,
            "N" => false,
            _ => throw new JsonException()
        };

    public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions o)
        => writer.WriteStringValue(value ? "S" : "N");
}
```

Mismo JSON de ida y vuelta (`T0601`). Si tirás `new JsonException()` sin mensaje, STJ le completa el `Path` y arma un mensaje que lo incluye (`T0602`).

## Dos cambios que no se ven al compilar

### Precedencia

| | Gana primero | Segundo | Último |
|---|---|---|---|
| NJ | Atributo en la propiedad | Atributo en el tipo | `settings.Converters` |
| STJ | Atributo en la propiedad | `options.Converters` | Atributo en el tipo |

Un converter global ahora **pisa** al `[JsonConverter]` puesto sobre la clase (`T0603`).

### `null`

Para un tipo referencia propio, STJ no le pasa el `null` al converter: devuelve `null` directo. Si querés manejarlo, `public override bool HandleNull => true;` (`T0604`).

## Genéricos y claves de diccionario

Un `JsonConverterFactory` cubre toda una familia como `Id<T>`. Para usar el tipo como clave de diccionario hay que sobrescribir además `ReadAsPropertyName` y `WriteAsPropertyName` (`T0605`; ver `IdFactory` en los tests).

## Converters que traía NJ

| NJ | STJ | Test |
|---|---|---|
| `UnixDateTimeConverter` | Converter propio (`UnixSegundos`) | `T0606` |
| `VersionConverter` | Nada: `Version` ya sale como `"1.2.3"` | `T0607` |
| `CustomCreationConverter<T>` | Modificador con `JsonTypeInfo.CreateObject` | `T0609` |

`Uri` y `byte[]` (base64) salen igual sin converters (`T0607`, `T0608`).

## Tipos que cambian o dejan de andar

| Tipo | STJ | Arreglo | Test |
|---|---|---|---|
| `DataTable` | `NotSupportedException` | Mapear a una lista de DTOs o converter propio | `T0610` |
| `System.Type` | `NotSupportedException` | Guardar un nombre propio como string | `T0611` |
| `ValueTuple` | `{}` sin error | `IncludeFields = true`, o mejor un `record` | `T0612` |

## `PopulateObject`

Esta guía no usa un equivalente en STJ. Para el caso plano alcanza esto (`T0613`): solo primer nivel y nombres exactos.

```csharp
static void Rellenar<T>(string json, T destino, JsonSerializerOptions o) where T : class
{
    var info = o.GetTypeInfo(typeof(T));
    using var doc = JsonDocument.Parse(json);
    foreach (var prop in doc.RootElement.EnumerateObject())
    {
        var p = info.Properties.FirstOrDefault(x => x.Name == prop.Name);
        p?.Set?.Invoke(destino, prop.Value.Deserialize(p.PropertyType, o));
    }
}
```

Las opciones tienen que tener un `TypeInfoResolver` asignado (en el test, `DefaultJsonTypeInfoResolver`).

## `JObject.Merge`

```csharp
static void Fusionar(JsonObject destino, JsonObject origen)
{
    foreach (var (clave, valor) in origen)
    {
        if (valor is JsonObject hijo && destino[clave] is JsonObject actual) Fusionar(actual, hijo);
        else destino[clave] = valor?.DeepClone();
    }
}
```

Coincide con NJ para objetos anidados (`T0614`). Para **arrays** no: NJ por defecto concatena y esta función reemplaza (`T0615`). Un `null` en el origen pisa el destino; qué hace NJ en ese caso **(no comprobado)**.

## Manejo de errores

El `Error = (_, a) => a.ErrorContext.Handled = true` de NJ saltea el elemento roto y sigue. En STJ falla todo (`T0616`). Alternativa: parsear a `JsonNode` y filtrar antes de convertir (`T0616`).

## Las opciones se congelan

Después del primer uso, modificar un `JsonSerializerOptions` tira `InvalidOperationException`; copialo con `new JsonSerializerOptions(otro)` (`T0617`). Con `JsonSerializerSettings` se podía.

`JsonSerializerOptions.Default` es de solo lectura (`T0618`): no sirve como reemplazo de `JsonConvert.DefaultSettings`. Lo habitual es una instancia estática propia que se pasa en cada llamada.
