# 10. Tabla de equivalencias

[Anterior](09-aspnet-core.md) · [Índice](README.md) · [Siguiente](11-sin-equivalente.md)

"Con cambios" quiere decir que no se comporta igual: leé el test antes de reemplazar.

## Atributos

| Newtonsoft | System.Text.Json | ¿Igual? | Test |
|---|---|---|---|
| `[JsonProperty("x")]` | `[JsonPropertyName("x")]` | Sí | `T0501` |
| `[JsonProperty]` en miembro privado | `[JsonInclude]` | Sí | `T0512` |
| `[JsonProperty(Order = n)]` | `[JsonPropertyOrder(n)]` | Con cambios | `T0504` |
| `[JsonProperty(Required = Required.Always)]` | `[JsonRequired]` + `RespectNullableAnnotations` | Con cambios | `T0505` |
| `[JsonProperty(NullValueHandling = Ignore)]` | `[JsonIgnore(Condition = WhenWritingNull)]` | Al escribir | `T0506` |
| `[JsonProperty(DefaultValueHandling = Ignore)]` | `[JsonIgnore(Condition = WhenWritingDefault)]` | Con cambios (`[DefaultValue]`) | `T0506`, `T0207` |
| `[JsonIgnore]` | `[JsonIgnore]` (otro namespace) | Sí | `T0503` |
| `[JsonConstructor]` | `[JsonConstructor]` (otro namespace) | Sí | `T0511` |
| `[JsonExtensionData]` | `[JsonExtensionData]` sobre `Dictionary<string, JsonElement>` | Sí; no usar `JsonObject` | `T0509`, `T0517` |
| `[JsonConverter(typeof(X))]` | `[JsonConverter(typeof(Y))]` | Con cambios (precedencia) | `T0603` |
| `[JsonObject(NamingStrategyType = ...)]` | `PropertyNamingPolicy` en las opciones | Cambia el alcance | `T0514` |
| `[JsonObject(MemberSerialization.OptIn)]` | Modificador propio | No directo | `T0516` |
| `[EnumMember(Value = "x")]` | `[JsonStringEnumMemberName("x")]` | Sí | `T0409`, `T0410` |
| `[DataContract]`, `[DataMember]`, `[IgnoreDataMember]` | `[JsonPropertyName]`, `[JsonIgnore]` | STJ los ignora | `T0507` |
| `[OnDeserialized]` | `IJsonOnDeserialized` | Es interfaz | `T0513` |
| `ShouldSerializeX()` | Modificador con `ShouldSerialize` | No directo | `T0508` |

## Converters

| Newtonsoft | System.Text.Json | Test |
|---|---|---|
| `JsonConverter<T>` | `JsonConverter<T>` | `T0601` |
| Converter con `CanConvert` para una familia | `JsonConverterFactory` | `T0605` |
| `StringEnumConverter` | `JsonStringEnumConverter` | `T0403` |
| `IsoDateTimeConverter` / `DateFormatString` | Converter propio (probado contra `DateFormatString`, no contra `IsoDateTimeConverter`) | `T0311` |
| `UnixDateTimeConverter` | Converter propio | `T0606` |
| `VersionConverter` | Incluido | `T0607` |
| `CustomCreationConverter<T>` | `JsonTypeInfo.CreateObject` | `T0609` |

## Settings

| Newtonsoft | System.Text.Json | Test |
|---|---|---|
| `CamelCasePropertyNamesContractResolver` | `PropertyNamingPolicy` + `DictionaryKeyPolicy` + `PropertyNameCaseInsensitive` | `T0103`, `T0104` |
| `SnakeCaseNamingStrategy` | `JsonNamingPolicy.SnakeCaseLower` | `T0514` |
| `NullValueHandling.Ignore` | `DefaultIgnoreCondition = WhenWritingNull` (más modificador si importa la lectura) | `T0202` a `T0204` |
| `DefaultValueHandling.Ignore` | `DefaultIgnoreCondition = WhenWritingDefault` | `T0207` |
| `MissingMemberHandling.Error` | `UnmappedMemberHandling = Disallow` | `T0111` |
| `ObjectCreationHandling.Auto` (defecto de NJ) | `PreferredObjectCreationHandling = Populate` (probado con una lista sin setter) | `T0108` |
| `ReferenceLoopHandling.Ignore` | `ReferenceHandler.IgnoreCycles` | `T0117` |
| `PreserveReferencesHandling.Objects` | `ReferenceHandler.Preserve` | `T0118` |
| `Formatting.Indented` | `WriteIndented = true` | `T0119` |
| `DateTimeZoneHandling.Utc` | Converter propio | `T0313` |
| `DateParseHandling.DateTime` (defecto de NJ) | No convierte: queda string | `T0305` |
| `FloatParseHandling.Decimal` | No hace falta: se conserva el texto | `T0216` |
| `TypeNameHandling` | `[JsonDerivedType]` | `T0703`, `T0709` |
| `Error` | Sin equivalente usado acá | `T0616` |

## Árbol dinámico

| Newtonsoft | System.Text.Json | Test |
|---|---|---|
| `JObject`, `JArray`, `JValue` | `JsonObject`, `JsonArray`, `JsonValue` | `T0221` (objetos y arrays) |
| `JToken.Parse` | `JsonNode.Parse` | `T0120` |
| `ToObject<T>()` | `Deserialize<T>()` | `T0306` |
| `SelectToken` | Indexadores encadenados | `T0221` |
| `Merge` | Función propia | `T0614`, `T0615` |
| Reasignar un token a otro árbol | `DeepClone()` primero | `T0222` |
