# 8. Source generators y AOT

[Anterior](07-polimorfismo.md) · [Índice](README.md) · [Siguiente](09-aspnet-core.md) · Tests: [C08_SourceGenerators.cs](ejemplos/GuiaStj.Tests/C08_SourceGenerators.cs) y [Aot/](ejemplos/Aot/Program.cs)

No hace falta para migrar. Hacelo después, y solo si vas a AOT o trimming (o si medís que el arranque lo justifica; el rendimiento **no se probó**).

## El contexto

```csharp
[JsonConverter(typeof(JsonStringEnumConverter<Categoria>))]
public enum Categoria { Almacen, Limpieza }

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Producto))]
[JsonSerializable(typeof(List<Producto>))]
internal partial class CatalogoContext : JsonSerializerContext { }
```

```csharp
var json = JsonSerializer.Serialize(producto, CatalogoContext.Default.Producto);
var vuelta = JsonSerializer.Deserialize(json, CatalogoContext.Default.Producto);
```

Produce el mismo JSON que NJ con camelCase y `StringEnumConverter` en el caso probado (`T0801`).

## Trampas

| Situación | Resultado | Test |
|---|---|---|
| `new JsonSerializerOptions { TypeInfoResolver = CatalogoContext.Default }` | **No hereda** las opciones del atributo: sale PascalCase | `T0802` |
| Pasar `CatalogoContext.Default` o `CatalogoContext.Default.Options` | Sí las usa | `T0802` |
| Tipo sin `[JsonSerializable]` | `NotSupportedException` | `T0803` |
| Tipo anónimo | `NotSupportedException` | `T0805` |

Varios contextos se combinan con `JsonTypeInfoResolver.Combine(...)` o `TypeInfoResolverChain` (`T0804`).

## Reflexión apagada

Con `<PublishAot>true</PublishAot>`, la consola de [`ejemplos/Aot`](ejemplos/Aot/Aot.csproj) corrida con `dotnet run` muestra que:

- `JsonSerializer.IsReflectionEnabledByDefault` es `false`.
- Serializar con el contexto funciona.
- `JsonSerializer.Serialize(objeto)` sin contexto tira `InvalidOperationException`.

Es decir, el error aparece ya en desarrollo, no recién en el binario publicado.

## AOT nativo

- La publicación nativa y la ejecución del binario **(no comprobado)**: falta el linker de C++ en la máquina usada. Para probarlo se necesita la carga de trabajo "Desarrollo para el escritorio con C++" de Visual Studio y `dotnet publish -r win-x64 -c Release`.
- Lo que sí se vio, en una consola aparte con `PublishAot` y Newtonsoft 13.0.4: compilar llamadas a `JsonConvert.SerializeObject` y `DeserializeObject<T>` da las advertencias `IL2026` e `IL3050`. Ese proyecto no está en `ejemplos/` y tampoco llegó a generar el binario.
- Los modificadores con reflexión de los capítulos [5](05-atributos.md) y [7](07-polimorfismo.md) no son para AOT **(no comprobado)**.
