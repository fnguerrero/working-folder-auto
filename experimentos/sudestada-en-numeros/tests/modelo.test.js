'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../logica.js');
const C = require('../casos.js');

const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b} (tol ${tol})`);
/* Canal rectangular uniforme para comparar contra soluciones conocidas. */
const canal = { ancho: () => 50, hondo: () => 8 };
const estadoDe = m => ({ eta: new Float64Array(m.N), Q: new Float64Array(m.N + 1) });

test('río quieto, sin viento ni marea ni caudal, no se mueve', () => {
  const r = S.simular({ horas: 48, caudal: 0, marea: { factor: 0 } });
  for (const p of S.PUNTOS) for (const v of r.niveles[p.id]) cerca(v, S.BASE.cero, 1e-12);
});

test('conserva la masa: el volumen cambia lo que entra menos lo que sale', () => {
  const m = S.malla(S.BASE), est = estadoDe(m);
  const volumen = () => { let v = 0; for (let i = 1; i < m.N; i++) v += est.eta[i] * m.W[i] * m.dx; return v; };
  const v0 = volumen();
  let entrado = 0;
  for (let k = 0; k < 3000; k++) {
    S.paso(m, est, 120, 0.0022, 0.8 * Math.sin(k / 400), 0.4 * Math.sin(k / 60), 30000);
    entrado += 120 * (est.Q[1] - est.Q[m.N]);
  }
  cerca(volumen() - v0, entrado, 1e-6 * Math.max(1, Math.abs(entrado)), 'volumen');
});

test('viento sostenido en un canal uniforme: pendiente de equilibrio analítica', () => {
  const m = S.malla(Object.assign({}, S.BASE, canal)), est = estadoDe(m);
  const tau = 0.8;
  for (let k = 0; k < 30000; k++) S.paso(m, est, 120, 0.0025, tau, 0, 0);
  for (const i of [10, 40, 79]) {
    const x = (m.x[i] - m.x[0]) * 1000;
    // g (h+eta) d(eta)/dx = tau/rho  =>  (h+eta)^2 = h^2 + 2 tau x / (rho g)
    const exacto = Math.sqrt(64 + 2 * tau * x / (S.RHO_AGUA * S.G)) - 8;
    cerca(est.eta[i], exacto, 0.01, 'celda ' + i);
  }
});

test('una onda larga viaja a raíz de g por h', () => {
  const p = Object.assign({}, S.BASE, canal, { celdas: 640 });
  const m = S.malla(p), est = estadoDe(m), dt = 20, destino = 480;
  let llegada = null;
  for (let k = 1; k < 3000 && llegada === null; k++) {
    // escalón suave de 5 cm en la boca
    S.paso(m, est, dt, 0, 0, 0.05 * Math.min(1, k * dt / 1800), 0);
    if (est.eta[destino] >= 0.025) llegada = k * dt - 900;
  }
  const velocidad = (m.x[destino] - m.x[0]) * 1000 / llegada;
  cerca(velocidad, Math.sqrt(S.G * 8), 0.3, 'celeridad');
});

test('estable en los extremos de los controles', () => {
  for (const kmh of [90, 150]) for (const dir of [135, 315]) {
    const r = S.simular({
      horas: 96, caudal: 70000, marea: { factor: 1.5 },
      viento: S.vientoEscenario({ kmh, dir, inicio: 0, horas: 48, rampa: 0, rota: { kmh, dir: (dir + 180) % 360 } })
    });
    for (const fila of r.perfil) for (const v of fila) assert.ok(Number.isFinite(v) && Math.abs(v) < 40);
  }
});

test('el resultado casi no cambia al afinar la malla y el paso de tiempo', () => {
  const opc = { horas: 60, viento: S.vientoEscenario({ kmh: 55, dir: 135, inicio: 6, horas: 30 }) };
  const a = S.simular(opc);
  const b = S.simular(Object.assign({ parametros: { celdas: 160, dt: 60 } }, opc));
  for (const p of S.PUNTOS) {
    cerca(S.maximo(a.niveles[p.id], a.t).valor, S.maximo(b.niveles[p.id], b.t).valor, 0.12, p.id);
  }
});

test('la sudestada sube el agua y el viento del noroeste la baja', () => {
  const calma = S.simular({ horas: 60 });
  const con = dir => S.simular({ horas: 60, viento: S.vientoEscenario({ kmh: 50, dir, inicio: 6, horas: 36 }) });
  const se = con(135), no = con(315);
  for (const p of S.PUNTOS) {
    assert.ok(se.niveles[p.id][70] > calma.niveles[p.id][70] + 0.5, p.id);
    assert.ok(no.niveles[p.id][70] < calma.niveles[p.id][70] - 0.2, p.id);
  }
});

test('la crecida es mayor hacia la cabecera y llega más tarde que a la boca', () => {
  const r = S.simular({ horas: 60, marea: { factor: 0 }, viento: S.vientoEscenario({ kmh: 50, dir: 135, inicio: 6, horas: 48 }) });
  assert.ok(r.niveles.tigre[60] > r.niveles.riachuelo[60]);
  assert.ok(r.niveles.riachuelo[60] > r.niveles.laplata[60]);
  assert.ok(r.niveles.tigre[12] - r.niveles.tigre[0] < 0.3, 'a la hora 6 todavía no subió');
});

test('cuando el viento rota, baja antes que si solo amaina', () => {
  const v = { kmh: 55, dir: 135, inicio: 6, horas: 30 };
  const amaina = S.simular({ horas: 60, viento: S.vientoEscenario(v) });
  const rota = S.simular({ horas: 60, viento: S.vientoEscenario(Object.assign({ rota: { kmh: 40, dir: 270 } }, v)) });
  assert.ok(rota.niveles.tigre[90] < amaina.niveles.tigre[90] - 0.3);
});

test('más intensidad y más descarga, más nivel', () => {
  const picos = [20, 40, 60].map(kmh => S.rangoPorFase({ horas: 60, viento: S.vientoEscenario({ kmh, dir: 135, inicio: 6, horas: 30 }) }, 314, 4).medio);
  assert.ok(picos[0] < picos[1] && picos[1] < picos[2]);
  const bajo = S.simular({ horas: 24, caudal: 10000 }), alto = S.simular({ horas: 24, caudal: 60000 });
  assert.ok(alto.niveles.tigre[20] > bajo.niveles.tigre[20] + 0.1);
});

test('la marea sola queda en el rango habitual de Buenos Aires', () => {
  const s = S.simular({ horas: 72 }).niveles.riachuelo;
  // rango habitual publicado: 0,30 a 1,29 m
  assert.ok(Math.min(...s) > 0.25 && Math.max(...s) < 1.35, `${Math.min(...s)} a ${Math.max(...s)}`);
});

test('tensión del viento: nula en calma, rumbo y magnitud conocidos', () => {
  assert.strictEqual(Math.hypot(...S.tension(0, 135)), 0);
  // 72 km/h = 20 m/s: Cd = 2,1e-3, tau = 1,22 * 2,1e-3 * 400
  cerca(Math.hypot(...S.tension(72, 135)), 1.22 * 2.1e-3 * 400, 1e-9);
  cerca(S.proyectar(S.tension(72, 125), 305), -1.22 * 2.1e-3 * 400, 1e-9);
});

test('viento necesario: invierte el modelo', () => {
  const esc = { dir: 135, inicio: 6, horas: 30 };
  const kmh = S.vientoNecesario(3.5, esc, 280, {});
  const r = S.rangoPorFase({ horas: 72, viento: S.vientoEscenario(Object.assign({ kmh }, esc)) }, 280, 4);
  cerca(r.medio, 3.5, 0.02);
  assert.strictEqual(S.vientoNecesario(100, esc, 280, {}), null);
});

test('casos: datos completos y cada dato publicado con fuente enlazada', () => {
  assert.ok(C.CASOS.length >= 4);
  for (const c of C.CASOS) {
    assert.ok(c.viento || c.serie, c.id);
    assert.ok(c.sobreViento);
    for (const d of c.publicado) {
      assert.ok(C.FUENTES[d.fuente].url.startsWith('https://'), c.id);
      assert.ok(d.punto === 'bernal' || S.PUNTOS.some(p => p.id === d.punto));
    }
  }
  const s = C.CASOS.find(c => c.id === '2013').serie;
  assert.strictEqual(s.nivel.length, s.vel.length);
  assert.strictEqual(s.nivel.length, s.dir.length);
  cerca(Math.max(...s.nivel.filter(v => v !== null)), 2.91, 0.03, 'pico leído');
});

test('casos con viento supuesto: mismo orden de magnitud que lo publicado', () => {
  for (const c of C.CASOS.filter(c => c.viento)) {
    for (const d of c.publicado) {
      const km = S.PUNTOS.find(p => p.id === d.punto).km;
      const r = S.rangoPorFase({ horas: 72, viento: S.vientoEscenario(c.viento) }, km, 4);
      cerca(r.medio, d.valor, 1.0, c.id + ' ' + d.punto);
    }
  }
});

test('2013: el modelo con el viento de la costa se queda corto (limitación conocida)', () => {
  const s = C.CASOS.find(c => c.id === '2013').serie;
  const r = S.simular({ horas: 105, viento: S.vientoSerie(s.vel, s.dir), marea: { pleamar: 4 }, puntos: [{ id: 'b', km: s.km }] });
  assert.ok(S.maximo(r.niveles.b, r.t, 66, 84).valor < 2.91 - 0.8);
});
