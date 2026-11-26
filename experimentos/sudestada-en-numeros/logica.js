/* La sudestada en números: modelo de aguas poco profundas 1D del Río de la Plata.
   Sin dependencias; se usa en el navegador (window.Sudestada) y en Node (require). */
(function (raiz) {
  'use strict';

  const G = 9.81;
  const RHO_AGUA = 1010;   // kg/m3 (estuario, mezcla de agua dulce y salada)
  const RHO_AIRE = 1.22;

  /* Geometría esquemática: [km desde la boca aguas arriba, ancho en km,
     profundidad media en m]. Valores redondeados a mano. */
  const PERFIL = [
    [0, 220, 15], [60, 150, 12], [120, 100, 8], [200, 75, 6], [230, 55, 5.5],
    [280, 45, 5], [305, 22, 4.5], [320, 12, 5]
  ];

  const PUNTOS = [
    { id: 'tigre', nombre: 'Tigre', km: 314 },
    { id: 'sanfernando', nombre: 'San Fernando', km: 306 },
    { id: 'riachuelo', nombre: 'Riachuelo', km: 280 },
    { id: 'laplata', nombre: 'La Plata (costa)', km: 230 }
  ];

  /* Parámetros del modelo. Ver README: cuáles son físicos y cuáles supuestos. */
  const BASE = {
    largoKm: 320,
    celdas: 80,
    dt: 120,              // s
    cf: 0.0022,           // fricción de fondo (cuadrática)
    ejeGrados: 125,       // viento "de" este rumbo empuja de lleno aguas arriba
    oceanoK: 0.8,         // m de sobreelevación en la boca por Pa de tensión (supuesto)
    oceanoT: 9,           // h de demora de esa respuesta (supuesto)
    oceanoGrados: 150,    // rumbo que más apila agua en la boca (supuesto)
    mareaBoca: 0.28,      // m, amplitud semidiurna en la boca (ajustada)
    cero: 0.55,           // m: nivel medio sobre el cero de las alturas (supuesto)
    periodoM2: 12.42,
    periodoO1: 25.82
  };

  function interpolar(km, col) {
    if (km <= PERFIL[0][0]) return PERFIL[0][col];
    for (let i = 1; i < PERFIL.length; i++) {
      if (km <= PERFIL[i][0]) {
        const a = PERFIL[i - 1], b = PERFIL[i];
        return a[col] + (b[col] - a[col]) * (km - a[0]) / (b[0] - a[0]);
      }
    }
    return PERFIL[PERFIL.length - 1][col];
  }
  const anchoKm = km => interpolar(km, 1);
  const profundidad = km => interpolar(km, 2);

  /* Coeficiente de arrastre tipo Wu (1982), acotado. U en m/s. */
  function arrastre(U) {
    return Math.min(0.0028, (0.8 + 0.065 * U) * 1e-3);
  }

  /* Tensión del viento como vector hacia "de dónde viene": [este, norte] en Pa. */
  function tension(kmh, grados) {
    const U = Math.max(0, kmh) / 3.6;
    const m = RHO_AIRE * arrastre(U) * U * U;
    const r = grados * Math.PI / 180;
    return [m * Math.sin(r), m * Math.cos(r)];
  }

  function proyectar(tau, grados) {
    const r = grados * Math.PI / 180;
    return tau[0] * Math.sin(r) + tau[1] * Math.cos(r);
  }

  /* Escenario sencillo: calma, sopla "dir" desde "inicio" durante "horas",
     y al terminar rota a otro viento (o amaina). Rampas lineales. */
  function vientoEscenario(v) {
    const rampa = v.rampa === undefined ? 6 : v.rampa;
    const t0 = v.inicio, t1 = v.inicio + v.horas;
    const A = tension(v.kmh, v.dir);
    const B = v.rota ? tension(v.rota.kmh, v.rota.dir) : [0, 0];
    const mezcla = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
    const frac = (t, a) => rampa <= 0 ? (t >= a ? 1 : 0) : Math.min(1, Math.max(0, (t - a) / rampa));
    return function (t) {
      if (t < t1) return mezcla([0, 0], A, frac(t, t0));
      const desde = mezcla([0, 0], A, frac(t1, t0));
      return mezcla(desde, B, frac(t, t1));
    };
  }

  /* Serie horaria publicada: vel (km/h) y dir (grados), índice = hora. */
  function vientoSerie(vel, dir, factor) {
    const f = factor === undefined ? 1 : factor;
    const taus = [];
    let ultimo = [0, 0];
    for (let i = 0; i < vel.length; i++) {
      if (vel[i] !== null && dir[i] !== null) ultimo = tension(vel[i] * f, dir[i]);
      taus.push(ultimo);
    }
    return function (t) {
      if (t < 0) return [0, 0];
      const i = Math.min(taus.length - 1, Math.floor(t));
      const j = Math.min(taus.length - 1, i + 1);
      const a = Math.min(1, t - i);
      return [taus[i][0] * (1 - a) + taus[j][0] * a, taus[i][1] * (1 - a) + taus[j][1] * a];
    };
  }

  function malla(p) {
    const N = p.celdas, dx = p.largoKm * 1000 / N;
    const ancho = p.ancho || anchoKm, hondo = p.hondo || profundidad;
    const W = new Float64Array(N), h = new Float64Array(N), x = new Float64Array(N);
    const Wf = new Float64Array(N + 1), hf = new Float64Array(N + 1);
    for (let i = 0; i < N; i++) {
      x[i] = (i + 0.5) * dx / 1000;
      W[i] = ancho(x[i]) * 1000;
      h[i] = hondo(x[i]);
    }
    for (let j = 0; j <= N; j++) {
      const km = j * dx / 1000;
      Wf[j] = ancho(km) * 1000;
      hf[j] = hondo(km);
    }
    return { N, dx, x, W, h, Wf, hf };
  }

  /* Un paso: esquema escalonado adelante-atrás, fricción semi-implícita.
     Q > 0 es aguas arriba. La celda 0 es el borde con el océano (impuesta);
     la cara N es la cabecera, donde entra el caudal de los ríos. */
  function paso(m, est, dt, cf, tauEje, etaBoca, caudal) {
    const { N, dx, W, Wf, hf } = m;
    const eta = est.eta, Q = est.Q;
    eta[0] = etaBoca;
    for (let j = 1; j < N; j++) {
      const H = Math.max(0.5, hf[j] + 0.5 * (eta[j - 1] + eta[j]));
      const A = Wf[j] * H;
      const q = Q[j] + dt * (-G * A * (eta[j] - eta[j - 1]) / dx + Wf[j] * tauEje / RHO_AGUA);
      Q[j] = q / (1 + dt * cf * Math.abs(Q[j]) / (A * H));
    }
    Q[N] = -caudal;
    for (let i = 1; i < N; i++) {
      eta[i] -= dt * (Q[i + 1] - Q[i]) / (W[i] * dx);
    }
  }

  function indiceKm(m, km) {
    const f = Math.min(m.N - 1, Math.max(0, km * 1000 / m.dx - 0.5));
    const i = Math.min(m.N - 2, Math.floor(f));
    return [i, f - i];
  }

  /* Corre una simulación.
     opc: { horas, previo, cada, viento(t)->tau, caudal, marea: {factor, pleamar},
            puntos, parametros } */
  function simular(opc) {
    const p = Object.assign({}, BASE, opc.parametros || {});
    const horas = opc.horas === undefined ? 96 : opc.horas;
    const previo = opc.previo === undefined ? 72 : opc.previo;
    const caudal = opc.caudal === undefined ? 25000 : opc.caudal;
    const marea = Object.assign({ factor: 1, pleamar: 0 }, opc.marea || {});
    const viento = opc.viento || (() => [0, 0]);
    const puntos = opc.puntos || PUNTOS;
    const cada = opc.cada || 0.5;
    const m = malla(p);
    const est = { eta: new Float64Array(m.N), Q: new Float64Array(m.N + 1) };
    for (let j = 1; j <= m.N; j++) est.Q[j] = -caudal;

    const idx = puntos.map(pt => indiceKm(m, pt.km));
    const salida = { t: [], niveles: {}, perfil: [], viento: [], boca: [], x: Array.from(m.x) };
    puntos.forEach(pt => { salida.niveles[pt.id] = []; });

    const pasosPorMuestra = Math.max(1, Math.round(cada * 3600 / p.dt));
    const dt = cada * 3600 / pasosPorMuestra;
    const nPrev = Math.round(previo / cada), nTot = nPrev + Math.round(horas / cada);
    let oceano = 0;

    for (let k = 0; k <= nTot; k++) {
      const th = (k - nPrev) * cada;
      if (k >= nPrev) {
        salida.t.push(th);
        salida.boca.push(est.eta[0] + p.cero);
        salida.viento.push(viento(th));
        if (!opc.sinPerfil) salida.perfil.push(Array.from(est.eta, e => e + p.cero));
        puntos.forEach((pt, n) => {
          const [i, a] = idx[n];
          salida.niveles[pt.id].push(p.cero + est.eta[i] * (1 - a) + est.eta[i + 1] * a);
        });
      }
      if (k === nTot) break;
      for (let s = 0; s < pasosPorMuestra; s++) {
        const t = th + (s + 1) * dt / 3600;
        const tau = viento(t);
        const objetivo = p.oceanoK * proyectar(tau, p.oceanoGrados);
        oceano += (objetivo - oceano) * (1 - Math.exp(-dt / 3600 / p.oceanoT));
        const w = t - marea.pleamar;
        const astro = marea.factor * p.mareaBoca *
          (Math.cos(2 * Math.PI * w / p.periodoM2) + 0.25 * Math.cos(2 * Math.PI * w / p.periodoO1));
        // la marea entra de a poco durante el arranque para no generar un golpe
        const suave = previo > 0 ? Math.max(0, Math.min(1, (t + previo) / 24)) : 1;
        paso(m, est, dt, p.cf, proyectar(tau, p.ejeGrados), astro * suave + oceano, caudal);
      }
    }
    return salida;
  }

  function maximo(serie, t, desde, hasta) {
    let v = -Infinity, cuando = null;
    for (let i = 0; i < serie.length; i++) {
      if (desde !== undefined && t[i] < desde) continue;
      if (hasta !== undefined && t[i] > hasta) continue;
      if (serie[i] > v) { v = serie[i]; cuando = t[i]; }
    }
    return { valor: v, hora: cuando };
  }

  /* Pico en un punto probando varias fases de marea (la hora de la pleamar de los
     casos históricos no está cargada). Devuelve mínimo, medio y máximo. */
  function rangoPorFase(opc, km, fases) {
    const n = fases || 12, picos = [];
    for (let i = 0; i < n; i++) {
      const o = Object.assign({}, opc, {
        puntos: [{ id: 'p', km }],
        sinPerfil: true,
        marea: Object.assign({}, opc.marea, { pleamar: i * BASE.periodoM2 / n })
      });
      const r = simular(o);
      picos.push(maximo(r.niveles.p, r.t).valor);
    }
    return {
      min: Math.min(...picos), max: Math.max(...picos),
      medio: picos.reduce((a, b) => a + b, 0) / n
    };
  }

  /* Intensidad (km/h) que hace falta para que el pico medio llegue a "objetivo".
     null si no se alcanza entre 0 y 150 km/h. */
  function vientoNecesario(objetivo, escenario, km, opc) {
    const pico = kmh => rangoPorFase(Object.assign({ horas: 72 }, opc, {
      viento: vientoEscenario(Object.assign({}, escenario, { kmh }))
    }), km, 4).medio;
    let a = 0, b = 150;
    if (pico(b) < objetivo || pico(a) > objetivo) return null;
    for (let i = 0; i < 10; i++) {
      const c = (a + b) / 2;
      if (pico(c) < objetivo) a = c; else b = c;
    }
    return (a + b) / 2;
  }

  const api = {
    G, RHO_AGUA, RHO_AIRE, BASE, PERFIL, PUNTOS,
    anchoKm, profundidad, arrastre, tension, proyectar, vientoEscenario, vientoSerie,
    malla, paso, indiceKm, simular, maximo, rangoPorFase, vientoNecesario
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Sudestada = api;
})(this);
