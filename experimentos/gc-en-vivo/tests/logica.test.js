/* Tests del modelo del GC.   node --test experimentos/gc-en-vivo/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const G = require("../logica.js");
const sim = (o) => G.simular(Object.assign({ duracionS: 15 }, o));

test("sin asignar nada no hay ningún GC ni pausa, y los pedidos tardan lo que tardan", () => {
  const r = sim({ ritmoMBs: 0 });
  assert.deepEqual(r.colecciones, { gen0: 0, gen1: 0, gen2: 0, gen2Fondo: 0 });
  assert.equal(r.pausaTotalMs, 0); assert.equal(r.latencia.p99, 5); assert.equal(r.latencia.afectados, 0);
});

test("vida corta: los gen0 escalan con el ritmo (un gen0 por presupuesto) y cuestan medio milisegundo", () => {
  const a = sim({ ritmoMBs: 200, objKB: 1 }), b = sim({ ritmoMBs: 400, objKB: 1 });
  assert.equal(a.colecciones.gen0, Math.floor(200 * 15 / 86));
  assert.ok(Math.abs(b.colecciones.gen0 - 2 * a.colecciones.gen0) <= 1);
  assert.equal(a.colecciones.gen1 + a.colecciones.gen2, 0);
  assert.ok(a.pausas.gen0.p50Ms >= 0.4 && a.pausas.gen0.p50Ms <= 0.6, "gen0 de ~0,45 ms");
  assert.ok(a.pausaPct < 0.3);
});

test("vida media de 500 ms: gen1 casi siempre, gen2 de fondo con primera pausa larga, pausas de ~17 ms y la crisis de la mediana edad en el diagnóstico", () => {
  const r = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500 });
  assert.ok(r.colecciones.gen1 > r.colecciones.gen0, "más gen1 que gen0");
  assert.ok(r.colecciones.gen2Fondo >= 5 && r.colecciones.gen2Fondo <= 20, "gen2 de fondo: " + r.colecciones.gen2Fondo);
  assert.ok(r.pausas.gen1.p50Ms > 14 && r.pausas.gen1.p50Ms < 24, "gen1 p50 " + r.pausas.gen1.p50Ms);
  assert.ok(r.pausas.gen2Fondo.maxMs > 35 && r.pausas.gen2Fondo.maxMs < 70, "primera pausa del fondo " + r.pausas.gen2Fondo.maxMs);
  assert.ok(r.pausaPct > 4 && r.pausaPct < 9, "pausa % " + r.pausaPct);
  assert.ok(G.diagnosticar(r).some((d) => /mediana edad/.test(d.titulo)));
});

test("un caché grande que nadie toca no cambia las pausas de gen0 ni dispara gen2; con vida media, los gen1 pagan por el tamaño de gen2", () => {
  const sin = sim({ ritmoMBs: 200, objKB: 1 }), con = sim({ ritmoMBs: 200, objKB: 1, cacheMB: 2048 });
  assert.equal(con.colecciones.gen2, 0);
  assert.ok(Math.abs(con.pausas.gen0.p50Ms - sin.pausas.gen0.p50Ms) < 0.05);
  assert.ok(con.heapMaxMB > 2048);
  const media = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500 });
  const cacheMedia = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, cacheMB: 1024 });
  assert.ok(cacheMedia.pausas.gen1.p50Ms > media.pausas.gen1.p50Ms * 1.8, "gen1 con 1 GB en gen2: " + cacheMedia.pausas.gen1.p50Ms + " vs " + media.pausas.gen1.p50Ms);
  assert.ok(cacheMedia.pausaPct > 7 && cacheMedia.pausaPct < 13, "pausa % " + cacheMedia.pausaPct);
});

test("una fuga sin GC concurrente: gen2 bloqueantes largos y proporcionales al heap; con concurrente, pausas cortas y trabajo de fondo", () => {
  const fondo = sim({ ritmoMBs: 0, objKB: 1, cacheMB: 1024, crecerMBs: 25, duracionS: 40 });
  const bloq = sim({ ritmoMBs: 0, objKB: 1, cacheMB: 1024, crecerMBs: 25, duracionS: 40, concurrente: false });
  assert.ok(fondo.colecciones.gen2 > 0 && bloq.colecciones.gen2 > 0);
  assert.equal(fondo.colecciones.gen2Fondo, fondo.colecciones.gen2); assert.equal(bloq.colecciones.gen2Fondo, 0);
  assert.ok(bloq.pausas.gen2Bloqueante.maxMs > 100, "gen2 bloqueante con más de 1 GB: " + bloq.pausas.gen2Bloqueante.maxMs);
  assert.ok(bloq.pausas.gen2Bloqueante.maxMs > fondo.pausas.gen2Fondo.maxMs * 1.5);
  assert.ok(fondo.trabajoFondoMs > 0 && bloq.trabajoFondoMs === 0);
  assert.ok(G.diagnosticar(bloq).some((d) => /bloqueantes/.test(d.titulo)));
});

test("LOH: buffers de 100 KB disparan un gen2 por cada 3 MB; con ArrayPool, ninguno; de 80 KB van a gen0", () => {
  const loh = sim({ ritmoMBs: 200, objKB: 100 }), pool = sim({ ritmoMBs: 200, objKB: 100, pool: true }), chico = sim({ ritmoMBs: 200, objKB: 80 });
  assert.ok(loh.colecciones.gen2 > 900 && loh.colecciones.gen2 < 1100, "gen2 por LOH: " + loh.colecciones.gen2);
  assert.equal(loh.colecciones.gen0, 0);
  assert.deepEqual(pool.colecciones, { gen0: 0, gen1: 0, gen2: 0, gen2Fondo: 0 });
  assert.ok(chico.colecciones.gen0 > 30 && chico.colecciones.gen2 === 0);
  assert.ok(G.diagnosticar(loh).some((d) => /LOH/.test(d.titulo)));
});

test("una fuga: el heap no vuelve, los gen2 de fondo son cada vez más largos y el diagnóstico la nombra", () => {
  const r = sim({ ritmoMBs: 0, crecerMBs: 25, duracionS: 40 });
  assert.ok(r.vivoFinalMB > 800, "vivo al final " + r.vivoFinalMB);
  const g2 = r.eventos.filter((e) => e.gen === 2 && e.tipo === 1 && e.ms > 10); // las primeras pausas de cada gen2 de fondo
  assert.ok(g2.length >= 2, "gen2: " + g2.length);
  assert.ok(g2[g2.length - 1].ms > g2[0].ms, "crece");
  const heap = r.muestras.map((m) => m.gen0 + m.gen1 + m.gen2 + m.loh);
  assert.ok(heap[heap.length - 1] > heap[Math.floor(heap.length / 2)] * 1.5, "el heap sube");
  assert.ok(G.diagnosticar(r).some((d) => /no para de crecer/.test(d.titulo)));
});

test("server GC: presupuesto por núcleo, muchos menos GC y casi sin pausa con vida media; DATAS arranca chico y adapta", () => {
  const ws = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500 });
  const sv = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, modo: "server", nucleos: 4 });
  assert.equal(sv.presupuestos.heaps, 4); assert.equal(sv.presupuestos.gen0MB, 1000);
  assert.ok(sv.colecciones.gen0 + sv.colecciones.gen1 <= 4);
  assert.ok(sv.pausaPct < ws.pausaPct / 5);
  assert.ok(sv.heapMaxMB > ws.heapMaxMB * 3);
  const da = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, modo: "datas", nucleos: 4 });
  assert.equal(da.presupuestos.heaps, 1);
  assert.ok(da.colecciones.gen0 > 100 && da.colecciones.gen0 < 200, "muchos gen0 chicos: " + da.colecciones.gen0);
  assert.ok(da.pausas.gen0.p50Ms < 3.5 && da.heapMaxMB < 200);
  assert.ok(G.diagnosticar(da).some((d) => /DATAS/.test(d.titulo)));
});

test("finalizadores: todo sobrevive una vez de más y las pausas se van a ~50 ms", () => {
  const r = sim({ ritmoMBs: 200, objKB: 1, finalizadores: true });
  assert.ok(r.colecciones.gen1 >= r.colecciones.gen0 - 2);
  assert.ok(r.pausas.gen1.p50Ms > 40 && r.pausas.gen1.p50Ms < 65, "gen1 " + r.pausas.gen1.p50Ms);
  assert.ok(r.pausaPct > 8);
  assert.ok(G.diagnosticar(r).some((d) => /Finalizadores/.test(d.titulo)));
});

test("los pedidos que caen en una pausa la pagan entera: el p99 sube con las pausas", () => {
  const r = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, pedidosPorS: 500, servicioMs: 5 });
  assert.ok(r.latencia.p50 <= 5.5);
  assert.ok(r.latencia.p99 > 20, "p99 " + r.latencia.p99);
  assert.ok(r.latencia.max >= r.pausaMaxMs + 5 - 0.01);
  assert.ok(r.latencia.afectados > 0 && r.latencia.afectados < r.latencia.n);
});

test("el presupuesto de gen0 manda: con 4 MB hay 20 veces más gen0 que con 86, y con vida media la pausa se dispara", () => {
  const chico = sim({ ritmoMBs: 200, objKB: 1, presupuestoGen0MB: 4 }), normal = sim({ ritmoMBs: 200, objKB: 1 });
  assert.ok(chico.colecciones.gen0 > normal.colecciones.gen0 * 18);
  const media = sim({ ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, presupuestoGen0MB: 4 });
  assert.ok(media.pausaPct > 8, "pausa: " + media.pausaPct);
});

test("percentil", () => { assert.equal(G.percentil([5, 1, 3], 0.5), 3); assert.equal(G.percentil([], 0.5), 0); assert.equal(G.percentil([1, 2, 3, 4], 0.99), 4); });
