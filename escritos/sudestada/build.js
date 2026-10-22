/* Genera index.html (lector por capítulos), sudestada.html (novela entera, para imprimir) a partir de capitulos/NN.md y meta.json.
   Markdown mínimo: `# Título`, `> Cuándo`, `---` separador de escena, `*cursiva*`, párrafos separados por línea en blanco.
     node build.js            (después: python3 epub.py para el .epub) */
"use strict";
const fs = require("node:fs"); const path = require("node:path");
const RAIZ = __dirname;
const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, "meta.json"), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) { return esc(s).replace(/\*([^*\n]+)\*/g, "<em>$1</em>"); }
function parsear(md, n) {
  const lineas = md.replace(/\r/g, "").split("\n"); let titulo = "", cuando = ""; const partes = []; let parrafo = [];
  const cerrar = () => { if (parrafo.length) { partes.push(`<p>${inline(parrafo.join(" "))}</p>`); parrafo = []; } };
  for (const l of lineas) {
    if (/^# /.test(l) && !titulo) { titulo = l.slice(2).trim(); continue; }
    if (/^> /.test(l) && !cuando) { cuando = l.slice(2).trim(); continue; }
    if (/^---\s*$/.test(l)) { cerrar(); partes.push('<p class="sep" role="separator">⁂</p>'); continue; }
    if (!l.trim()) { cerrar(); continue; }
    parrafo.push(l.trim());
  }
  cerrar();
  const palabras = md.replace(/^# .*$/m, "").replace(/^> .*$/m, "").replace(/[*#>\-—«»…¿?¡!.,;:()"']/g, " ").split(/\s+/).filter(Boolean).length;
  return { n, titulo, cuando, html: partes.join("\n"), palabras };
}
const dir = path.join(RAIZ, "capitulos");
const caps = fs.readdirSync(dir).filter((f) => /^\d\d\.md$/.test(f)).sort().map((f) => parsear(fs.readFileSync(path.join(dir, f), "utf8"), parseInt(f, 10)));
const total = meta.total, escritos = caps.length, palabras = caps.reduce((a, c) => a + c.palabras, 0);
const enCurso = escritos < total;
const sinopsisHtml = meta.sinopsis.map((p) => `<p>${inline(p)}</p>`).join("\n");
const TEMA = `
  :root { --bg: #fbfaf6; --fg: #262320; --suave: #6f6960; --linea: #e3dfd6; --panel: #f1ede5; --acento: #8a4b2f; --ancho: 38rem; --tam: 1.08rem; color-scheme: light; }
  :root[data-tema="oscuro"] { --bg: #14161a; --fg: #e6e2da; --suave: #9c968c; --linea: #2a2e35; --panel: #1c1f25; --acento: #e0a36a; color-scheme: dark; }
  @media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) { --bg: #14161a; --fg: #e6e2da; --suave: #9c968c; --linea: #2a2e35; --panel: #1c1f25; --acento: #e0a36a; color-scheme: dark; } }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: var(--tam)/1.65 Georgia, "Noto Serif", "Times New Roman", serif; }
  a { color: var(--acento); }
  h1, h2, h3 { font-family: Georgia, "Noto Serif", serif; font-weight: 400; line-height: 1.15; letter-spacing: -.01em; }
  p { margin: 0 0 1em; text-wrap: pretty; }
  .texto p + p { text-indent: 1.4em; margin-top: -1em; margin-bottom: 1em; }
  .texto p.sep, .texto p.sep + p { text-indent: 0; }
  .texto p.sep { text-align: center; margin: 1.6em 0; color: var(--suave); letter-spacing: .3em; }
  .texto p + p.sep { margin-top: .6em; }
  em { font-style: italic; }
  .cuando { color: var(--suave); font-style: italic; margin: 0 0 1.8em; }
  .num { display: block; color: var(--suave); font-size: .8em; letter-spacing: .14em; text-transform: uppercase; margin-bottom: .4em; font-family: system-ui, sans-serif; }
`;
/* ---- Lector ---- */
const datos = caps.map((c) => ({ n: c.n, titulo: c.titulo, cuando: c.cuando, html: c.html, palabras: c.palabras }));
const lector = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${esc(meta.descripcion)}">
<title>${esc(meta.titulo)}</title>
<style>${TEMA}
  .barra { position: fixed; top: 0; left: 0; right: 0; height: 3px; background: transparent; z-index: 5; }
  .barra i { display: block; height: 100%; width: 0; background: var(--acento); transition: width .15s linear; }
  header.sup { position: sticky; top: 0; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--linea); z-index: 4; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: .9rem; }
  header.sup .fila { max-width: var(--ancho); margin: 0 auto; padding: 8px 16px; display: flex; align-items: center; gap: 8px; min-height: 44px; }
  header.sup .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--suave); }
  header.sup a, header.sup button { color: var(--fg); text-decoration: none; background: none; border: 1px solid var(--linea); border-radius: 8px; padding: 6px 10px; font: inherit; cursor: pointer; line-height: 1; min-height: 32px; }
  header.sup a:hover, header.sup button:hover { background: var(--panel); }
  main { max-width: var(--ancho); margin: 0 auto; padding: 28px 16px 60px; }
  .portada h1 { font-size: clamp(2.6rem, 10vw, 4rem); margin: .6em 0 0; }
  .portada .bajada { color: var(--suave); font-style: italic; margin: .2em 0 2em; }
  .portada .sinopsis { border-left: 3px solid var(--acento); padding-left: 1em; margin: 0 0 2em; }
  .acciones { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 2.2em; font-family: system-ui, sans-serif; }
  .boton { display: inline-block; background: var(--acento); color: var(--bg); text-decoration: none; padding: 11px 18px; border-radius: 10px; font-weight: 600; font-size: .95rem; }
  .boton.sec { background: var(--panel); color: var(--fg); border: 1px solid var(--linea); font-weight: 500; }
  .indice { list-style: none; padding: 0; margin: 0 0 2em; }
  .indice li { border-top: 1px solid var(--linea); }
  .indice li:last-child { border-bottom: 1px solid var(--linea); }
  .indice a { display: flex; gap: 12px; align-items: baseline; padding: 11px 4px; text-decoration: none; color: var(--fg); }
  .indice a:hover { background: var(--panel); }
  .indice .n { color: var(--suave); font-variant-numeric: tabular-nums; width: 2ch; text-align: right; flex: none; font-family: system-ui, sans-serif; font-size: .85em; }
  .indice .t { flex: 1; }
  .indice .c { color: var(--suave); font-size: .82em; font-style: italic; white-space: nowrap; }
  .indice li.leido .t { color: var(--suave); }
  .indice li.actual a { color: var(--acento); }
  .nota { background: var(--panel); border-radius: 10px; padding: 10px 14px; font-family: system-ui, sans-serif; font-size: .9rem; color: var(--suave); margin: 0 0 2em; }
  .capitulo h1 { font-size: clamp(1.7rem, 6vw, 2.3rem); margin: .4em 0 .3em; }
  nav.pie { display: flex; justify-content: space-between; gap: 10px; margin-top: 3em; padding-top: 1.2em; border-top: 1px solid var(--linea); font-family: system-ui, sans-serif; }
  nav.pie a { text-decoration: none; color: var(--fg); border: 1px solid var(--linea); border-radius: 10px; padding: 10px 14px; max-width: 48%; }
  nav.pie a small { display: block; color: var(--suave); font-size: .78em; }
  nav.pie a.sig { text-align: right; margin-left: auto; }
  nav.pie a:hover { background: var(--panel); }
  .fin { text-align: center; color: var(--suave); font-style: italic; margin-top: 3em; }
  .pie-vitrina { margin-top: 3em; color: var(--suave); font-family: system-ui, sans-serif; font-size: .85rem; }
  @media (max-width: 420px) { .indice .c { display: none; } }
</style>
</head>
<body>
<div class="barra" aria-hidden="true"><i id="progreso"></i></div>
<header class="sup"><div class="fila">
  <a href="#indice" id="ir-indice" aria-label="Índice">☰ Índice</a>
  <span class="titulo" id="titulo-sup">${esc(meta.titulo)}</span>
  <button type="button" id="letra-menos" aria-label="Letra más chica">A−</button>
  <button type="button" id="letra-mas" aria-label="Letra más grande">A+</button>
  <button type="button" id="tema" aria-label="Cambiar tema">◐</button>
</div></header>
<main id="main"></main>
<script>
"use strict";
const META = ${JSON.stringify({ titulo: meta.titulo, bajada: meta.bajada, sinopsis: meta.sinopsis, total, autor: meta.autor })};
const CAPITULOS = ${JSON.stringify(datos)};
const CLAVE = "sudestada";
function leer() { try { return JSON.parse(localStorage.getItem(CLAVE) || "{}") || {}; } catch { return {}; } }
function guardar(cambios) { try { const e = Object.assign(leer(), cambios); localStorage.setItem(CLAVE, JSON.stringify(e)); } catch {} }
const main = document.getElementById("main"), titSup = document.getElementById("titulo-sup"), prog = document.getElementById("progreso");
const h = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function aplicarPrefs() {
  const p = leer();
  document.documentElement.dataset.tema = p.tema || "auto";
  document.documentElement.style.setProperty("--tam", (p.tam || 1.08) + "rem");
}
function portada() {
  const p = leer(); const sigue = p.cap && CAPITULOS.some((c) => c.n === p.cap);
  const items = CAPITULOS.map((c) => \`<li class="\${p.cap === c.n ? "actual" : (p.leidos || []).includes(c.n) ? "leido" : ""}"><a href="#cap-\${c.n}"><span class="n">\${c.n}</span><span class="t">\${h(c.titulo)}</span><span class="c">\${h(c.cuando)}</span></a></li>\`).join("");
  const nota = CAPITULOS.length < META.total ? \`<div class="nota">La novela está en curso: hay \${CAPITULOS.length} de \${META.total} capítulos publicados. Los que faltan van saliendo noche a noche.</div>\` : "";
  main.innerHTML = \`<section class="portada">
    <h1>\${h(META.titulo)}</h1><p class="bajada">\${h(META.bajada)}</p>
    <div class="sinopsis">\${META.sinopsis.map((s) => "<p>" + h(s).replace(/\\*([^*]+)\\*/g, "<em>$1</em>") + "</p>").join("")}</div>
    <div class="acciones">\${sigue ? \`<a class="boton" href="#cap-\${p.cap}">Seguir leyendo · cap. \${p.cap}</a><a class="boton sec" href="#cap-1">Empezar de nuevo</a>\` : \`<a class="boton" href="#cap-1">Empezar a leer</a>\`}
      <a class="boton sec" href="sudestada.html">Novela entera (para imprimir)</a><a class="boton sec" href="sudestada.epub" download>EPUB</a></div>
    \${nota}
    <h2 id="indice-titulo">Capítulos</h2><ol class="indice">\${items}</ol>
    <p class="pie-vitrina"><a href="../../">← Volver a la vitrina</a> · \${h(META.autor)}</p></section>\`;
  titSup.textContent = META.titulo; prog.style.width = "0";
  document.title = META.titulo;
}
function capitulo(n) {
  const i = CAPITULOS.findIndex((c) => c.n === n); if (i < 0) { location.hash = "#indice"; return; }
  const c = CAPITULOS[i], ant = CAPITULOS[i - 1], sig = CAPITULOS[i + 1];
  main.innerHTML = \`<article class="capitulo"><h1><span class="num">Capítulo \${c.n} de \${META.total}</span>\${h(c.titulo)}</h1><p class="cuando">\${h(c.cuando)}</p><div class="texto">\${c.html}</div>
    \${!sig && CAPITULOS.length >= META.total ? '<p class="fin">Fin</p>' : !sig ? '<p class="fin">Hasta acá por ahora. El capítulo que sigue sale otra noche.</p>' : ""}
    <nav class="pie">\${ant ? \`<a class="ant" href="#cap-\${ant.n}"><small>← Anterior</small>\${ant.n}. \${h(ant.titulo)}</a>\` : \`<a class="ant" href="#indice"><small>←</small>Índice</a>\`}\${sig ? \`<a class="sig" href="#cap-\${sig.n}"><small>Siguiente →</small>\${sig.n}. \${h(sig.titulo)}</a>\` : \`<a class="sig" href="#indice"><small>→</small>Índice</a>\`}</nav></article>\`;
  titSup.textContent = c.n + ". " + c.titulo; document.title = c.n + ". " + c.titulo + " · " + META.titulo;
  const p = leer(); const leidos = new Set(p.leidos || []); if (ant) leidos.add(ant.n);
  guardar({ cap: n, leidos: [...leidos] });
  const pos = p.cap === n ? (p.pos || 0) : 0;
  requestAnimationFrame(() => { window.scrollTo(0, pos * Math.max(1, document.documentElement.scrollHeight - innerHeight)); });
}
let capActual = 0;
function ruta() {
  const m = /^#cap-(\\d+)$/.exec(location.hash);
  if (m) { capActual = parseInt(m[1], 10); capitulo(capActual); } else { capActual = 0; portada(); if (location.hash !== "#indice") window.scrollTo(0, 0); }
}
let t = 0;
addEventListener("scroll", () => {
  if (!capActual) return;
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); const f = Math.min(1, scrollY / max);
  prog.style.width = (f * 100).toFixed(1) + "%";
  clearTimeout(t); t = setTimeout(() => guardar({ cap: capActual, pos: f }), 150);
}, { passive: true });
addEventListener("hashchange", ruta);
addEventListener("keydown", (e) => {
  if (!capActual || e.altKey || e.ctrlKey || e.metaKey) return;
  const i = CAPITULOS.findIndex((c) => c.n === capActual);
  if (e.key === "ArrowRight" && CAPITULOS[i + 1]) location.hash = "#cap-" + CAPITULOS[i + 1].n;
  if (e.key === "ArrowLeft" && CAPITULOS[i - 1]) location.hash = "#cap-" + CAPITULOS[i - 1].n;
});
document.getElementById("tema").addEventListener("click", () => {
  const orden = ["auto", "oscuro", "claro"]; const p = leer(); const sig = orden[(orden.indexOf(p.tema || "auto") + 1) % orden.length];
  guardar({ tema: sig }); aplicarPrefs();
});
document.getElementById("letra-mas").addEventListener("click", () => { guardar({ tam: Math.min(1.6, (leer().tam || 1.08) + 0.08) }); aplicarPrefs(); });
document.getElementById("letra-menos").addEventListener("click", () => { guardar({ tam: Math.max(0.84, (leer().tam || 1.08) - 0.08) }); aplicarPrefs(); });
aplicarPrefs(); ruta();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(RAIZ, "index.html"), lector);
/* ---- Novela entera (para imprimir) ---- */
const entero = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${esc(meta.descripcion)}">
<title>${esc(meta.titulo)} · novela entera</title>
<style>${TEMA}
  main { max-width: var(--ancho); margin: 0 auto; padding: 28px 16px 80px; }
  .portada { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; }
  .portada h1 { font-size: clamp(2.6rem, 10vw, 4.2rem); margin: 0; }
  .portada .bajada { color: var(--suave); font-style: italic; margin: .3em 0 2em; }
  .portada .sinopsis { border-left: 3px solid var(--acento); padding-left: 1em; }
  .indice { list-style: none; padding: 0; }
  .indice li { padding: 4px 0; }
  .indice a { text-decoration: none; color: var(--fg); }
  .indice .n { color: var(--suave); display: inline-block; width: 2.4ch; text-align: right; margin-right: .8ch; }
  .capitulo { margin-top: 4em; }
  .capitulo h1 { font-size: clamp(1.7rem, 6vw, 2.3rem); margin: 0 0 .3em; }
  .fin { text-align: center; color: var(--suave); font-style: italic; margin-top: 3em; }
  .meta { color: var(--suave); font-family: system-ui, sans-serif; font-size: .85rem; }
  @media print {
    :root { --bg: #fff; --fg: #000; --suave: #444; --acento: #000; --tam: 11pt; }
    body { line-height: 1.5; }
    main { max-width: none; padding: 0; }
    .portada, .indice-pag, .capitulo { page-break-before: always; break-before: page; }
    .portada { page-break-before: avoid; break-before: avoid; min-height: 0; margin-top: 30vh; }
    .meta, header { display: none; }
    a { color: inherit; text-decoration: none; }
    @page { margin: 2.2cm; }
  }
</style>
</head>
<body>
<main>
<p class="meta"><a href="./">← Volver al lector por capítulos</a> · <a href="../../">Vitrina</a></p>
<section class="portada"><h1>${esc(meta.titulo)}</h1><p class="bajada">${esc(meta.bajada)}</p><div class="sinopsis">${sinopsisHtml}</div><p class="meta">${esc(meta.autor)}${enCurso ? ` · en curso, ${escritos} de ${total} capítulos` : ""}</p></section>
<section class="indice-pag"><h2>Capítulos</h2><ol class="indice">${caps.map((c) => `<li><a href="#cap-${c.n}"><span class="n">${c.n}</span>${esc(c.titulo)}</a></li>`).join("")}</ol></section>
${caps.map((c) => `<article class="capitulo" id="cap-${c.n}"><h1><span class="num">Capítulo ${c.n}</span>${esc(c.titulo)}</h1><p class="cuando">${esc(c.cuando)}</p><div class="texto">${c.html}</div></article>`).join("\n")}
${enCurso ? `<p class="fin">Hasta acá por ahora: ${escritos} de ${total} capítulos.</p>` : '<p class="fin">Fin</p>'}
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(RAIZ, "sudestada.html"), entero);
console.log(`index.html y sudestada.html: ${escritos}/${total} capítulos, ${palabras.toLocaleString("es-AR")} palabras.`);
