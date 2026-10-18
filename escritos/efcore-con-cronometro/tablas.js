/* Genera las tablas y los bloques de SQL del escrito a partir de resultados.json y los inserta en index.html
   entre los marcadores <!-- tabla:capitulo --> … <!-- /tabla --> y <!-- sql:capitulo:n --> … <!-- /sql -->.
   Se corre una vez después de medir:
     node escritos/efcore-con-cronometro/tablas.js
   Así los números y el SQL del HTML salen del JSON y no de tipearlos (tests/datos.test.js lo verifica). */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const ar = (n, d) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
function tiempo(ms) {
  if (ms < 1) return `${ar(ms * 1000, 0)} µs`;
  if (ms < 10) return `${ar(ms, 2)} ms`;
  if (ms < 1000) return `${ar(ms, 1)} ms`;
  return `${ar(ms / 1000, 2)} s`;
}
function bytes(b) {
  if (b == null) return "–";
  if (b < 1024) return `${ar(b, 0)} B`;
  if (b < 1024 * 1024) return `${ar(b / 1024, b < 10240 ? 1 : 0)} KB`;
  return `${ar(b / 1024 / 1024, b < 10 * 1024 * 1024 ? 2 : 1)} MB`;
}
const entero = (n) => ar(n, 0);
function relativo(r) {
  if (r < 0.95) return `${ar(1 / r, 1 / r < 10 ? 1 : 0)}× más rápido`;
  if (r <= 1.05) return "igual";
  return `${ar(r, r < 10 ? 1 : 0)}× más lento`;
}
function clase(r) { return r > 0.95 && r <= 1.05 ? "" : r < 0.95 ? "bien" : r >= 3 ? "mal" : "medio"; }
const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function tabla(nombre, lista) {
  const base = lista[0].medianaMs;
  const max = Math.max(...lista.map((b) => b.medianaMs));
  const filas = lista.map((b, i) => {
    const barra = Math.max(2, Math.round(60 * b.medianaMs / max));
    const r = b.medianaMs / base;
    return `<tr><td><code>${escapar(b.variante)}</code>${i === 0 ? ' <span class="base">base</span>' : ""}</td>` +
      `<td class="n"><span class="barra" style="width:${barra}px"></span>${tiempo(b.medianaMs)}</td>` +
      `<td class="n ${i === 0 ? "" : clase(r)}">${i === 0 ? "1,0×" : relativo(r)}</td>` +
      `<td class="n">${entero(b.viajesAlServidor)}</td><td class="n">${entero(b.lecturasLogicas)}</td><td class="n">${entero(b.filasRecibidas)}</td>` +
      `<td class="n">${bytes(b.bytesRecibidos)}</td><td class="n">${bytes(b.bytesAsignados)}</td></tr>`;
  }).join("\n");
  return `<div class="tabla"><table data-capitulo="${nombre}">\n<tr><th>Variante</th><th class="n">Tiempo</th><th class="n">Contra la base</th><th class="n">Viajes</th><th class="n">Lecturas</th><th class="n">Filas</th><th class="n">Recibido</th><th class="n">Memoria .NET</th></tr>\n${filas}\n</table></div>`;
}
function limpiarSql(s) {
  return s.replace(/\r\n/g, "\n").trim();
}

if (require.main === module) {
  const R = JSON.parse(fs.readFileSync(path.join(__dirname, "resultados.json"), "utf8"));
  const rutaHtml = path.join(__dirname, "index.html");
  let html = fs.readFileSync(rutaHtml, "utf8");
  let n = 0, s = 0;
  html = html.replace(/<!-- tabla:(\w+) -->[\s\S]*?<!-- \/tabla -->/g, (m, nombre) => {
    const lista = R.capitulos[nombre];
    if (!lista) throw new Error(`No hay resultados para ${nombre}`);
    n++;
    return `<!-- tabla:${nombre} -->\n${tabla(nombre, lista)}\n<!-- /tabla -->`;
  });
  html = html.replace(/<!-- sql:(\w+):(\d+)(?::(\d+))? -->[\s\S]*?<!-- \/sql -->/g, (m, nombre, idx, cual) => {
    const r = (R.capitulos[nombre] || [])[Number(idx)];
    if (!r) throw new Error(`No hay variante ${idx} en ${nombre}`);
    const sql = r.sql[Number(cual || 0)];
    if (!sql) throw new Error(`La variante ${idx} de ${nombre} no tiene SQL ${cual || 0}`);
    s++;
    return `<!-- sql:${nombre}:${idx}${cual ? ":" + cual : ""} -->\n<pre class="sql"><code>${escapar(limpiarSql(sql))}</code></pre>\n<!-- /sql -->`;
  });
  fs.writeFileSync(rutaHtml, html);
  console.log(`${n} tablas y ${s} bloques de SQL generados`);
}
module.exports = { tiempo, bytes, entero, relativo, limpiarSql };
