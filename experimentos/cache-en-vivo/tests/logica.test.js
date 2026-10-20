/* Tests de El caché en vivo.   node --test experimentos/cache-en-vivo/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const K = require("../logica.js");
const traza = (xs) => Int32Array.from(xs);
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""}: ${a} vs ${b} (tol ${tol})`);

test("Zipf: suma 1, decreciente, alfa 0 es uniforme; la traza respeta las probabilidades", () => {
  const p = K.zipf(1000, 0.9); cerca(p.reduce((s, x) => s + x, 0), 1, 1e-9); assert.ok(p[0] > p[1] && p[1] > p[999]);
  const u = K.zipf(10, 0); cerca(u[0], 0.1, 1e-12); cerca(u[9], 0.1, 1e-12);
  const { traza: t } = K.generarTraza({ N: 1000, alfa: 0.9, M: 100000, semilla: 5 }); let c0 = 0; for (const k of t) if (k === 0) c0++;
  cerca(c0 / t.length, p[0], 0.01, "frecuencia de la clave 0");
  const { traza: n, claves } = K.generarTraza({ N: 100, alfa: 0.9, M: 10000, novedades: 0.3, semilla: 2 }); let nuevas = 0; for (const k of n) if (k >= 100) nuevas++; cerca(nuevas / n.length, 0.3, 0.02, "novedades"); assert.equal(claves, 100 + nuevas);
  const { traza: r } = K.generarTraza({ N: 1000, alfa: 1, M: 10000, rotacion: 1000, semilla: 2 }); assert.ok(r.every((k) => k >= 0 && k < 1000), "la rotación queda dentro del catálogo");
});

test("LRU, FIFO, LFU, aleatorio y Belady sobre trazas chicas donde se sabe la respuesta", () => {
  // LRU con C=2: a b a c b → hits: a(sí) ; c evicta b ; b miss → 1 hit. FIFO: a b a c (evicta a) b (evicta b?) → ver cuentas.
  const t = traza([0, 1, 0, 2, 1, 0]);
  assert.equal(K.simular(t, { C: 2, politica: "lru" }).hits, 1); // 0 1 [0 hit] 2 (saca 1) [1 miss, saca 0] [0 miss]
  assert.equal(K.simular(t, { C: 2, politica: "fifo" }).hits, 2); // 0 1 [0 hit] 2 (saca 0) [1 hit] [0 miss]
  assert.equal(K.simular(t, { C: 2, politica: "belady" }).hits, 2); // óptimo: 0 1 [0] 2 saca 1 (próximo uso 4) o 0 (próximo 5): saca 0 → [1 hit] [0 miss] = 2
  const l = traza([0, 0, 0, 1, 2, 0, 1, 3, 0]); // LFU con C=2: 0 muy frecuente nunca sale
  assert.equal(K.simular(l, { C: 2, politica: "lfu" }).hits, 4); // 0 [0][0] 1 2(saca 1) [0] 1(saca 2) 3(saca 1) [0]
  const r = K.simular(t, { C: 2, politica: "aleatorio" }); assert.ok(r.hits >= 1 && r.hits <= 2);
  const g = K.simular(t, { C: 10, politica: "lru" }); assert.equal(g.hits, 3); assert.equal(g.evicciones, 0);
  const { traza: z } = K.generarTraza({ N: 2000, alfa: 0.9, M: 30000, semilla: 3 });
  const res = Object.fromEntries(Object.keys(K.POLITICAS).map((k) => [k, K.simular(z, { C: 200, politica: k }).hitRate]));
  for (const k of Object.keys(res)) assert.ok(res.belady >= res[k] - 1e-9, `Belady ≥ ${k}`);
  assert.ok(res.lru > res.fifo && res.lru > res.aleatorio, "LRU le gana a FIFO y aleatorio con Zipf");
  cerca(res.redis, res.lru, 0.03, "Redis muestreado ≈ LRU"); assert.ok(res.memorycache <= res.lru + 0.005, "compactar de a 5 % no gana");
});

test("la fórmula de Che coincide con LRU simulado, con y sin TTL (absoluto y deslizante)", () => {
  const N = 20000; const p = K.zipf(N, 0.9); const { traza: z } = K.generarTraza({ N, alfa: 0.9, M: 100000, semilla: 11 });
  for (const C of [100, 1000, 5000]) cerca(K.simular(z, { C, politica: "lru" }).hitRate, K.che(p, C, 0, 0).h, 0.02, `C=${C}`);
  for (const ttl of [500, 5000]) for (const ex of ["absoluta", "deslizante"]) cerca(K.simular(z, { C: 2000, politica: "lru", ttl, expiracion: ex }).hitRate, K.che(p, 2000, 0, ttl, ex).h, 0.02, `ttl ${ttl} ${ex}`);
  assert.ok(K.che(p, 2000, 0, 500, "deslizante").h > K.che(p, 2000, 0, 500, "absoluta").h, "deslizante rinde más");
  const sinTtl = K.che(p, 2000, 0, 0); assert.ok(sinTtl.lleno); const conTtl = K.che(p, 100000, 0, 500); assert.ok(!conTtl.lleno);
  // Novedades: la fórmula con q.
  const { traza: n } = K.generarTraza({ N, alfa: 0.9, M: 100000, novedades: 0.3, semilla: 11 }); cerca(K.simular(n, { C: 2000, politica: "lru" }).hitRate, K.che(p, 2000, 0.3, 0).h, 0.02, "novedades");
});

test("entradas para un hit rate: consistente con Che, monótono, null si no se llega", () => {
  const p = K.zipf(50000, 0.9);
  const c90 = K.entradasPara(p, 0.9, 0), c95 = K.entradasPara(p, 0.95, 0); assert.ok(c95 > c90);
  cerca(K.che(p, c90, 0, 0).h, 0.9, 0.005); cerca(K.che(p, c95, 0, 0).h, 0.95, 0.005);
  assert.equal(K.entradasPara(p, 0.9, 0.3), null, "con 30 % de novedades el tope es 70 %"); assert.ok(K.entradasPara(p, 0.6, 0.3) > 0);
});

test("casos donde la política importa: scan (LFU gana), rotación (LRU gana)", () => {
  const scan = K.generarTraza({ N: 20000, alfa: 0.9, M: 80000, novedades: 0.3, semilla: 4 }).traza;
  assert.ok(K.simular(scan, { C: 1000, politica: "lfu" }).hitRate > K.simular(scan, { C: 1000, politica: "lru" }).hitRate + 0.03);
  const rota = K.generarTraza({ N: 20000, alfa: 1, M: 80000, rotacion: 2000, semilla: 4 }).traza;
  assert.ok(K.simular(rota, { C: 1000, politica: "lru" }).hitRate > K.simular(rota, { C: 1000, politica: "lfu" }).hitRate + 0.03);
  const s = K.simular(rota, { C: 1000, politica: "lru", ventanas: 20 }); assert.equal(s.serie.length, 20); assert.ok(s.serie[0] < s.serie[10]);
});

test("estampida: sin protección manda rps×latencia por clave; single flight una por vencimiento; temprano no espera; jitter baja el pico", () => {
  const o = { claves: 10, rps: 200, ttlSeg: 10, latenciaMs: 80, segundos: 30 };
  const sin = K.estampida(Object.assign({ proteccion: "ninguna" }, o)); const sf = K.estampida(Object.assign({ proteccion: "singleflight" }, o)); const te = K.estampida(Object.assign({ proteccion: "temprano" }, o)); const ji = K.estampida(Object.assign({ proteccion: "jitter" }, o));
  assert.equal(sf.llamadas, 20, "10 claves × 2 vencimientos"); assert.ok(sin.llamadas > 200 && sin.llamadas < 500, `sin: ${sin.llamadas}`);
  assert.ok(sin.maxEnVuelo > 100 && sf.maxEnVuelo === 10, `pico ${sin.maxEnVuelo} / ${sf.maxEnVuelo}`);
  cerca(te.hitRate, 1, 0.001, "temprano"); assert.equal(te.p99Miss, 0); assert.ok(te.llamadas >= 20 && te.llamadas <= 40);
  assert.ok(ji.maxEnVuelo < sin.maxEnVuelo / 2, `jitter ${ji.maxEnVuelo} vs ${sin.maxEnVuelo}`); assert.ok(ji.llamadas > 200);
  assert.equal(sf.p99Miss, 80); assert.equal(sin.backend.length, 300); cerca(sin.pedidos, 60000, 1500, "pedidos totales");
});

test("correrTodo y el diagnóstico", () => {
  const r = K.correrTodo({ N: 10000, alfa: 0.9, M: 20000, novedades: 0, rotacion: 0, semilla: 1, C: 500, ttl: 0, expiracion: "absoluta", curva: { tamanios: [10, 100, 1000], politicas: ["lru", "belady"], M: 10000 } });
  assert.deepEqual(Object.keys(r.resultados), Object.keys(K.POLITICAS)); assert.equal(r.curva.series.lru.length, 3); assert.equal(r.curva.che.length, 3); assert.ok(r.curva.series.lru[2] > r.curva.series.lru[0]); assert.ok(r.para.h90 > 500);
  const d = K.diagnostico({ resultados: r.resultados, cheLru: r.cheLru, p: null, o: { N: 10000, C: 500, alfa: 0.9, novedades: 0, rotacion: 0, para: r.para }, rps: 1000, latHit: 0.5, latMiss: 40 });
  assert.match(d[0].titulo, /LRU acierta el \d+,\d %/); assert.match(d[1].titulo, /Che/); assert.match(d[2].texto, /Para el 90 % de aciertos, [\d.]+ entradas/); assert.match(d[d.length - 1].titulo, /óptimo imposible/);
  const d2 = K.diagnostico({ resultados: r.resultados, cheLru: r.cheLru, p: null, o: { N: 10000, C: 500, alfa: 0.9, novedades: 0.3, rotacion: 1000, para: r.para }, rps: 1000, latHit: 0.5, latMiss: 40 });
  assert.ok(d2.some((x) => /una sola vez/.test(x.titulo)) && d2.some((x) => /popularidad rota/.test(x.titulo)));
});
