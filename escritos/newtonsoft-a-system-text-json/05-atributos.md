# 5. Atributos

[Anterior](04-enums.md) · [Índice](README.md) · [Siguiente](06-converters-y-opciones.md) · Tests: [C05_Atributos.cs](ejemplos/GuiaStj.Tests/C05_Atributos.cs)

La tabla completa está en [Equivalencias](10-equivalencias.md). Acá van los que cambian de comportamiento.

## STJ no ve los atributos de Newtonsoft

Un `[JsonProperty("nombre_completo")]` que queda en el código compila y **no hace nada** con STJ (`T0501`, `T0502`). Con `[JsonIgnore]` es un problema de seguridad (`T0503`):

```csharp
using Newtonsoft.Json;   // quedó este using

public class Usuario
{
    [JsonIgnore] public string Clave { get; set; }   // STJ la serializa
}
```

Los dos namespaces tienen `JsonIgnore`, `JsonConverter`, `JsonConstructor` y `JsonExtensionData` con el mismo nombre. **Sacá el paquete del proyecto** (o al menos los `using`) para que el compilador marque lo que falta. Si algún paquete lo arrastra de forma transitiva, el código viejo sigue compilando **(no comprobado)**: buscá `Newtonsoft` en todo el repo.

## Los que se escriben parecido pero no hacen lo mismo

### `Order`

En NJ una propiedad sin `Order` va **antes** que una con `Order = 0`. En STJ el valor por defecto es 0 y empatan por orden de declaración (`T0504`).

| Clase (en orden de declaración) | NJ | STJ |
|---|---|---|
| `Primero` (0), `SinOrden`, `Antes` (-2) | `Antes`, `SinOrden`, `Primero` | `Antes`, `Primero`, `SinOrden` |

### `Required = Required.Always`

`[JsonRequired]` exige que la propiedad **esté**, pero acepta `null`. NJ rechazaba las dos cosas. Sumá `RespectNullableAnnotations = true` y declarala no anulable (`T0505`).

### `[JsonExtensionData]`

Con `Dictionary<string, JsonElement>` la ida y vuelta es igual que en NJ (`T0509`).

- Las claves extra **no** pasan por `DictionaryKeyPolicy` ni por camelCase: salen como están (`T0510`).
- **No uses `JsonObject`.** Con `[JsonExtensionData] public JsonObject? Extra`, la salida fue `{"Id":1,{"color":"rojo"}}`, que no es JSON válido, y sin excepción (`T0517`, .NET 10.0.13). El mismo resultado se reprodujo con una consola aparte en .NET 8.0.34 y 9.0.21 (esa consola no está en `ejemplos/`). No se probó con source generators ni se buscó el reporte oficial.

## Los que STJ no honra

| Atributo o convención | Efecto en STJ | Reemplazo | Test |
|---|---|---|---|
| `[IgnoreDataMember]` | Serializa la propiedad | `[JsonIgnore]` | `T0507` |
| `[DataContract]` / `[DataMember]` | Ignora nombres y filtro | `[JsonPropertyName]`, `[JsonIgnore]` | `T0507` |
| `ShouldSerializeX()` | No lo llama | Modificador (abajo) | `T0508` |
| `[OnDeserialized]` | No lo ejecuta | `IJsonOnDeserialized` | `T0513` |
| `[JsonObject(MemberSerialization.OptIn)]` | No existe | Modificador y atributos propios | `T0516` |

Las interfaces hermanas `IJsonOnDeserializing`, `IJsonOnSerializing` y `IJsonOnSerialized` cubren los otros tres callbacks **(no comprobado)**.

### `ShouldSerializeX` sin reescribir las clases

```csharp
// using System.Reflection;
static void RespetarShouldSerialize(JsonTypeInfo info)
{
    if (info.Kind != JsonTypeInfoKind.Object) return;
    foreach (var p in info.Properties)
    {
        var miembro = (p.AttributeProvider as MemberInfo)?.Name;
        if (miembro is null) continue;
        var metodo = info.Type.GetMethod("ShouldSerialize" + miembro, Type.EmptyTypes);
        if (metodo is null || metodo.ReturnType != typeof(bool)) continue;
        p.ShouldSerialize = (obj, _) => (bool)metodo.Invoke(obj, null)!;
    }
}

var o = new JsonSerializerOptions
{
    TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { RespetarShouldSerialize } }
};
```

Usa reflexión: no es para AOT.

## Otros

- `[JsonConstructor]` funciona igual para elegir entre dos constructores (`T0511`).
- Un miembro privado se incluye con `[JsonInclude]`, como antes con `[JsonProperty]` (`T0512`).
- `SnakeCaseNamingStrategy` es `JsonNamingPolicy.SnakeCaseLower`; coinciden en `NombreCompleto` y `URLBase` (`T0514`). Otros nombres raros (con números, siglas seguidas) conviene compararlos.
- `[JsonNumberHandling(JsonNumberHandling.WriteAsString)]` escribe un `long` entre comillas, para que JavaScript no pierda dígitos (`T0515`). La pérdida del lado de JavaScript **(no comprobado)**.
