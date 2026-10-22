/* Verifica que cada pista de .nonstop/pistas.json aparece textual en el capítulo donde se siembra y en el que se resuelve.
   Si el capítulo todavía no está escrito, lo informa como pendiente (y falla solo con --estricto).
     node tests/pistas.test.js [--estricto] */
"use strict";
const fs = require("node:fs"); const path = require("node:path");
const RAIZ = path.join(__dirname, ".."); const estricto = process.argv.includes("--estricto");
const pistas = JSON.parse(fs.readFileSync(path.join(RAIZ, ".nonstop", "pistas.json"), "utf8"));
const cap = (n) => { const f = path.join(RAIZ, "capitulos", String(n).padStart(2, "0") + ".md"); return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null; };
let fallas = 0, pendientes = 0, ok = 0;
for (const p of pistas) for (const [fase, d] of [["siembra", p.siembra], ["resuelve", p.resuelve]]) {
  const texto = cap(d.cap);
  if (texto === null) { pendientes++; if (estricto) { fallas++; console.log(`✗ ${p.id} ${fase}: falta el capítulo ${d.cap}`); } continue; }
  if (texto.includes(d.texto)) { ok++; } else { fallas++; console.log(`✗ ${p.id} ${fase} (cap. ${d.cap}): no aparece «${d.texto}» — ${p.que}`); }
}
console.log(`Pistas: ${ok} verificadas, ${pendientes} pendientes (capítulo sin escribir), ${fallas} fallas.`);
process.exit(fallas ? 1 : 0);
