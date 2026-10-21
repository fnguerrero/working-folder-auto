# Working Folder Auto: convenciones

Repo del **Programador nocturno**. Es PÚBLICO y se publica con GitHub Pages en
https://fnguerrero.github.io/working-folder-auto/, así que nunca van datos personales, claves ni nada privado.

## Estructura

| Carpeta | Qué va |
|---|---|
| `juegos/<slug>/` | Juegos. |
| `apps/<slug>/` | Aplicaciones: web/PWA, de escritorio o mobile. |
| `herramientas/<slug>/` | Scripts, automatizaciones y procesos. |
| `escritos/<slug>/` | Libros, ensayos, guías e investigaciones. |
| `experimentos/<slug>/` | Lo exploratorio o que no entra en otra categoría. |
| `_archivo/<categoría>/<slug>/` | Lo que Nico rechazó o no prosperó. No se borra, se mueve acá. |

- Cada proyecto tiene su propio `README.md`: qué es, estado, cómo se prueba y, si aplica, qué no se pudo probar.
- La spec, el checklist y la bitácora de un proyecto de varias noches van en `<proyecto>/.nonstop/`.
- Al crear, terminar o archivar un proyecto se actualizan `proyectos.json` (lo lee la vitrina, `index.html`) y la tabla del `README.md` de la raíz.
- Cada entrada de `proyectos.json` lleva, además de slug, nombre, categoría, descripción (una línea), estado, probar y desde: `icono` (un emoji), `para` (`1+` para Valentín, sin puntaje ni derrota; `3+` chicos que siguen una consigna; `todos` para cualquiera; `devs` para programadores .NET), `detalle` (dos o tres oraciones: qué es y para qué sirve, se ve al desplegar «Qué es, un poco más») y `destacado` (true para que salga en «Lo más copado»; no más de diez). También `actualizado` (AAAA-MM-DD de la última vez que se tocó el proyecto; al crearlo es igual a `desde`).
- Volver sobre un proyecto terminado para mejorarlo es bienvenido (una idea nueva, una función que le falta, algo que se puede hacer mejor): se commitea y pushea antes lo que esté a medias, se hace la mejora, se actualiza `actualizado` y va en la bitácora como `mejora`.
- Estados: `en curso`, `terminado`, `archivado`. Como máximo 3 `en curso` a la vez.

## Cómo se trabaja

- Directo sobre `main`: commit y push, sin PRs. Nunca force push ni reescribir historia.
- Commits en español y descriptivos, sin `Co-Authored-By` ni menciones a Claude, Anthropic o la IA.
- Textos en español rioplatense. El contexto es Argentina.
- Cuando se le indica a Nico un lugar (un issue, una pantalla de GitHub, un proyecto), siempre con la URL completa para que haga clic, nunca "Settings → Pages" a secas.
- Deploy: `.github/workflows/pages.yml` publica `main` en GitHub Pages en cada push (Source: GitHub Actions). Si el sitio no responde, revisar https://github.com/fnguerrero/working-folder-auto/actions antes de tocar nada.

## Proyectos web

- HTML, CSS y JavaScript puro, sin dependencias, CDNs ni assets externos salvo que sean imprescindibles (y se justifica en el README).
- Funcionan en el celular (táctil) y en la compu (teclado y mouse).
- Rutas relativas, para que anden igual en GitHub Pages y abiertos en local.
- `localStorage` siempre dentro de try/catch.
- Link para probar: `https://fnguerrero.github.io/working-folder-auto/<categoría>/<slug>/`.

## Juegos

- Un `index.html` autocontenido: gráficos con canvas, SVG o CSS y sonido con WebAudio.
- Los de Valentín (sobrino de Nico, de alrededor de 1 año) no llevan puntaje ni derrota.
