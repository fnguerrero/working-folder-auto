/* Cuenta las palabras de cada capítulo y del total. Con --estricto exige 18 capítulos, cada uno entre 1.400 y 3.200 palabras
   y un total entre 35.000 y 45.000.    node tests/palabras.test.js [--estricto] */
"use strict";
const fs = require("node:fs"); const path = require("node:path");
const RAIZ = path.join(__dirname, ".."); const estricto = process.argv.includes("--estricto");
const meta = JSON.parse(fs.readFileSync(path.join(RAIZ, "meta.json"), "utf8"));
const dir = path.join(RAIZ, "capitulos");
const contar = (md) => md.replace(/^# .*$/m, "").replace(/^> .*$/m, "").replace(/[*#>\-—«»…¿?¡!.,;:()"']/g, " ").split(/\s+/).filter(Boolean).length;
let total = 0, fallas = 0; const filas = [];
for (const f of fs.readdirSync(dir).filter((f) => /^\d\d\.md$/.test(f)).sort()) {
  const md = fs.readFileSync(path.join(dir, f), "utf8"); const n = contar(md); total += n;
  const titulo = (/^# (.*)$/m.exec(md) || [, "?"])[1];
  filas.push(`${f.slice(0, 2)}  ${String(n).padStart(5)}  ${titulo}`);
  if (estricto && (n < 1400 || n > 3200)) { fallas++; console.log(`✗ ${f}: ${n} palabras (fuera de 1.400-3.200)`); }
}
console.log(filas.join("\n")); console.log(`Total: ${total.toLocaleString("es-AR")} palabras en ${filas.length} de ${meta.total} capítulos.`);
if (estricto) {
  if (filas.length !== meta.total) { fallas++; console.log(`✗ Faltan capítulos: ${filas.length} de ${meta.total}`); }
  if (total < 35000 || total > 45000) { fallas++; console.log(`✗ Total fuera de 35.000-45.000`); }
}
process.exit(fallas ? 1 : 0);
