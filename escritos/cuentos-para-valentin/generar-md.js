/* Escribe cuentos/<slug>.md a partir de cuentos.js. Uso: node generar-md.js */
'use strict';
const fs = require('fs');
const path = require('path');
const cuentos = require('./cuentos.js');

function aMarkdown(c) {
  const paginas = c.paginas.map((p, i) => `## ${i + 1}\n\n${p.texto}\n`).join('\n');
  return `# ${c.titulo}\n\n*${c.resumen}*\n\n${paginas}\n**Fin**\n`;
}

if (require.main === module) {
  const carpeta = path.join(__dirname, 'cuentos');
  fs.mkdirSync(carpeta, { recursive: true });
  for (const c of cuentos) fs.writeFileSync(path.join(carpeta, `${c.slug}.md`), aMarkdown(c), 'utf8');
  console.log(`${cuentos.length} cuentos escritos en ${carpeta}`);
}

module.exports = aMarkdown;
