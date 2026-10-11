// Tests de la lógica pura. Se corren con: node --test experimentos/colas-p99/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9) + 1e-9, `${msg}: ${a} vs ${b} (tol ${tol})`);

test("rng: reproducible, en [0, 1) y con media 0,5", () => {
  const a = L.crearRng(42), b = L.crearRng(42);
  const xs = Array.from({ length: 10000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  cerca(xs.reduce((s, x) => s + x, 0) / xs.length, 0.5, 0.03, "media");
});

test("erlangC: valores de tabla y casos borde", () => {
  // M/M/1: C = ρ.
  cerca(L.erlangC(1, 0.5), 0.5, 1e-12, "M/M/1");
  cerca(L.erlangC(1, 0.9), 0.9, 1e-12, "M/M/1 al 90%");
  // Tablas clásicas: c=2, a=1 → 1/3; c=10, a=8 → ≈ 0,409.
  cerca(L.erlangC(2, 1), 1 / 3, 1e-12, "c=2 a=1");
  cerca(L.erlangC(10, 8), 0.4092, 2e-3, "c=10 a=8");
  assert.equal(L.erlangC(4, 4), 1, "saturado");
  assert.equal(L.erlangC(4, 5), 1, "sobrecargado");
  assert.ok(L.erlangC(64, 50) > 0 && L.erlangC(64, 50) < 0.1, "c grande no desborda");
});

test("teoria: M/M/1 cierra con las fórmulas de libro", () => {
  // λ=8/s, S=100 ms → ρ=0,8; Wq = ρ/(μ-λ) = 0,8/2 = 0,4 s; W = 0,5 s; Lq = 3,2; L = 4.
  const t = L.teoria({ lambda: 8, media: 0.1, c: 1, distribucion: "exponencial" });
  cerca(t.rho, 0.8, 1e-12, "rho");
  cerca(t.espera, 0.4, 1e-9, "Wq");
  cerca(t.tiempo, 0.5, 1e-9, "W");
  cerca(t.enCola, 3.2, 1e-9, "Lq");
  cerca(t.enSistema, 4, 1e-9, "L");
  // P(Wq > t) = ρ e^{-(μ-λ)t}: percentil 99 de la espera.
  cerca(t.esperaPercentil(0.99), -Math.log(0.01 / 0.8) / 2, 1e-9, "p99 espera");
  assert.equal(t.esperaPercentil(0.1), 0, "percentil bajo: no espera");
});

test("teoria: inestable y corrección por variabilidad", () => {
  const i = L.teoria({ lambda: 100, media: 0.1, c: 8, distribucion: "exponencial" });
  assert.equal(i.estable, false);
  assert.equal(i.espera, Infinity);
  assert.equal(i.esperaPercentil(0.99), Infinity);
  const base = { lambda: 50, media: 0.12, c: 8 };
  const expo = L.teoria({ ...base, distribucion: "exponencial" });
  const det = L.teoria({ ...base, distribucion: "determinista" });
  const log = L.teoria({ ...base, distribucion: "lognormal", parametros: { cv: 2 } });
  cerca(det.espera, expo.espera / 2, 1e-12, "determinista: mitad de espera");
  cerca(log.cv2, 4, 1e-12, "cv² lognormal");
  cerca(log.espera, expo.espera * 2.5, 1e-12, "lognormal cv=2: (1+4)/2");
});

test("distribuciones: cada una respeta la media y su cv²", () => {
  for (const [clave, d] of Object.entries(L.DISTRIBUCIONES)) {
    const p = { cv: 1.5, probLenta: 0.05, factorLenta: 20 };
    const rng = L.crearRng(7);
    const n = 200000;
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const x = d.muestra(rng, 0.12, p); assert.ok(x > 0, `${clave} > 0`); s += x; s2 += x * x; }
    const media = s / n, var_ = s2 / n - media * media;
    cerca(media, 0.12, 0.03, `${clave} media`);
    cerca(var_ / (media * media), d.cv2(p), clave === "determinista" ? 1e-9 : 0.08, `${clave} cv²`);
  }
  const b = L.bimodalPartes(0.12, { probLenta: 0.05, factorLenta: 20 });
  cerca(0.95 * b.rapida + 0.05 * b.lenta, 0.12, 1e-12, "bimodal: media conservada");
  cerca(b.lenta / b.rapida, 20, 1e-12, "bimodal: factor");
});

test("simular: coincide con Erlang C en M/M/c y con Little", () => {
  const op = { lambda: 50, media: 0.12, c: 8, distribucion: "exponencial", pedidos: 300000, semilla: 11 };
  const t = L.teoria(op), s = L.simular(op);
  cerca(s.utilizacion, t.rho, 0.02, "utilización");
  cerca(s.pEspera, t.pEspera, 0.06, "P(esperar)");
  cerca(s.esperaMedia, t.espera, 0.08, "Wq");
  cerca(s.media, t.tiempo, 0.03, "W");
  cerca(s.enColaMedia, t.enCola, 0.1, "Lq");
  cerca(s.esperaPercentiles.p99, t.esperaPercentil(0.99), 0.08, "p99 de la espera");
  cerca(s.enSistemaLittle, t.enSistema, 0.03, "L = λW");
  assert.equal(s.rechazados, 0);
  assert.equal(s.atendidos, 270000, "descarta el 10% de calentamiento");
  // Las latencias vienen ordenadas y los percentiles son monótonos.
  const p = s.percentiles;
  assert.ok(p.p50 <= p.p90 && p.p90 <= p.p95 && p.p95 <= p.p99 && p.p99 <= p.p999 && p.p999 <= p.max);
  assert.ok(s.latencias.every((x, i) => i === 0 || x >= s.latencias[i - 1]));
});

test("simular: servicio parejo y M/D/1 con fórmula de Pollaczek-Khinchine", () => {
  // M/D/1: Wq = ρ/(2μ(1-ρ)) exacto. λ=8, S=0,1 → ρ=0,8 → Wq = 0,8/(2·10·0,2) = 0,2 s.
  const op = { lambda: 8, media: 0.1, c: 1, distribucion: "determinista", pedidos: 300000, semilla: 5 };
  const s = L.simular(op);
  cerca(s.esperaMedia, 0.2, 0.08, "M/D/1 Wq");
  cerca(L.teoria(op).espera, 0.2, 1e-9, "Allen-Cunneen es exacto en M/G/1");
  // Con poca carga nadie espera y la latencia es exactamente el servicio.
  const h = L.simular({ lambda: 1, media: 0.01, c: 4, distribucion: "determinista", pedidos: 5000 });
  cerca(h.percentiles.p50, 0.01, 1e-9, "latencia = servicio");
  assert.ok(h.pEspera < 0.01);
});

test("simular: la variabilidad agranda el p99 con la misma media", () => {
  const base = { lambda: 50, media: 0.12, c: 8, pedidos: 100000, semilla: 2 };
  const det = L.simular({ ...base, distribucion: "determinista" });
  const expo = L.simular({ ...base, distribucion: "exponencial" });
  const bim = L.simular({ ...base, distribucion: "bimodal", parametros: { probLenta: 0.05, factorLenta: 20 } });
  assert.ok(det.percentiles.p99 < expo.percentiles.p99 && expo.percentiles.p99 < bim.percentiles.p99);
  assert.ok(det.esperaMedia < expo.esperaMedia && expo.esperaMedia < bim.esperaMedia);
  cerca(det.media, expo.media, 0.15, "misma media aprox");
});

test("simular: cola máxima rechaza y acota la latencia; sobrecarga sin límite crece", () => {
  const con = L.simular({ lambda: 80, media: 0.12, c: 8, distribucion: "exponencial", pedidos: 100000, semilla: 3, colaMax: 5 });
  assert.ok(con.rechazados > 0 && con.fraccionRechazada > 0.1 && con.fraccionRechazada < 0.4, `rechazo ${con.fraccionRechazada}`);
  // Con 5 en cola como mucho y 8 workers, la espera p99 está acotada (~ 5 servicios / 8 workers, con cola).
  assert.ok(con.esperaPercentiles.p99 < 0.4, `espera acotada: ${con.esperaPercentiles.p99}`);
  assert.ok(con.serie.every((p) => p.cola <= 5), "la cola nunca pasa el máximo");
  assert.ok(con.utilizacion < 1 && con.utilizacion > 0.9);
  const sin = L.simular({ lambda: 80, media: 0.12, c: 8, distribucion: "exponencial", pedidos: 100000, semilla: 3 });
  assert.equal(sin.rechazados, 0);
  assert.ok(sin.percentiles.p99 > con.percentiles.p99 * 5, "sin límite la latencia se va a cualquier lado");
  assert.ok(sin.serie.length <= 240 && sin.serie.length > 100, `serie resumida: ${sin.serie.length}`);
  assert.throws(() => L.simular({ lambda: 0, media: 0.1, c: 1 }));
});

test("percentil e histograma", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(L.percentil(xs, 0.5), 5);
  assert.equal(L.percentil(xs, 0.9), 9);
  assert.equal(L.percentil(xs, 0.99), 10);
  assert.equal(L.percentil(xs, 0), 1);
  assert.equal(L.percentil([], 0.5), 0);
  const h = L.histograma(xs, 5, 10);
  assert.deepEqual(h.conteo, [1, 2, 2, 2, 3]);
  assert.equal(h.ancho, 2);
  const auto = L.histograma(xs, 4);
  assert.equal(auto.conteo.reduce((a, b) => a + b, 0), 10, "nada se pierde");
});

test("curvaUtilizacion: monótona en teoría y con forma de palo de hockey", () => {
  const c = L.curvaUtilizacion({ media: 0.12, c: 8, distribucion: "exponencial", semilla: 1 }, 8000);
  assert.equal(c.length, L.UTILIZACIONES.length);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].tiempoTeorico > c[i - 1].tiempoTeorico, "teoría crece");
  assert.ok(c[0].tiempoTeorico < 0.121 && c[c.length - 1].tiempoTeorico > 0.4, "de casi puro servicio a varias veces");
  const bajo = c.find((p) => p.rho === 0.5), alto = c.find((p) => p.rho === 0.95);
  assert.ok(alto.p99 > bajo.p99 * 1.5, "el p99 simulado explota");
  assert.ok(alto.p50 > bajo.p50, "el p50 también sube, menos");
});

test("diagnostico: zonas, textos y acciones", () => {
  const d = (op) => L.diagnostico(op, L.teoria(op), L.simular({ ...op, pedidos: 20000 }));
  const verde = d({ lambda: 10, media: 0.12, c: 8, distribucion: "exponencial", parametros: {}, colaMax: Infinity });
  assert.equal(verde.zona, "verde");
  assert.match(verde.titulo, /Holgado: 15%/);
  assert.match(verde.acciones[0], /Un worker más \(9\)/);
  const am = d({ lambda: 50, media: 0.12, c: 8, distribucion: "exponencial", parametros: {}, colaMax: Infinity });
  assert.equal(am.zona, "amarilla");
  assert.match(am.parrafos[1], /ley de Little/);
  const roja = d({ lambda: 60, media: 0.12, c: 8, distribucion: "bimodal", parametros: { probLenta: 0.05, factorLenta: 20 }, colaMax: Infinity });
  assert.equal(roja.zona, "roja");
  assert.ok(roja.parrafos.some((p) => /desparejo/.test(p)), "avisa de la variabilidad");
  assert.ok(roja.acciones.some((a) => /Achicar la cola de los lentos/.test(a)));
  const ines = d({ lambda: 100, media: 0.12, c: 8, distribucion: "exponencial", parametros: {}, colaMax: Infinity });
  assert.equal(ines.zona, "inestable");
  assert.match(ines.acciones[0], /harían falta 15 workers/);
  const lim = d({ lambda: 80, media: 0.12, c: 8, distribucion: "exponencial", parametros: {}, colaMax: 5 });
  assert.ok(lim.parrafos.some((p) => /se rechazó el/.test(p)));
});

test("ms y pct: formatos", () => {
  assert.equal(L.ms(0.0012), "1.20 ms");
  assert.equal(L.ms(0.0215), "21.5 ms");
  assert.equal(L.ms(0.145), "145 ms");
  assert.equal(L.ms(12.3), "12.3 s");
  assert.equal(L.ms(150), "150 s");
  assert.equal(L.ms(Infinity), "∞");
  assert.equal(L.pct(0.75), "75%");
  assert.equal(L.pct(0.0523), "5.2%");
});
