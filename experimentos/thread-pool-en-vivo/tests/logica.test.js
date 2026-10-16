// Tests de la lógica pura. Se corren con: node --test experimentos/thread-pool-en-vivo/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const base = { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, duracionS: 20, semilla: 7, gantt: false };
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9), `${msg}: ${a} vs ${b} (tol ${tol})`);

test("rng: reproducible y en [0, 1)", () => {
  const a = L.crearRng(42), b = L.crearRng(42);
  const xs = Array.from({ length: 5000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  cerca(xs.reduce((s, x) => s + x, 0) / xs.length, 0.5, 0.05, "media");
});

test("simular: misma semilla, mismo resultado; otra semilla, otro", () => {
  const a = L.simular(base), b = L.simular(base), c = L.simular({ ...base, semilla: 8 });
  assert.deepEqual(a.latencias, b.latencias);
  assert.notDeepEqual(a.latencias, c.latencias);
});

test("cuentas: Little y capacidades", () => {
  const c = L.cuentas(base);
  assert.equal(c.minHilos, 4);
  assert.equal(c.porPedidoBloqueando, 103);
  assert.equal(c.hilosNecesarios, Math.ceil(200 * 0.103)); // 21
  cerca(c.capacidadCpu, 4000 / 3, 1e-9, "tope por CPU");
  assert.equal(c.faltan, 17);
  assert.equal(c.segundosHastaAlcanzar, 8.5);
  assert.ok(c.cabeAsync && !c.cabeBloqueandoConMinimos);
  assert.equal(L.cuentas({ ...base, minHilos: 50 }).minHilos, 50);
});

test("async: los hilos se quedan en el mínimo y la latencia es casi la I/O", () => {
  const r = L.simular({ ...base, modoIo: "async" });
  assert.equal(r.hilosMax, 4, "no hace falta más que el mínimo");
  assert.equal(r.bloqueadosMax, 0);
  assert.ok(r.p50 >= 100 && r.p50 <= 110, `p50 ≈ I/O (${r.p50})`);
  assert.ok(r.p99 <= 130, `p99 chico (${r.p99})`);
  // Little: lo que terminó por segundo ≈ lo que llegó por segundo (régimen estable).
  cerca(r.completados / base.duracionS, base.rps, 0.08, "throughput ≈ λ");
  assert.equal(L.diagnosticar(r).zona, "ok");
});

test("clásico (.Result en .NET Framework, finalización por IOCP): inanición, un hilo cada 500 ms, y después se recupera", () => {
  const r = L.simular({ ...base, modoIo: "result", runtime: "clasico", duracionS: 30, finalizacionPorPool: false });
  const c = L.cuentas(base);
  // La inyección va a un hilo cada 500 ms: la muestra del segundo 1 se toma justo antes del gate de 1,0 s
  // (4 + 1 hilos) y la del segundo 5, antes del gate de 5,0 s (4 + 9 hilos).
  const en = (s) => r.muestras.find((m) => Math.abs(m.t - s) < 1e-9).hilos;
  assert.equal(en(1), 5, "a 1 s: 5 hilos");
  assert.equal(en(5), 13, "a 5 s: 13 hilos");
  assert.equal(en(10) - en(5), 10, "2 hilos por segundo");
  assert.ok(r.colaMax >= c.colaAcumulada * 0.8, `la cola llega a lo que dice la cuenta (${r.colaMax} vs ${c.colaAcumulada})`);
  assert.ok(r.p99 > 2000, `p99 de segundos (${r.p99})`);
  assert.ok(r.recuperacion.ok && r.recuperacion.t > 10 && r.recuperacion.t < 25, `se recupera entre 10 y 25 s (${r.recuperacion.t})`);
  assert.ok(r.hilosMax >= c.hilosNecesarios, "llegó a los hilos necesarios");
  const d = L.diagnosticar(r);
  assert.equal(d.zona, "inanicion");
  assert.match(d.resumen, /gate thread/);
});

test("I/O sincrónica: .NET 6+ no la detecta y pasa lo mismo que en el clásico", () => {
  const a = L.simular({ ...base, modoIo: "sync", runtime: "net6", duracionS: 30 });
  const b = L.simular({ ...base, modoIo: "sync", runtime: "clasico", duracionS: 30 });
  assert.deepEqual(a.muestras.map((m) => m.hilos), b.muestras.map((m) => m.hilos));
  assert.ok(a.p99 > 2000);
  assert.equal(L.diagnosticar(a).zona, "inanicion");
});

test("ritmo de inyección: con inyeccionMs = 1800 el pool crece más despacio y las cuentas lo reflejan", () => {
  const rapido = L.simular({ ...base, modoIo: "sync", duracionS: 20 });
  const lento = L.simular({ ...base, modoIo: "sync", duracionS: 20, inyeccionMs: 1800 });
  const en = (r, s) => r.muestras.find((m) => Math.abs(m.t - s) < 1e-9).hilos;
  assert.equal(en(rapido, 10), 23, "500 ms: a 10 s hay 4 + 19 hilos");
  assert.equal(en(lento, 10), 9, "1800 ms: a 10 s hay 4 + 5 hilos");
  assert.ok(lento.p99 > rapido.p99 * 1.5, `peor p99 (${lento.p99} vs ${rapido.p99})`);
  assert.equal(L.cuentas({ ...base, inyeccionMs: 1800 }).segundosHastaAlcanzar, 17 * 1.8);
});

test(".NET 6+ con .Result y finalización por la cola del pool (lo medido): se clava aunque inyecte hilos", () => {
  const r = L.simular({ ...base, modoIo: "result", runtime: "net6", duracionS: 30 });
  assert.ok(r.completados < r.llegados * 0.05, `casi nada termina (${r.completados} de ${r.llegados})`);
  assert.ok(r.hilosMax > 100, `inyectó hilos igual (${r.hilosMax})`);
  assert.ok(r.colaFinal > 1000, `la cola no para de crecer (${r.colaFinal})`);
  assert.equal(r.llegados, r.completados + r.enVuelo);
  const d = L.diagnosticar(r);
  assert.equal(d.zona, "colapso");
  assert.match(d.titulo, /Sync over async/);
  // Con poca carga los hilos libres llegan a las finalizaciones y funciona: el umbral es lo que lo hace traicionero.
  const poca = L.simular({ ...base, nucleos: 2, rps: 30, modoIo: "result", runtime: "net6" });
  assert.ok(poca.completados > poca.llegados * 0.95, `con 30 pedidos/s anda (${poca.completados} de ${poca.llegados})`);
});

test(".NET 6+ con .Result sin finalización por el pool (modelo optimista): inyecta rápido y el p99 baja a milisegundos", () => {
  const lento = L.simular({ ...base, modoIo: "result", runtime: "clasico", finalizacionPorPool: false });
  const rapido = L.simular({ ...base, modoIo: "result", runtime: "net6", finalizacionPorPool: false });
  assert.ok(rapido.p99 < 400, `p99 chico (${rapido.p99})`);
  assert.ok(rapido.p99 * 5 < lento.p99, "mucho mejor que el clásico");
  assert.ok(rapido.hilosMax >= 21, `usa muchos hilos (${rapido.hilosMax})`);
  // Los primeros ceil(4 × 1,25) = 5 hilos por encima del mínimo entran sin demora: a los 100 ms ya hay 9 o más.
  assert.ok(rapido.muestras[0].hilos >= 9, `a 100 ms ya hay ${rapido.muestras[0].hilos} hilos`);
  const d = L.diagnosticar(rapido);
  assert.match(d.titulo, /NET 6\+/);
});

test("SetMinThreads alto: el parche funciona", () => {
  const r = L.simular({ ...base, modoIo: "result", runtime: "clasico", minHilos: 64, finalizacionPorPool: false });
  assert.ok(r.p99 < 150, `p99 (${r.p99})`);
  assert.equal(L.diagnosticar(r).zona, "ok");
});

test("CPU que no alcanza: colapso aunque sea async", () => {
  const r = L.simular({ ...base, modoIo: "async", cpuMs: 30, cpuDespuesMs: 10, rps: 200, duracionS: 10 });
  const c = L.cuentas({ ...base, cpuMs: 30, cpuDespuesMs: 10 });
  assert.ok(!c.cabeAsync);
  assert.ok(r.colaFinal > 500, `la cola crece sin parar (${r.colaFinal})`);
  assert.ok(r.cpuPromedio > 0.95, `CPU a fondo (${r.cpuPromedio})`);
  assert.equal(L.diagnosticar(r).zona, "colapso");
});

test("ráfaga bloqueando: se traba y se digiere; con async no", () => {
  const sync = L.simular({ ...base, rps: 30, modoIo: "sync", patron: "rafaga", rafaga: 300 });
  const asyn = L.simular({ ...base, rps: 30, modoIo: "async", patron: "rafaga", rafaga: 300 });
  assert.ok(sync.colaMax >= 290 && sync.p99 > 1000, `la ráfaga se encola (${sync.colaMax}, p99 ${sync.p99})`);
  assert.ok(asyn.p99 < 500, `con async la ráfaga pasa (${asyn.p99})`);
  assert.equal(L.diagnosticar(sync).zona, "inanicion");
  assert.match(L.diagnosticar(sync).titulo, /ráfaga/i);
});

test("conservación: llegados = terminados + en vuelo", () => {
  for (const k of Object.keys(L.PRESETS)) {
    const r = L.simular({ ...L.PRESETS[k].valores, duracionS: 8, gantt: false });
    assert.equal(r.llegados, r.completados + r.enVuelo, `preset ${k}`);
  }
});

test("gantt: una fila cada 10 ms con el estado de cada hilo", () => {
  const r = L.simular({ ...base, modoIo: "result", runtime: "clasico", duracionS: 2, gantt: true, finalizacionPorPool: false });
  assert.equal(r.gantt.length, 200);
  assert.ok(r.gantt[150].length >= 7, "a 1,5 s hay al menos 7 hilos (4 + uno cada 500 ms)");
  assert.ok(Array.from(r.gantt[150]).every((e) => e === L.LIBRE || e === L.CPU || e === L.BLOQUEADO));
  assert.ok(Array.from(r.gantt[150]).some((e) => e === L.BLOQUEADO), "hay hilos bloqueados");
});

test("percentilOrdenado y recuperación", () => {
  assert.equal(L.percentilOrdenado([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.5), 5);
  assert.equal(L.percentilOrdenado([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.99), 10);
  assert.equal(L.percentilOrdenado([], 0.5), 0);
  const rec = L.tiempoRecuperacion([{ t: 1, cola: 0 }, { t: 2, cola: 100 }, { t: 3, cola: 50 }, { t: 4, cola: 1 }]);
  assert.deepEqual(rec, { pico: 100, tPico: 2, t: 4, ok: true });
  assert.equal(L.tiempoRecuperacion([{ t: 1, cola: 0 }, { t: 2, cola: 100 }]).ok, false);
});
