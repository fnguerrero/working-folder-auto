# 11. Lo que no tiene equivalente directo

[Anterior](10-equivalencias.md) · [Índice](README.md) · [Checklist](checklist.md)

"No tiene equivalente directo" es una afirmación sobre una ausencia: un test puede mostrar que el comportamiento difiere, no que no exista ninguna opción. La columna **Comprobado** dice qué se corrió.

| En Newtonsoft | Cómo se zafa | Comprobado |
|---|---|---|
| Leer comillas simples o nombres sin comillas | Corregir el origen | Que STJ los rechaza aun con las opciones tolerantes (`T0114`) |
| `NullValueHandling.Ignore` al leer | Modificador sobre `Set` | Alternativa (`T0204`) |
| Conversión libre entre string, número y booleano | `NumberHandling` para números; converter para el resto | Rechazos (`T0209`, `T0210`) |
| Tipos de .NET dentro de `object` | `JsonElement`, `JsonNode` o converter | Alternativas (`T0213`, `T0219`, `T0220`) |
| `BigInteger` | Converter con `WriteRawValue` | Alternativa (`T0215`) |
| `DateTimeZoneHandling`, `DateFormatString` | Converter | Alternativas (`T0311`, `T0313`) |
| `ShouldSerializeX()` | Modificador | Alternativa (`T0508`) |
| `MemberSerialization.OptIn` | Modificador y atributos propios | Alternativa (`T0516`) |
| `PopulateObject` | Copiar propiedad por propiedad | Alternativa plana (`T0613`) |
| `JObject.Merge` | Función recursiva | Alternativa solo para objetos (`T0614`, `T0615`) |
| `Error` para saltear lo roto | Filtrar el árbol antes de convertir | Alternativa para listas (`T0616`) |
| `DataTable` | DTOs o converter | Que falla (`T0610`); la alternativa no |
| `System.Type` | Nombre propio como string | Que falla (`T0611`); la alternativa no |
| `SelectToken` con JSONPath completo (filtros, comodines) | Recorrer con LINQ o sumar una librería de JSONPath | **(no comprobado)** |
| `JsonConvert.DefaultSettings` | Instancia estática propia | Que `Default` es de solo lectura (`T0618`) |
| `ItemConverterType`, `ItemNullValueHandling` y demás `Item*` | Converter para la colección | **(no comprobado)** |
| `JsonSchema`, conversión XML (`SerializeXNode`) | Otra librería | **(no comprobado)** |

## Cuándo no migrar

Quedarse con Newtonsoft en un punto concreto es válido: un contrato viejo con un cliente que no podés cambiar, mucho `JObject` con JSONPath, o `DataTable` por todos lados. Migrá por bordes (un cliente HTTP, un endpoint) y dejá eso para el final. Es una opinión, no un resultado de los tests.
