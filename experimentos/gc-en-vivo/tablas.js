/* Compacta las corridas de real/salida/*.json en resultados-real.json y genera la tabla «real» de index.html
   (entre <!-- tabla:real --> y <!-- /tabla -->).   node experimentos/gc-en-vivo/tablas.js */
"use strict";
const fs = require("node:fs"); const path = require("node:path");
const AQUI = __dirname;
const ORDEN = [
  ["nada", "Sin asignar nada (piso de ruido del centinela)"],
  ["corta-100", "Vida corta, 100 MB/s"], ["corta-200", "Vida corta, 200 MB/s"], ["corta-400", "Vida corta, 400 MB/s"], ["corta-800", "Vida corta, 800 MB/s"],
  ["media-100", "Vida media 100 ms, 200 MB/s"], ["media-500", "Vida media 500 ms, 200 MB/s"], ["media-2000", "Vida media 2 s, 200 MB/s"], ["media-5000", "Vida media 5 s, 200 MB/s"],
  ["cache-256", "Caché de 256 MB + 200 MB/s de vida corta"], ["cache-1024", "Caché de 1 GB + 200 MB/s"], ["cache-2048", "Caché de 2 GB + 200 MB/s"],
  ["noconc-cache-1024", "Caché de 1 GB, GC concurrente apagado"], ["sustained-1024", "Caché de 1 GB, SustainedLowLatency"],
  ["cache-media-1024", "Caché de 1 GB + vida media 500 ms"], ["cache-media-2048", "Caché de 2 GB + vida media 500 ms"],
  ["sustained-media-1024", "Caché de 1 GB + vida media, SustainedLowLatency"], ["noconc-cache-media-1024", "Caché de 1 GB + vida media, GC concurrente apagado"],
  ["noconc-media-500", "Vida media 500 ms, GC concurrente apagado"], ["server-cache-media-1024", "Server GC: caché de 1 GB + vida media"],
  ["loh", "Buffers de 100 KB, 200 MB/s (LOH)"], ["loh-chico", "Buffers de 80 KB, 200 MB/s (no LOH)"], ["loh-pool", "Buffers de 100 KB con ArrayPool"],
  ["finalizador", "Objetos de 1 KB con finalizador, 200 MB/s"],
  ["crecer", "Fuga de 25 MB/s durante 20 s"], ["noconc-crecer", "Fuga de 25 MB/s, GC concurrente apagado"],
  ["server-corta-200", "Server GC: vida corta, 200 MB/s"], ["server-media-500", "Server GC: vida media 500 ms"], ["server-cache-1024", "Server GC: caché de 1 GB"], ["server-crecer", "Server GC: fuga de 25 MB/s"],
  ["datas-corta-200", "Server + DATAS: vida corta"], ["datas-media-500", "Server + DATAS: vida media 500 ms"],
  ["gen0-4mb-corta", "gen0 de 4 MB: vida corta"], ["gen0-4mb-media", "gen0 de 4 MB: vida media 500 ms"],
  ["gen0-256mb-corta", "gen0 de 256 MB: vida corta"], ["gen0-256mb-media", "gen0 de 256 MB: vida media 500 ms"],
];
function compactar() {
  const dir = process.argv[2] || path.join(AQUI, "real", "salida"); const out = [];
  for (const [clave, nombre] of ORDEN) {
    const f = path.join(dir, clave + ".json"); if (!fs.existsSync(f)) continue;
    let d; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    const p = d.pausas;
    out.push({ clave, nombre, escenario: d.escenario, args: d.args, config: { server: d.config.server, concurrente: d.config.concurrente, datas: d.config.datas, gen0size: d.config.gen0size, latencia: d.config.latencia, cores: d.config.cores, version: d.config.version },
      segundos: d.segundos, asignadoMBs: d.asignadoMBs, colecciones: d.colecciones, pausaTotalMs: d.pausaTotalMs, pausaPct: d.pausaPct, cpuMs: d.cpuMs,
      pausas: { gen0: p.gen0, gen1: p.gen1, gen2Bloqueante: p.gen2Bloqueante, gen2Fondo: p.gen2Fondo, todas: p.todas, gen2FondoCount: p.gen2FondoCount },
      congelamientos: d.congelamientos, heap: d.heap, cacheObjetos: d.cacheObjetos });
  }
  return out;
}
const fmt = (x, d) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d }).format(x);
const ms = (x) => x >= 100 ? fmt(x, 0) : x >= 10 ? fmt(x, 1) : fmt(x, 2);
function tabla(datos) {
  const filas = datos.map((d) => {
    const p = d.pausas; const c = d.colecciones;
    const celda = (q) => q.n ? ms(q.p50Ms) + " / " + ms(q.maxMs) : "–";
    const g2 = p.gen2Bloqueante.n || p.gen2Fondo.n ? (p.gen2Bloqueante.n ? ms(p.gen2Bloqueante.p50Ms) + " / " + ms(p.gen2Bloqueante.maxMs) + (p.gen2Fondo.n ? " bloq.; " : "") : "") + (p.gen2Fondo.n ? ms(p.gen2Fondo.p50Ms) + " / " + ms(p.gen2Fondo.maxMs) + " fondo" : "") : "–";
    return `<tr><td>${d.nombre}</td><td class="num">${fmt(d.asignadoMBs)}</td><td class="num">${c.gen0} / ${c.gen1} / ${c.gen2}${p.gen2FondoCount ? " (" + p.gen2FondoCount + " f.)" : ""}</td><td class="num">${fmt(d.pausaPct, 2)} %</td><td class="num">${celda(p.gen0)}</td><td class="num">${celda(p.gen1)}</td><td class="num">${g2}</td><td class="num">${ms(d.congelamientos.p99Ms)}</td><td class="num">${fmt(d.heap.committedMaxMB)}</td></tr>`;
  }).join("\n");
  return `<div class="tabla-scroll"><table aria-label="Mediciones en .NET 8 real"><thead><tr><th>Escenario</th><th class="num">MB/s</th><th class="num">gen0 / gen1 / gen2</th><th class="num">% en pausa</th><th class="num">gen0 p50 / máx (ms)</th><th class="num">gen1 p50 / máx (ms)</th><th class="num">gen2 p50 / máx (ms)</th><th class="num">Congelamiento p99 (ms)</th><th class="num">Memoria máx (MB)</th></tr></thead><tbody>\n${filas}\n</tbody></table></div>`;
}
function inyectar(html, nombre, contenido) {
  const a = `<!-- tabla:${nombre} -->`, b = `<!-- /tabla -->`;
  const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("no está la marca " + nombre);
  return html.slice(0, i + a.length) + "\n" + contenido + "\n" + html.slice(j);
}
if (require.main === module) {
  const datos = compactar();
  fs.writeFileSync(path.join(AQUI, "resultados-real.json"), JSON.stringify(datos, null, 1) + "\n");
  const f = path.join(AQUI, "index.html");
  fs.writeFileSync(f, inyectar(fs.readFileSync(f, "utf8"), "real", tabla(datos)));
  console.log(datos.length + " corridas en la tabla");
}
module.exports = { compactar, tabla, inyectar, ORDEN };
