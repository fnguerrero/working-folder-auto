# 9. ASP.NET Core

[Anterior](08-source-generators-y-aot.md) · [Índice](README.md) · [Siguiente](10-equivalencias.md) · Tests: [C09_AspNetCore.cs](ejemplos/GuiaStj.Tests/C09_AspNetCore.cs)

## Los defaults no son los de `JsonSerializer`

En MVC (`AddControllers`) y en minimal APIs, las opciones registradas tienen (`T0901`):

| Opción | Valor |
|---|---|
| `PropertyNamingPolicy` | camelCase |
| `PropertyNameCaseInsensitive` | `true` |
| `NumberHandling` | Incluye `AllowReadingFromString` |
| `DictionaryKeyPolicy` | Ninguna |
| `DefaultIgnoreCondition` | `Never` (escribe los `null`) |
| `RespectNullableAnnotations` | `false` |
| `JsonStringEnumConverter` | No está |

Por eso un test que usa `JsonSerializer` sin opciones no representa lo que hace tu API. Usá `JsonSerializerOptions.Web` o las opciones registradas.

Los defaults de `AddNewtonsoftJson()` **(no comprobado)**: compará la salida real de tu API antes y después, no la teoría.

## Son dos configuraciones separadas

```csharp
// Controllers
builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Minimal APIs
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
```

Configurar una no afecta a la otra (`T0902`).

## Lo que queda fuera de ASP.NET

Cada `JsonConvert` suelto del código (clientes HTTP, colas, caché, logs, columnas JSON) usa su propia configuración, no la de la API. Al migrarlos, cada uno necesita sus opciones **(no comprobado)**.

## Orden sugerido (sugerencia, no sale de un test)

1. Capturar respuestas y requests reales de los endpoints como fixtures.
2. Migrar los atributos y converters con los dos serializadores conviviendo.
3. Comparar la salida de cada fixture (con `JsonNode.DeepEquals`, para no tropezar con el escapado).
4. Cambiar la API y recién después sacar el paquete.

`DeepEquals` compara estructura; cómo trata `1.0` contra `1` **(no comprobado)**.
