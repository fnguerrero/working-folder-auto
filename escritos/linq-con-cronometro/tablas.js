/* Junta las corridas crudas de resultados-crudos/ en resultados.json y mete en index.html las tablas y los bloques
   de código (sacados de benchmarks/*.cs). Nada de eso se tipea a mano.
     node escritos/linq-con-cronometro/tablas.js */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const aqui = (...p) => path.join(__dirname, ...p);

const RUNTIMES = ["net8", "net9", "net10"];
const INESTABLE = 1.25;   // si las medianas de las dos corridas difieren más que esto, la celda se marca

const ar = (n, d) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d });
const cifras = (n) => ar(n, n < 10 ? 1 : 0);
function tiempo(ns) {
  if (ns < 1000) return `${cifras(ns)} ns`;
  if (ns < 1e6) return `${cifras(ns / 1e3)} µs`;
  if (ns < 1e9) return `${cifras(ns / 1e6)} ms`;
  return `${cifras(ns / 1e9)} s`;
}
function bytes(b) {
  if (b < 0.5) return "0 B";
  if (b < 1024) return `${ar(b, 0)} B`;
  if (b < 1048576) return `${cifras(b / 1024)} KB`;
  return `${cifras(b / 1048576)} MB`;
}
const mediana = (a) => { const o = [...a].sort((x, y) => x - y); const m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const leer = (f) => JSON.parse(fs.readFileSync(aqui("resultados-crudos", f), "utf8"));

// El grupo de cada caso (qué filas son comparables) está en el registro de Casos.cs.
function grupos() {
  const t = fs.readFileSync(aqui("benchmarks", "Casos.cs"), "utf8");
  const capitulos = Object.fromEntries([...t.matchAll(/const string (c\d) = "(\w+)";/g)].map((x) => [x[1], x[2]]));
  return Object.fromEntries([...t.matchAll(/\b[CB]\((c\d), "(\w+)", "(\w+)"/g)].map(([, c, g, id]) => [`${capitulos[c]}/${id}`, g]));
}

function juntar() {
  const G = grupos();
  const archivos = fs.readdirSync(aqui("resultados-crudos")).sort();
  const R = { arnes: "propio (Stopwatch); no es BenchmarkDotNet", entornos: {}, mediciones: {}, hechos: {} };
  for (const rt of RUNTIMES) {
    const corridas = archivos.filter((f) => f.startsWith(`linq-${rt}-`)).map(leer);
    R.entornos[rt] = { ...corridas[0].entorno, corridas: corridas.length };
    R.hechos[rt] = corridas[0].hechos;
    for (const m of corridas[0].mediciones) {
      const todas = corridas.map((c) => c.mediciones.find((x) => x.capitulo === m.capitulo && x.id === m.id));
      const cap = (R.mediciones[m.capitulo] ||= []);
      let fila = cap.find((f) => f.id === m.id);
      if (!fila) cap.push((fila = { id: m.id, grupo: G[`${m.capitulo}/${m.id}`] || m.id, nombre: m.nombre, runtimes: {} }));
      const medianas = todas.map((x) => x.medianaNs);
      fila.runtimes[rt] = {
        medianaNs: mediana(medianas),
        minNs: Math.min(...todas.map((x) => x.minNs)),
        maxNs: Math.max(...todas.map((x) => x.maxNs)),
        bytes: mediana(todas.map((x) => x.bytesPorOp)),
        medianasPorCorrida: medianas,
        inestable: Math.max(...medianas) / Math.min(...medianas) > INESTABLE,
      };
    }
  }
  // Las filas de un mismo grupo van juntas, en el orden en que aparece cada grupo.
  for (const filas of Object.values(R.mediciones)) {
    const orden = [...new Set(filas.map((f) => f.grupo))];
    filas.sort((a, b) => orden.indexOf(a.grupo) - orden.indexOf(b.grupo));
  }
  return R;
}

function tabla(cap, filas) {
  const cabeza = RUNTIMES.map((rt) => `<th class="n">.NET ${rt.slice(3)}</th>`).join("");
  let grupo = null;
  const cuerpo = filas.map((f) => {
    const corte = grupo !== null && f.grupo !== grupo && cap !== "iteradores" ? ' class="corte"' : "";
    grupo = f.grupo;
    return `<tr${corte}><td>${escapar(f.nombre)}</td>` + RUNTIMES.map((rt) => {
      const m = f.runtimes[rt];
      if (!m) return '<td class="n">no existe</td>';
      return `<td class="n">${m.inestable ? '<abbr title="las dos corridas difieren más de un 25 %">≈</abbr> ' : ""}${tiempo(m.medianaNs)}<small>${tiempo(m.minNs)} a ${tiempo(m.maxNs)}</small><small class="b">${bytes(m.bytes)}</small></td>`;
    }).join("") + "</tr>";
  }).join("\n");
  return `<div class="tabla"><table data-capitulo="${cap}"><thead><tr><th>Variante</th>${cabeza}</tr></thead><tbody>
${cuerpo}
</tbody></table></div>`;
}

function codigos() {
  const C = {};
  for (const f of fs.readdirSync(aqui("benchmarks")).filter((x) => x.endsWith(".cs"))) {
    const t = fs.readFileSync(aqui("benchmarks", f), "utf8").replace(/\r/g, "");
    for (const [, nombre, cuerpo] of t.matchAll(/\/\/ <codigo:(\w+)>\n([\s\S]*?)\n[ \t]*\/\/ <\/codigo:\1>/g)) {
      const lineas = cuerpo.split("\n");
      const sangria = Math.min(...lineas.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
      C[nombre] = lineas.map((l) => l.slice(sangria)).join("\n");
    }
  }
  return C;
}

function reemplazar(html, tipo, nombre, contenido) {
  const re = new RegExp(`(<!-- ${tipo}:${nombre} -->)[\\s\\S]*?(<!-- /${tipo} -->)`);
  if (!re.test(html)) throw new Error(`falta el marcador ${tipo}:${nombre}`);
  return html.replace(re, (_, a, b) => `${a}\n${contenido}\n${b}`);
}

function armar(html, R) {
  for (const [cap, filas] of Object.entries(R.mediciones)) html = reemplazar(html, "tabla", cap, tabla(cap, filas));
  const C = codigos();
  for (const [, nombre] of [...html.matchAll(/<!-- codigo:(\w+) -->/g)])
    html = reemplazar(html, "codigo", nombre, `<pre><code>${escapar(C[nombre])}</code></pre>`);
  return html;
}

module.exports = { juntar, tiempo, bytes, armar, codigos };

if (require.main === module) {
  const R = juntar();
  fs.writeFileSync(aqui("resultados.json"), JSON.stringify(R) + "\n");
  const f = aqui("index.html");
  if (fs.existsSync(f)) fs.writeFileSync(f, armar(fs.readFileSync(f, "utf8"), R));
  console.log("resultados.json" + (fs.existsSync(f) ? " e index.html actualizados" : " generado (falta index.html)"));
}
