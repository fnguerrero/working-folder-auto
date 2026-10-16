/* Genera las tablas de resultados del escrito a partir de resultados.json y las inserta en index.html
   entre los marcadores <!-- tabla:Clase --> y <!-- /tabla -->. Se corre una vez después de medir:
     node escritos/cuanto-cuesta-dotnet/tablas.js
   Así los números del HTML salen del JSON y no de tipearlos a mano (tests/datos.test.js lo verifica). */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, "resultados.json"), "utf8"));
const rutaHtml = path.join(__dirname, "index.html");
let html = fs.readFileSync(rutaHtml, "utf8");

const ar = (n, d) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
function tiempo(ns) {
  if (ns < 1) return `${ar(ns, 3)} ns`;
  if (ns < 1000) return `${ar(ns, ns < 10 ? 2 : 1)} ns`;
  if (ns < 1e6) return `${ar(ns / 1000, ns < 1e4 ? 2 : 1)} µs`;
  return `${ar(ns / 1e6, ns < 1e7 ? 2 : 1)} ms`;
}
function memoria(b) {
  if (b == null) return "–";
  if (b === 0) return "0 B";
  if (b < 1024) return `${ar(b, 0)} B`;
  if (b < 1024 * 1024) return `${ar(b / 1024, b < 10240 ? 2 : 1)} KB`;
  return `${ar(b / 1024 / 1024, 2)} MB`;
}
function relativo(r) {
  if (r == null) return "–";
  if (r < 0.01) return `${ar(1 / r, 0)}× más rápido`;
  if (r < 0.95) return `${ar(1 / r, r > 0.5 ? 2 : 1)}× más rápido`;
  if (r <= 1.05) return "igual";
  return `${ar(r, r < 10 ? 1 : 0)}× más lento`;
}
function clase(r) { return r == null || (r > 0.95 && r <= 1.05) ? "" : r < 0.95 ? "bien" : r >= 3 ? "mal" : "ojo"; }
function tabla(nombre, lista) {
  const max = Math.max(...lista.map((b) => b.mediaNs));
  const filas = lista.map((b, i) => {
    const barra = Math.max(2, Math.round(100 * b.mediaNs / max));
    return `<tr><td><code>${b.metodo}</code>${i === 0 ? ' <span class="base">base</span>' : ""}</td>` +
      `<td class="n"><span class="barra" style="width:${barra}%"></span>${tiempo(b.mediaNs)}</td>` +
      `<td class="n ${clase(b.ratio)}">${i === 0 ? "1,00×" : relativo(b.ratio)}</td>` +
      `<td class="n">${memoria(b.bytes)}</td></tr>`;
  }).join("\n");
  return `<div class="tabla"><table data-clase="${nombre}">\n<tr><th>Variante</th><th class="n">Media por operación</th><th class="n">Contra la base</th><th class="n">Memoria por operación</th></tr>\n${filas}\n</table></div>`;
}
let n = 0;
html = html.replace(/<!-- tabla:(\w+) -->[\s\S]*?<!-- \/tabla -->/g, (m, nombre) => {
  const lista = R.capitulos[nombre];
  if (!lista) throw new Error(`No hay resultados para ${nombre}`);
  n++;
  return `<!-- tabla:${nombre} -->\n${tabla(nombre, lista)}\n<!-- /tabla -->`;
});
fs.writeFileSync(rutaHtml, html);
console.log(`${n} tablas generadas`);
module.exports = { tiempo, memoria, relativo };
