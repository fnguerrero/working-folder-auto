# 7. Polimorfismo

[Anterior](06-converters-y-opciones.md) · [Índice](README.md) · [Siguiente](08-source-generators-y-aot.md) · Tests: [C07_Polimorfismo.cs](ejemplos/GuiaStj.Tests/C07_Polimorfismo.cs)

## El cambio silencioso

```csharp
Animal a = new Perro();
```

| Llamada | Salida |
|---|---|
| NJ | Campos de `Perro` y de `Animal` |
| `JsonSerializer.Serialize(a)` | **Solo `Animal`** (`T0701`) |
| `JsonSerializer.Serialize<object>(a)` | Todo (`T0701`) |
| Propiedad declarada `Animal` | Solo `Animal` (`T0702`) |
| Propiedad declarada `object` | Todo (`T0702`) |

## `[JsonDerivedType]`

```csharp
[JsonDerivedType(typeof(Tarjeta), "tarjeta")]
[JsonDerivedType(typeof(Efectivo), "efectivo")]
public abstract class Pago { public decimal Monto { get; set; } }
```

`Serialize<Pago>(tarjeta)` escribe `{"$type":"tarjeta",...}` y al leer como `Pago` vuelve una `Tarjeta` (`T0703`).

### Reglas que conviene saber

| Situación | Resultado | Test |
|---|---|---|
| Serializás con el tipo **derivado** (`Serialize(tarjeta)` con `var`) | Sin discriminador; después no se puede leer como `Pago` | `T0704` |
| Dentro de una `List<Pago>` | Con discriminador | `T0704` |
| `$type` no es la primera propiedad, base abstracta | `NotSupportedException` | `T0705` |
| `$type` no es la primera propiedad, base concreta | `JsonException` | `T0713` |
| Lo anterior, aceptado | `AllowOutOfOrderMetadataProperties = true` (probado con base abstracta) | `T0705` |
| Discriminador desconocido | `JsonException` | `T0706` |
| Falta el discriminador, base abstracta | `NotSupportedException` | `T0706` |
| Derivado sin registrar | `NotSupportedException` | `T0707` |

El orden importa si el JSON pasa por algo que reordena claves (algunas bases con columnas JSON lo hacen, **no comprobado**).

### Nombre, números y fallback

```csharp
[JsonPolymorphic(TypeDiscriminatorPropertyName = "tipo",
    UnknownDerivedTypeHandling = JsonUnknownDerivedTypeHandling.FallBackToBaseType,
    IgnoreUnrecognizedTypeDiscriminators = true)]
[JsonDerivedType(typeof(Mail), 1)]
public class Aviso { public string Texto { get; set; } = ""; }
```

El discriminador puede ser un número. Con esas dos opciones, un derivado sin registrar se escribe como la base, y un discriminador desconocido o ausente se lee como la base (`T0708`).

## Registrar en tiempo de ejecución

Sirve cuando la base está en otro proyecto, o los derivados se descubren al arrancar (`T0710`). También con interfaces (`T0711`): sin registrar, una interfaz se escribe como `{}` y no se puede leer.

```csharp
static JsonSerializerOptions Opciones(Type baseType, params (Type tipo, string id)[] derivados)
{
    var resolver = new DefaultJsonTypeInfoResolver();
    resolver.Modifiers.Add(info =>
    {
        if (info.Type != baseType) return;
        info.PolymorphismOptions = new JsonPolymorphismOptions();
        foreach (var (tipo, id) in derivados)
            info.PolymorphismOptions.DerivedTypes.Add(new JsonDerivedType(tipo, id));
    });
    return new JsonSerializerOptions { TypeInfoResolver = resolver };
}
```

## Datos guardados con `TypeNameHandling`

NJ escribe `"$type": "Namespace.Clase, Ensamblado"`. Podés registrar **ese mismo texto** como discriminador y seguir leyendo lo viejo (`T0709`):

```csharp
Opciones(typeof(Forma), (typeof(Circulo), "MiApp.Circulo, MiApp"));
```

Alcance de lo probado: `TypeNameHandling.Objects`, un objeto plano en la raíz, con `$type` primero. Colecciones envueltas en `$values`, genéricos y objetos anidados **(no comprobado)**.

La lista explícita de derivados es además una ventaja: solo se instancian los tipos registrados. `TypeNameHandling` con datos no confiables es un riesgo de deserialización conocido **(no comprobado acá)**.

## Discriminador por la forma del JSON

Si el JSON no trae discriminador, va un converter que mire el contenido (`T0712`):

```csharp
public class CobroPorForma : JsonConverter<Cobro>
{
    public override Cobro? Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var raiz = doc.RootElement;
        return raiz.TryGetProperty("Ultimos4", out _)
            ? raiz.Deserialize<CobroTarjeta>(o)
            : raiz.Deserialize<CobroEfectivo>(o);
    }

    public override void Write(Utf8JsonWriter writer, Cobro value, JsonSerializerOptions o)
        => JsonSerializer.Serialize(writer, value, value.GetType(), o);
}
```

El ejemplo usa una base **sin** `[JsonDerivedType]`; combinar ambas cosas no se probó. `TryGetProperty` distingue mayúsculas.
