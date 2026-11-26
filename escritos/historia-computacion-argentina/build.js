// Genera las páginas HTML a partir de contenido.js. Sin dependencias: node build.js
const fs = require('fs');
const path = require('path');
const { fuentes, capitulos, linea, dudas } = require('./contenido');

const claves = Object.keys(fuentes);
const num = k => {
  const i = claves.indexOf(k);
  if (i < 0) throw new Error('Fuente inexistente: ' + k);
  return i + 1;
};
const cita = ks => '<sup>' + ks.split(',').map(k => `<a href="fuentes.html#f${num(k)}" aria-label="Fuente ${num(k)}">[${num(k)}]</a>`).join('') + '</sup>';
const citas = t => t.replace(/\[\[([\w,]+)\]\]/g, (_, ks) => cita(ks));

const rotulos = { difiere: 'Las fuentes no coinciden', anecdota: 'Relato, no hecho comprobado' };
function bloque(b) {
  if (typeof b === 'string') return `<p>${citas(b)}</p>`;
  const [tipo, v] = b;
  if (tipo === 'h') return `<h2>${v}</h2>`;
  if (tipo === 'lista') return `<ul>${v.map(x => `<li>${citas(x)}</li>`).join('')}</ul>`;
  return `<aside class="${tipo}"><strong>${rotulos[tipo]}.</strong> ${citas(v)}</aside>`;
}

// Orden de lectura: índice, capítulos, dudas, fuentes.
const paginas = [
  ['index.html', 'Índice'],
  ...capitulos.map((c, i) => [c.slug + '.html', `${i + 1}. ${c.titulo}`]),
  ['no-confirmado.html', 'Lo que no pude confirmar'],
  ['fuentes.html', 'Bibliografía'],
];

function pagina(archivo, titulo, cuerpo) {
  const i = paginas.findIndex(p => p[0] === archivo);
  const ant = paginas[i - 1], sig = paginas[i + 1];
  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<link rel="stylesheet" href="estilo.css">
<script src="lectura.js"></script>
</head>
<body>
<header class="barra">
<a href="index.html">Índice</a>
<span class="controles">
<button type="button" data-accion="menos" aria-label="Letra más chica">A−</button>
<button type="button" data-accion="mas" aria-label="Letra más grande">A+</button>
<button type="button" data-accion="tema">Claro / oscuro</button>
</span>
</header>
<main>
${cuerpo}
</main>
<nav class="pasos">
${ant ? `<a href="${ant[0]}">← ${ant[1]}</a>` : '<span></span>'}
${sig ? `<a class="sig" href="${sig[0]}">${sig[1]} →</a>` : '<span></span>'}
</nav>
</body>
</html>
`;
  fs.writeFileSync(path.join(__dirname, archivo), html);
}

const minutos = c => {
  const texto = c.cuerpo.map(b => typeof b === 'string' ? b : [].concat(b[1]).join(' ')).join(' ').replace(/\[\[[\w,]+\]\]/g, '');
  return Math.max(1, Math.round(texto.split(/\s+/).length / 200));
};

pagina('index.html', 'Clementina y los que vinieron después', `
<h1>Clementina y los que vinieron después</h1>
<p class="bajada">Una historia corta de la computación en la Argentina, de 1958 a la Economía del Conocimiento, con las fuentes a un toque y separando lo documentado de lo que es relato.</p>
<h2>Capítulos</h2>
<ol class="capitulos">
${capitulos.map(c => `<li><a href="${c.slug}.html"><b>${c.titulo}</b><span>${c.años} · ${minutos(c)} min</span><em>${c.bajada}</em></a></li>`).join('\n')}
</ol>
<p><a href="no-confirmado.html">Lo que no pude confirmar</a> · <a href="fuentes.html">Bibliografía</a></p>
<h2>Línea de tiempo</h2>
<ol class="tiempo">
${linea.map(([f, t, k, c]) => `<li><time>${f}</time><span><a href="${capitulos[c].slug}.html">${t}</a>${cita(k)}</span></li>`).join('\n')}
</ol>
<p class="nota">Fuentes consultadas en línea el 26 de noviembre de 2026.</p>`);

capitulos.forEach((c, i) => pagina(c.slug + '.html', `${c.titulo} (${c.años})`, `
<p class="sobre">Capítulo ${i + 1} · ${c.años} · ${minutos(c)} min</p>
<h1>${c.titulo}</h1>
<p class="bajada">${c.bajada}</p>
${c.cuerpo.map(bloque).join('\n')}`));

pagina('no-confirmado.html', 'Lo que no pude confirmar', `
<h1>Lo que no pude confirmar</h1>
${dudas.map(bloque).join('\n')}`);

pagina('fuentes.html', 'Bibliografía', `
<h1>Bibliografía</h1>
<p class="bajada">Todas abiertas y leídas (completas o en los pasajes citados) el 26 de noviembre de 2026.</p>
<ol class="fuentes">
${claves.map((k, i) => { const [quien, que, url] = fuentes[k]; return `<li id="f${i + 1}">${quien}. <a href="${url}" rel="noopener">${que}</a>.</li>`; }).join('\n')}
</ol>`);

console.log(paginas.length + ' páginas, ' + claves.length + ' fuentes, ' + capitulos.reduce((s, c) => s + minutos(c), 0) + ' min de lectura');
