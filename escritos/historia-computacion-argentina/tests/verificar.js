// Chequeos estáticos: citas usadas, enlaces internos y anclas. node tests/verificar.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const { fuentes } = require('../contenido');
const fallas = [];
const paginas = fs.readdirSync(raiz).filter(f => f.endsWith('.html'));
const texto = fs.readFileSync(path.join(raiz, 'contenido.js'), 'utf8');
const usadas = new Set([...texto.matchAll(/\[\[([\w,]+)\]\]/g)].flatMap(m => m[1].split(',')));
require('../contenido').linea.forEach(l => l[2].split(',').forEach(k => usadas.add(k)));
for (const k of Object.keys(fuentes)) if (!usadas.has(k)) fallas.push('fuente sin usar: ' + k);
for (const p of paginas) {
  const html = fs.readFileSync(path.join(raiz, p), 'utf8');
  if (html.includes('[[') || html.includes('undefined')) fallas.push(p + ': cita sin resolver o undefined');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^https:/.test(url)) continue;
    const [archivo, ancla] = url.split('#');
    const destino = path.join(raiz, archivo);
    if (!fs.existsSync(destino)) fallas.push(p + ': no existe ' + url);
    else if (ancla && !fs.readFileSync(destino, 'utf8').includes(`id="${ancla}"`)) fallas.push(p + ': ancla rota ' + url);
  }
}
if (fallas.length) { console.error(fallas.join('\n')); process.exit(1); }
console.log(`OK: ${paginas.length} páginas, ${Object.keys(fuentes).length} fuentes, todas usadas y sin enlaces internos rotos`);
