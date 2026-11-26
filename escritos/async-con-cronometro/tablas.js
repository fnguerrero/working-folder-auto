/* Junta las corridas crudas de resultados-crudos/ en resultados.json y mete en index.html las tablas, los bloques
   de código (sacados de benchmarks/*.cs) y los datos del gráfico. Nada de eso se tipea a mano.
     node escritos/async-con-cronometro/tablas.js */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const aqui = (...p) => path.join(__dirname, ...p);

const RUNTIMES = ["net8", "net10"];
const MODOS = ["async", "result", "result200", "sleep"];
const RITMOS = [100, 200, 400, 800];

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

function juntar() {
  const archivos = fs.readdirSync(aqui("resultados-crudos")).sort();
  const R = { arnes: "propio (Stopwatch); no es BenchmarkDotNet", entornos: {}, mediciones: {}, hechos: {}, excepciones: {}, hambre: {} };
  for (const rt of RUNTIMES) {
    const corridas = archivos.filter((f) => f.startsWith(`micro-${rt}-`)).map(leer);
    R.entornos[rt] = { ...corridas[0].entorno, corridas: corridas.length };
    R.hechos[rt] = corridas[0].hechos;
    R.excepciones[rt] = corridas[0].excepciones;
    for (const m of corridas[0].mediciones) {
      const todas = corridas.map((c) => c.mediciones.find((x) => x.capitulo === m.capitulo && x.id === m.id));
      const cap = (R.mediciones[m.capitulo] ||= []);
      let fila = cap.find((f) => f.id === m.id);
      if (!fila) cap.push((fila = { id: m.id, nombre: m.nombre, contador: m.contador, runtimes: {} }));
      fila.runtimes[rt] = {
        medianaNs: mediana(todas.map((x) => x.medianaNs)),
        minNs: Math.min(...todas.map((x) => x.minNs)),
        maxNs: Math.max(...todas.map((x) => x.maxNs)),
        bytes: mediana(todas.map((x) => x.bytesPorOp)),
        medianasPorCorrida: todas.map((x) => x.medianaNs),
      };
    }
    R.hambre[rt] = {};
    for (const modo of MODOS) R.hambre[rt][modo] = RITMOS.map((r) => leer(`hambre-${rt}-${modo}-${r}.json`).escenario);
  }
  return R;
}

function tabla(cap, filas) {
  const cabeza = RUNTIMES.map((rt) => `<th class="n">.NET ${rt.slice(3)}</th><th class="n">Asigna</th>`).join("");
  const cuerpo = filas.map((f) => `<tr><td>${escapar(f.nombre)}</td>` + RUNTIMES.map((rt) => {
    const m = f.runtimes[rt];
    return `<td class="n">${tiempo(m.medianaNs)}<small>${tiempo(m.minNs)} a ${tiempo(m.maxNs)}</small></td><td class="n">${bytes(m.bytes)}</td>`;
  }).join("") + "</tr>").join("\n");
  return `<div class="tabla"><table data-capitulo="${cap}"><thead><tr><th>Variante</th>${cabeza}</tr></thead><tbody>\n${cuerpo}\n</tbody></table></div>`;
}

function tablaStreaming(R) {
  const filas = ["lista", "stream"].map((modo) => `<tr><td>${modo === "lista" ? "List&lt;Fila&gt;" : "IAsyncEnumerable&lt;Fila&gt;"}</td>` + RUNTIMES.map((rt) => {
    const h = R.hechos[rt].streaming.find((x) => x.modo === modo);
    return `<td class="n">${tiempo(h.primerElementoMs * 1e6)}</td><td class="n">${tiempo(h.totalMs * 1e6)}</td><td class="n">${bytes(h.bytesVivos)}</td>`;
  }).join("") + "</tr>").join("\n");
  const cab = RUNTIMES.map((rt) => ["primer elemento", "total", "memoria viva"].map((t) => `<th class="n">.NET ${rt.slice(3)} · ${t}</th>`).join("")).join("");
  return `<div class="tabla"><table data-capitulo="primero"><thead><tr><th>100.000 filas</th>${cab}</tr></thead><tbody>\n${filas}\n</tbody></table></div>`;
}

const NOMBRES = { async: "await", result: ".Result", result200: ".Result + 200 hilos mínimos", sleep: "Thread.Sleep" };
function tablaHambre(R, rt) {
  const filas = MODOS.flatMap((m) => R.hambre[rt][m].map((e) => {
    const sin = e.enviados - e.terminadosAlFinal;
    return `<tr><td>${NOMBRES[m]}</td><td class="n">${ar(e.ritmo, 0)}</td><td class="n">${ar(e.porSegundo, 0)}</td><td class="n">${tiempo(e.latenciaP50Ms * 1e6)}</td><td class="n">${tiempo(e.latenciaP99Ms * 1e6)}</td><td class="n">${tiempo(e.sondaMaxMs * 1e6)}</td><td class="n">${e.hilosAlCorte}</td><td class="n">${ar(sin, 0)}</td></tr>`;
  })).join("\n");
  const cab = ["Pedidos/s que llegan", "Salen por segundo", "Latencia p50", "Latencia p99", "Peor «health check»", "Hilos a los 10 s", "Sin contestar"].map((t) => `<th class="n">${t}</th>`).join("");
  return `<div class="tabla"><table data-capitulo="hambre-${rt}"><thead><tr><th>.NET ${rt.slice(3)} · variante</th>${cab}</tr></thead><tbody>\n${filas}\n</tbody></table></div>`;
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
  html = reemplazar(html, "tabla", "primero", tablaStreaming(R));
  for (const rt of RUNTIMES) html = reemplazar(html, "tabla", `hambre-${rt}`, tablaHambre(R, rt));
  const C = codigos();
  for (const [, nombre] of [...html.matchAll(/<!-- codigo:(\w+) -->/g)])
    html = reemplazar(html, "codigo", nombre, `<pre><code>${escapar(C[nombre])}</code></pre>`);
  const grafico = {};
  for (const rt of RUNTIMES) {
    grafico[rt] = {};
    for (const m of MODOS) grafico[rt][m] = Object.fromEntries(R.hambre[rt][m].map((e) => [e.ritmo, e.serie.map((p) => [p.s, p.hilos, p.porSegundo, p.enCola])]));
  }
  return reemplazar(html, "datos", "grafico", `<script type="application/json" id="datos-grafico">${JSON.stringify(grafico)}</script>`);
}

module.exports = { juntar, tiempo, bytes, armar, codigos };

if (require.main === module) {
  const R = juntar();
  fs.writeFileSync(aqui("resultados.json"), JSON.stringify(R) + "\n");
  const f = aqui("index.html");
  if (fs.existsSync(f)) fs.writeFileSync(f, armar(fs.readFileSync(f, "utf8"), R));
  console.log("resultados.json" + (fs.existsSync(f) ? " e index.html actualizados" : " generado (falta index.html)"));
}
