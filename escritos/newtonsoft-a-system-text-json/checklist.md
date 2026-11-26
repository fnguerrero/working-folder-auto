# Checklist para el PR

[Índice](README.md)

Copiá el bloque en la descripción del PR.

```markdown
## Migración a System.Text.Json

**Antes**
- [ ] Hay fixtures con JSON real de entrada y salida, generados con Newtonsoft
- [ ] Relevados: `JsonConvert`, `JObject`, `JToken`, `JsonSerializerSettings`, `AddNewtonsoftJson`

**Atributos y tipos**
- [ ] No queda ningún `using Newtonsoft` (ojo `[JsonIgnore]`: STJ publica la propiedad)
- [ ] `[JsonProperty]` reemplazado; revisados `Order` y `Required`
- [ ] `[EnumMember]`, `[DataContract]`, `[IgnoreDataMember]`, `ShouldSerialize*`, `[OnDeserialized]` reemplazados
- [ ] Colecciones sin setter o con valores iniciales revisadas
- [ ] Campos públicos y `ValueTuple` revisados
- [ ] `object`, `Dictionary<string, object>`, `BigInteger`, `DataTable` revisados
- [ ] `[JsonExtensionData]` no usa `JsonObject`

**Comportamiento**
- [ ] Mayúsculas: `Web` o `PropertyNameCaseInsensitive` donde se lee JSON ajeno
- [ ] Claves de diccionario: ¿hacía falta camelCase?
- [ ] Enums: ¿entran como texto? Converter registrado
- [ ] Nulos: ¿algo dependía de ignorarlos al leer?
- [ ] Clientes que mandan números como texto, texto como número o `""`
- [ ] Fechas: formatos no ISO, offsets, código que espera `DateTime` dentro de `object`
- [ ] Polimorfismo: derivados registrados; datos guardados con `$type` siguen leyéndose
- [ ] Escapado: nadie compara ni firma el texto exacto
- [ ] Converters globales no pisan sin querer a un `[JsonConverter]` de clase
- [ ] Opciones configuradas en MVC y en minimal APIs, y en cada uso fuera de ASP.NET

**Cierre**
- [ ] Los fixtures dan lo mismo (o la diferencia está acordada con quien consume)
- [ ] Probado con el huso horario del servidor
- [ ] Sacado el paquete `Newtonsoft.Json` (o anotado quién lo necesita todavía)
```
