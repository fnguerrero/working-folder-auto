# 4. Enums

[Anterior](03-fechas.md) · [Índice](README.md) · [Siguiente](05-atributos.md) · Tests: [C04_Enums.cs](ejemplos/GuiaStj.Tests/C04_Enums.cs)

## La diferencia principal

Por defecto los dos **escriben el número** (`T0401`). Pero NJ **lee el nombre** sin configurar nada, y STJ lo rechaza, también con `Web` (`T0402`). Un cliente que hoy manda `"EnCurso"` empieza a recibir error.

```csharp
o.Converters.Add(new JsonStringEnumConverter());        // escribe y lee nombres
o.Converters.Add(new JsonStringEnumConverter<Estado>()); // por tipo; la pensada para AOT
```

Ese converter además cambia lo que **escribís**: de número a nombre (`T0403`). Si necesitás leer nombres y seguir escribiendo números, hace falta un converter propio (**no comprobado**: no hay ejemplo en la guía).

## Equivalencias

| NJ | STJ | Test |
|---|---|---|
| `StringEnumConverter` | `JsonStringEnumConverter` | `T0403` |
| Lectura sin distinguir mayúsculas, acepta `1` y `"1"` | Igual | `T0404` |
| `AllowIntegerValues = false` | `allowIntegerValues: false` | `T0405` |
| `new StringEnumConverter(new CamelCaseNamingStrategy())` | `new JsonStringEnumConverter(JsonNamingPolicy.CamelCase)` | `T0408` |
| `[EnumMember(Value = "en_curso")]` | `[JsonStringEnumMemberName("en_curso")]` | `T0409`, `T0410` |
| `[Flags]` como `"Leer, Escribir"` | Igual | `T0411` |
| Enum como clave de diccionario: sale el nombre | Igual, sin converter | `T0412` |

`[EnumMember]` **se ignora sin error** en STJ: sale `"EnCurso"` en lugar de `"en_curso"` (`T0409`). Buscalo en todo el repo.

## Valores inválidos

- Un número fuera de rango (`99`) entra en los dos, incluso con `JsonStringEnumConverter` (`T0406`). Validá con `Enum.IsDefined` si te importa.
- Un nombre desconocido falla en los dos (`T0407`).

## Fallback para valores desconocidos

```csharp
public class EstadoTolerante : JsonConverter<Estado>
{
    public override Estado Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
    {
        if (reader.TokenType == JsonTokenType.String
            && Enum.TryParse<Estado>(reader.GetString(), ignoreCase: true, out var e)
            && Enum.IsDefined(e))
            return e;
        reader.Skip(); // consume objetos o arrays enteros
        return Estado.Pendiente;
    }

    public override void Write(Utf8JsonWriter writer, Estado value, JsonSerializerOptions o)
        => writer.WriteStringValue(value.ToString());
}
```

Cubre nombre desconocido, número, número como texto y objeto: todos caen en `Pendiente` (`T0413`). Ojo que también descarta los números válidos.
