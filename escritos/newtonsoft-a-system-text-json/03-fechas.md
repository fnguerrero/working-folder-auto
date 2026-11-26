# 3. Fechas

[Anterior](02-nulos-y-tipos.md) · [Índice](README.md) · [Siguiente](04-enums.md) · Tests: [C03_Fechas.cs](ejemplos/GuiaStj.Tests/C03_Fechas.cs)

## Lo que no cambia

| Caso | Resultado en los dos | Test |
|---|---|---|
| Escribir `DateTime` (`Unspecified`, `Utc`, `Local`), con y sin fracción | Mismo texto | `T0301` |
| Leer en una propiedad `DateTimeOffset` | Conserva el offset | `T0303` |
| Leer un offset en una propiedad `DateTime` | Convierte a hora local de la máquina (`Kind = Local`) | `T0304` |
| Leer en una propiedad `string` | Texto original | `T0308` |
| Leer `"2026-11-25"` en `DateTime` | La fecha a las 00:00 | `T0310` |
| `TimeSpan` | `"1.02:03:04"` | `T0314` |
| `DateOnly`, `TimeOnly` | `"2026-11-25"`, `"10:30:00"` | `T0315` |

`DateTimeOffset` con offset cero sale como `+00:00` en los dos (`T0302`).

La fila de `DateTime` con offset no es una diferencia entre librerías, pero conviene saberla: si el offset importa, la propiedad tiene que ser `DateTimeOffset`.

## NJ adivinaba fechas, STJ no

Cuando el destino es `object`, `Dictionary<string, object>` o `JObject`, NJ convierte un string con fecha ISO en `DateTime`. STJ lo deja como string (`T0305`).

Consecuencias al migrar:

- Código que hace `if (valor is DateTime)` deja de entrar.
- **El offset ya no se pierde.** Con NJ, pasar por `JObject.Parse(...).ToObject<T>()` devuelve el mismo instante con otro offset. Con `JsonNode` se conserva (`T0306`). Si alguien "compensaba" ese corrimiento a mano, ahora compensa de más.

Para que NJ deje de adivinar (útil para destapar dependencias antes de migrar): `DateParseHandling.None` (`T0307`).

## Formatos aceptados

STJ rechaza estos, que NJ aceptaba (`T0309`):

- `"2026-11-25 10:30:00"` (espacio en lugar de `T`)
- `"11/25/2026"`
- `"\/Date(1795602600000)\/"` (el formato viejo de Microsoft)

Revisá qué mandan los clientes reales antes de migrar.

## Formato propio: `DateFormatString` pasa a ser un converter

```csharp
public class FechaArgentina : JsonConverter<DateTime>
{
    private const string Formato = "dd/MM/yyyy";

    public override DateTime Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        => DateTime.TryParseExact(reader.GetString(), Formato, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)
            ? f
            : throw new JsonException($"Se esperaba una fecha {Formato}.");

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions o)
        => writer.WriteStringValue(value.ToString(Formato, CultureInfo.InvariantCulture));
}
```

Comprobado contra `DateFormatString` en `T0311`. Dos detalles:

- Registrado para `DateTime`, también cubre `DateTime?` (`T0312`).
- Es estricto: una fecha ISO ahora falla (`T0311`).

## `DateTimeZoneHandling.Utc`

No hay una opción equivalente entre las usadas acá; se hace con un converter. Escribe igual que NJ para los tres `Kind` (`T0313`):

```csharp
public class SiempreUtc : JsonConverter<DateTime>
{
    // Igual que NJ con Utc: un Unspecified se toma como si ya fuera UTC
    private static DateTime AUtc(DateTime f) => f.Kind == DateTimeKind.Unspecified
        ? DateTime.SpecifyKind(f, DateTimeKind.Utc)
        : f.ToUniversalTime();

    public override DateTime Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o) => AUtc(reader.GetDateTime());
    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions o) => writer.WriteStringValue(AUtc(value));
}
```
