# De Newtonsoft.Json a System.Text.Json

Guía corta para migrar un backend .NET sin sorpresas: qué cambia de comportamiento, con qué se reemplaza cada atributo y converter, y qué no tiene reemplazo. Sale del [issue #5](https://github.com/fnguerrero/working-folder-auto/issues/5).

**Estado:** terminado (2026-11-25). Los 142 tests pasan en Windows con .NET SDK 10, Newtonsoft.Json 13.0.4 y el System.Text.Json que trae .NET 10.0.13.

## Antes de tocar nada: lo que más muerde

| Qué pasa | ¿Tira error? | Dónde |
|---|---|---|
| `[JsonIgnore]` del namespace de Newtonsoft no hace nada: **la propiedad se publica** | No | [Atributos](05-atributos.md) |
| Los nombres se leen distinguiendo mayúsculas: las propiedades quedan vacías | No | [Nombres](01-nombres-y-formato.md) |
| Una colección sin setter queda vacía | No | [Nombres](01-nombres-y-formato.md) |
| Una propiedad declarada con el tipo base pierde los campos del derivado | No | [Polimorfismo](07-polimorfismo.md) |
| Ignorar nulos ya no protege el valor inicial al leer | No | [Nulos y tipos](02-nulos-y-tipos.md) |
| `BigInteger` se serializa como un objeto sin sentido | No | [Nulos y tipos](02-nulos-y-tipos.md) |
| `[JsonExtensionData]` sobre un `JsonObject` escribió JSON inválido | No | [Atributos](05-atributos.md) |
| Un enum que llega como texto se rechaza | Sí | [Enums](04-enums.md) |
| `"123"` en un `string`, `"true"` en un `bool` | Sí | [Nulos y tipos](02-nulos-y-tipos.md) |

Los que no tiran error son los que llegan a producción.

## Capítulos

1. [Nombres, forma del objeto y formato](01-nombres-y-formato.md)
2. [Nulos, números y tipos sueltos](02-nulos-y-tipos.md)
3. [Fechas](03-fechas.md)
4. [Enums](04-enums.md)
5. [Atributos](05-atributos.md)
6. [Converters y opciones](06-converters-y-opciones.md)
7. [Polimorfismo](07-polimorfismo.md)
8. [Source generators y AOT](08-source-generators-y-aot.md)
9. [ASP.NET Core](09-aspnet-core.md)
10. [Tabla de equivalencias](10-equivalencias.md)
11. [Lo que no tiene equivalente directo](11-sin-equivalente.md)
12. [Checklist para pegar en el PR](checklist.md)

## Cómo leer la guía

- Un código como `T0102` es el test que comprueba la afirmación. El número `01` es el archivo (`C01_...cs`).
- **(no comprobado)** marca lo que no tiene un ejemplo corrido: tomalo como pista, no como dato.
- "STJ" es System.Text.Json; "NJ", Newtonsoft.Json.
- "Por defecto" significa `JsonSerializer` / `JsonConvert` sin opciones. ASP.NET Core usa otros defaults ([capítulo 9](09-aspnet-core.md)).
- Todo vale para las versiones de arriba. Varias opciones de STJ que aparecen acá no existen en versiones anteriores; en qué versión apareció cada una **(no comprobado)**.

## Cómo correr los tests en Windows

Hace falta el SDK de .NET 10 (`dotnet --list-sdks` tiene que mostrar un `10.x`). Desde la raíz del repo:

```powershell
dotnet test escritos\newtonsoft-a-system-text-json\ejemplos\GuiaStj.Tests
```

Un solo capítulo o un solo caso:

```powershell
dotnet test escritos\newtonsoft-a-system-text-json\ejemplos\GuiaStj.Tests --filter "FullyQualifiedName~C04_Enums"
dotnet test escritos\newtonsoft-a-system-text-json\ejemplos\GuiaStj.Tests --filter "FullyQualifiedName~T0503"
```

El ejemplo de source generators con la reflexión apagada:

```powershell
dotnet run --project escritos\newtonsoft-a-system-text-json\ejemplos\Aot
```

Tiene que mostrar cuatro líneas `OK`.

## Qué no se pudo probar

- La publicación nativa AOT (`dotnet publish -r win-x64`): en la máquina usada falta el linker de C++.
- Los defaults de ASP.NET Core con `AddNewtonsoftJson()`.
- Otros sistemas operativos y .NET 8 / 9 (salvo el caso de `JsonObject` del capítulo 5).
- La restauración desde nuget.org: se compiló solo con paquetes que ya estaban en la caché local.
- Rendimiento: la guía no dice nada al respecto.
