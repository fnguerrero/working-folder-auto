/* Por qué explota el p99: lógica pura. Se carga en el navegador (window.Colas) y en Node (module.exports).
   No toca el DOM ni localStorage.

   Modelo: pedidos que llegan al azar (proceso de Poisson, tasa λ), una sola cola FIFO y c workers
   idénticos. Cada pedido tarda un tiempo de servicio S con una distribución elegible.
   - teoria(): fórmulas cerradas (Erlang C para M/M/c y la corrección de Allen-Cunneen para otras
     distribuciones de servicio).
   - simular(): simulación de eventos discretos, exacta para este modelo, con semilla reproducible.
   Las dos deberían coincidir en promedio; la simulación además da percentiles, que es lo que importa. */
"use strict";
(function (raiz) {

  /* ---------- Azar reproducible (mulberry32) ---------- */
  function crearRng(semilla) {
    let a = (semilla >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Normal estándar por Box-Muller. */
  function normal(rng) {
    const u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* ---------- Distribuciones del tiempo de servicio ----------
     Cada una recibe la media (en segundos) y parámetros propios y devuelve una muestra.
     cv2 es el coeficiente de variación al cuadrado (varianza / media²): es lo que mide "qué tan
     parejos" son los tiempos, y es el único número que la teoría necesita de la distribución. */
  const DISTRIBUCIONES = {
    exponencial: {
      nombre: "Exponencial (al azar, como asume Erlang)",
      corta: "exponencial",
      cv2: () => 1,
      muestra: (rng, media) => -media * Math.log(1 - rng()),
    },
    determinista: {
      nombre: "Pareja (siempre tarda lo mismo)",
      corta: "pareja",
      cv2: () => 0,
      muestra: (rng, media) => media,
    },
    lognormal: {
      nombre: "Lognormal (la típica de una API real)",
      corta: "lognormal",
      cv2: (p) => (p.cv || 1) ** 2,
      muestra: (rng, media, p) => {
        const cv = p.cv || 1;
        const s2 = Math.log(1 + cv * cv);
        const mu = Math.log(media) - s2 / 2;
        return Math.exp(mu + Math.sqrt(s2) * normal(rng));
      },
    },
    bimodal: {
      nombre: "Bimodal (casi todas rápidas, algunas muy lentas)",
      corta: "bimodal",
      cv2: (p) => {
        const { rapida, lenta, prob } = bimodalPartes(1, p);
        const m2 = (1 - prob) * rapida * rapida + prob * lenta * lenta;
        return m2 - 1;
      },
      muestra: (rng, media, p) => {
        const { rapida, lenta, prob } = bimodalPartes(media, p);
        return rng() < prob ? lenta : rapida;
      },
    },
  };

  /* Bimodal: una fracción `prob` de pedidos tarda `factor` veces más que el resto, manteniendo la media. */
  function bimodalPartes(media, p) {
    const prob = Math.min(0.99, Math.max(0, p.probLenta ?? 0.05));
    const factor = Math.max(1, p.factorLenta ?? 20);
    const rapida = media / ((1 - prob) + prob * factor);
    return { rapida, lenta: rapida * factor, prob };
  }

  /* ---------- Teoría ---------- */

  /* Erlang C: probabilidad de que un pedido tenga que esperar en un M/M/c con carga ofrecida a = λ/μ. */
  function erlangC(c, a) {
    if (c <= 0) return 1;
    const rho = a / c;
    if (rho >= 1) return 1;
    let termino = 1, suma = 1;
    for (let k = 1; k < c; k++) { termino *= a / k; suma += termino; }
    const ultimo = (termino * a / c) / (1 - rho);
    return ultimo / (suma + ultimo);
  }

  /* Fórmulas cerradas para el escenario. λ en pedidos/segundo, media en segundos. */
  function teoria(op) {
    const { lambda, media, c } = op;
    const dist = DISTRIBUCIONES[op.distribucion] || DISTRIBUCIONES.exponencial;
    const cv2 = dist.cv2(op.parametros || {});
    const mu = 1 / media;
    const a = lambda * media;          // carga ofrecida (en "workers ocupados")
    const rho = a / c;                 // utilización
    const estable = rho < 1;
    const pEspera = estable ? erlangC(c, a) : 1;
    const esperaMMc = estable ? pEspera / (c * mu - lambda) : Infinity;   // Wq de Erlang C
    const factorVar = (1 + cv2) / 2;                                       // Allen-Cunneen (llegadas Poisson)
    const espera = estable ? esperaMMc * factorVar : Infinity;
    const tiempo = estable ? espera + media : Infinity;
    return {
      lambda, media, c, cv2, a, rho, estable, pEspera,
      esperaMMc, espera, tiempo,
      enCola: estable ? lambda * espera : Infinity,     // Little: Lq = λ·Wq
      enSistema: estable ? lambda * tiempo : Infinity,  // Little: L = λ·W
      ocupados: Math.min(a, c),
      /* Percentil p de la espera en cola, solo exacto para servicio exponencial:
         P(Wq > t) = C · e^(-(cμ-λ) t). */
      esperaPercentil(p) {
        if (!estable) return Infinity;
        if (pEspera <= 1 - p) return 0;
        return -Math.log((1 - p) / pEspera) / (c * mu - lambda);
      },
    };
  }

  /* ---------- Simulación ---------- */

  const SIM_DEFAULT = {
    lambda: 50, media: 0.12, c: 8, distribucion: "exponencial", parametros: {},
    pedidos: 20000, semilla: 1, colaMax: Infinity, calentamiento: 0.1, puntosSerie: 240,
  };

  /* Simula `pedidos` llegadas. Devuelve latencias ordenadas (en segundos), esperas, percentiles,
     utilización medida, rechazos (si hay cola máxima) y una serie temporal del largo de la cola. */
  function simular(op) {
    const o = Object.assign({}, SIM_DEFAULT, op);
    const { lambda, media, c, pedidos } = o;
    if (!(lambda > 0) || !(media > 0) || !(c >= 1) || !(pedidos >= 1)) throw new Error("Parámetros inválidos");
    const dist = DISTRIBUCIONES[o.distribucion] || DISTRIBUCIONES.exponencial;
    const params = o.parametros || {};
    const colaMax = o.colaMax === null || o.colaMax === undefined || o.colaMax < 0 ? Infinity : o.colaMax;
    const rng = crearRng(o.semilla);
    const libres = new Float64Array(c);          // momento en que cada worker se desocupa
    const inicios = new Float64Array(pedidos);   // inicio de servicio de los aceptados, en orden
    const serieT = new Float64Array(pedidos), serieCola = new Int32Array(pedidos);
    const desde = Math.floor(pedidos * o.calentamiento);
    const latencias = [], esperas = [];
    let t = 0, aceptados = 0, puntero = 0, rechazados = 0, ocupado = 0, tFin = 0, tCalentado = 0;
    let sumaEnCola = 0, nMedidos = 0, esperaron = 0;

    for (let i = 0; i < pedidos; i++) {
      t += -Math.log(1 - rng()) / lambda;        // llegadas Poisson: entre llegadas, exponencial
      if (i === desde) tCalentado = t;
      while (puntero < aceptados && inicios[puntero] <= t) puntero++;
      const enCola = aceptados - puntero;        // aceptados antes que yo que todavía no arrancaron
      serieT[i] = t;
      if (enCola >= colaMax) {                   // cola llena: se rechaza (503, timeout, lo que sea)
        serieCola[i] = enCola;
        if (i >= desde) { rechazados++; sumaEnCola += enCola; nMedidos++; }
        continue;
      }
      let w = 0;
      for (let k = 1; k < c; k++) if (libres[k] < libres[w]) w = k;
      const inicio = Math.max(t, libres[w]);
      const servicio = dist.muestra(rng, media, params);
      const fin = inicio + servicio;
      libres[w] = fin;
      inicios[aceptados++] = inicio;
      serieCola[i] = enCola + (inicio > t ? 1 : 0);
      if (fin > tFin) tFin = fin;
      if (i >= desde) {
        ocupado += servicio;
        esperas.push(inicio - t);
        latencias.push(fin - t);
        if (inicio > t) esperaron++;
        sumaEnCola += enCola; nMedidos++;
      }
    }

    latencias.sort((x, y) => x - y);
    esperas.sort((x, y) => x - y);
    const duracion = Math.max(tFin, t) - tCalentado;
    const n = latencias.length;
    const sumaLat = latencias.reduce((s, x) => s + x, 0);
    const sumaEsp = esperas.reduce((s, x) => s + x, 0);
    const medidos = pedidos - desde;
    const lambdaEfectiva = n / duracion;

    return {
      opciones: o,
      pedidosMedidos: medidos,
      atendidos: n,
      rechazados,
      fraccionRechazada: medidos ? rechazados / medidos : 0,
      utilizacion: duracion > 0 ? ocupado / (c * duracion) : 0,
      pEspera: n ? esperaron / n : 0,
      latencias,
      esperas,
      media: n ? sumaLat / n : 0,
      esperaMedia: n ? sumaEsp / n : 0,
      enColaMedia: nMedidos ? sumaEnCola / nMedidos : 0,
      enSistemaLittle: lambdaEfectiva * (n ? sumaLat / n : 0),
      percentiles: {
        p50: percentil(latencias, 0.5), p90: percentil(latencias, 0.9), p95: percentil(latencias, 0.95),
        p99: percentil(latencias, 0.99), p999: percentil(latencias, 0.999), max: n ? latencias[n - 1] : 0,
      },
      esperaPercentiles: { p50: percentil(esperas, 0.5), p99: percentil(esperas, 0.99) },
      duracion,
      serie: resumirSerie(serieT, serieCola, o.puntosSerie),
    };
  }

  /* Percentil por rango más cercano sobre un arreglo ya ordenado. */
  function percentil(ordenado, p) {
    const n = ordenado.length;
    if (!n) return 0;
    const k = Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1));
    return ordenado[k];
  }

  /* Reduce la serie (t, largo de cola) a como mucho `puntos` tramos, quedándose con el máximo de cada uno. */
  function resumirSerie(tiempos, colas, puntos) {
    const n = tiempos.length;
    if (!n) return [];
    const tMax = tiempos[n - 1];
    const tramos = Math.min(puntos, n);
    const salida = new Array(tramos).fill(null);
    for (let i = 0; i < n; i++) {
      const j = Math.min(tramos - 1, Math.floor(tiempos[i] / tMax * tramos));
      if (!salida[j] || colas[i] > salida[j].cola) salida[j] = { t: tiempos[i], cola: colas[i] };
    }
    return salida.filter(Boolean);
  }

  /* Histograma de latencias en `cajas` tramos iguales hasta `hasta` (segundos); lo que sobra va a la última. */
  function histograma(ordenado, cajas, hasta) {
    const conteo = new Array(cajas).fill(0);
    if (!ordenado.length) return { conteo, ancho: 0, hasta: 0 };
    const tope = hasta || ordenado[Math.min(ordenado.length - 1, Math.ceil(0.995 * ordenado.length) - 1)] * 1.05 || 1;
    const ancho = tope / cajas;
    for (const x of ordenado) conteo[Math.min(cajas - 1, Math.floor(x / ancho))]++;
    return { conteo, ancho, hasta: tope };
  }

  /* ---------- La curva del palo de hockey ----------
     Para la misma cantidad de workers y la misma distribución, qué pasa con la latencia a medida que
     sube la utilización. Teoría (media) y simulación (p50 y p99) en cada punto. */
  const UTILIZACIONES = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97];

  function curvaUtilizacion(op, pedidosPorPunto) {
    const base = Object.assign({}, SIM_DEFAULT, op);
    const porPunto = pedidosPorPunto || Math.max(20000, Math.min(60000, base.pedidos));
    return UTILIZACIONES.map((rho, i) => {
      const lambda = rho * base.c / base.media;
      const esc = Object.assign({}, base, { lambda, pedidos: porPunto, semilla: base.semilla + 1000 + i, colaMax: Infinity, puntosSerie: 1 });
      const te = teoria(esc);
      const si = simular(esc);
      return { rho, lambda, tiempoTeorico: te.tiempo, esperaTeorica: te.espera, p50: si.percentiles.p50, p99: si.percentiles.p99, media: si.media };
    });
  }

  /* ---------- Diagnóstico en criollo ---------- */

  function ms(seg) {
    if (!isFinite(seg)) return "∞";
    const v = seg * 1000;
    if (v >= 100000) return `${Math.round(v / 1000)} s`;
    if (v >= 10000) return `${(v / 1000).toFixed(1)} s`;
    if (v >= 100) return `${Math.round(v)} ms`;
    if (v >= 10) return `${v.toFixed(1)} ms`;
    return `${v.toFixed(2)} ms`;
  }
  const pct = (x) => `${(x * 100).toFixed(x * 100 >= 10 ? 0 : 1)}%`;
  const num = (x, d = 1) => Number.isInteger(x) ? String(x) : x.toFixed(d);

  function diagnostico(op, te, si) {
    const parrafos = [];
    const workers = op.c === 1 ? "1 worker" : `${op.c} workers`;
    let zona, titulo;
    if (!te.estable) {
      zona = "inestable";
      titulo = "Inestable: llegan más pedidos de los que podés atender";
      parrafos.push(`Con ${workers} a ${ms(op.media)} de promedio atendés como mucho ${num(op.c / op.media, 1)} pedidos por segundo, y están llegando ${num(op.lambda, 1)}. La cola crece sin parar: la latencia no se estabiliza nunca y lo que ves en la simulación depende solo de cuánto la dejaste correr.`);
    } else if (te.rho >= 0.85) {
      zona = "roja";
      titulo = `Zona roja: ${pct(te.rho)} de utilización`;
      parrafos.push(`Los workers están ocupados el ${pct(te.rho)} del tiempo. Acá cualquier ráfaga de llegadas o un par de pedidos lentos arman cola, y la cola se tarda mucho en vaciar porque casi no hay capacidad ociosa para hacerlo. El p99 (${ms(si.percentiles.p99)}) es ${num(si.percentiles.p99 / Math.max(si.percentiles.p50, 1e-9), 1)} veces el p50 (${ms(si.percentiles.p50)}).`);
    } else if (te.rho >= 0.7) {
      zona = "amarilla";
      titulo = `Zona amarilla: ${pct(te.rho)} de utilización`;
      parrafos.push(`Todavía anda, pero estás en la parte de la curva donde empieza a doblar: subir un poco la carga ya empeora bastante la cola. ${pct(te.pEspera)} de los pedidos esperan algo antes de que los agarre un worker.`);
    } else {
      zona = "verde";
      titulo = `Holgado: ${pct(te.rho)} de utilización`;
      parrafos.push(`Hay capacidad de sobra: ${pct(1 - te.pEspera)} de los pedidos encuentran un worker libre al llegar y la latencia es casi el tiempo de servicio puro.`);
    }

    if (te.estable) {
      parrafos.push(`Por la ley de Little, adentro del sistema hay en promedio λ·W = ${num(op.lambda, 1)} × ${ms(si.media)} ≈ ${num(si.enSistemaLittle, 1)} pedidos (${num(te.ocupados, 1)} siendo atendidos y ${num(si.enColaMedia, 1)} en la cola).`);
    }

    if (te.cv2 > 1.5 && te.estable) {
      parrafos.push(`El tiempo de servicio es muy desparejo (cv² = ${num(te.cv2, 1)}). La espera en cola crece con (1 + cv²)/2: con tiempos parejos la espera media sería ${ms(te.esperaMMc / 2)} en vez de ${ms(te.espera)}. Un pedido lento no te cuesta solo su tiempo, les cuesta a todos los que llegan atrás.`);
    } else if (te.cv2 < 0.5 && te.estable && te.rho > 0.5) {
      parrafos.push(`Tiempos de servicio parejos (cv² = ${num(te.cv2, 1)}): la cola es la mitad de la que predice Erlang C con servicio exponencial. La variabilidad que queda viene toda de las llegadas.`);
    }

    if (si.rechazados > 0) {
      parrafos.push(`Con cola máxima de ${op.colaMax} se rechazó el ${pct(si.fraccionRechazada)} de los pedidos. A cambio, el p99 de los atendidos quedó en ${ms(si.percentiles.p99)}: eso es lo que compra un límite de cola o un timeout, latencia acotada para la mayoría a costa de errores rápidos para algunos.`);
    }

    const conUno = teoria(Object.assign({}, op, { c: op.c + 1 }));
    const sinCola = teoria(Object.assign({}, op, { lambda: op.lambda * 0.9 }));
    const acciones = [];
    if (te.estable) {
      acciones.push(`Un worker más (${op.c + 1}) baja la utilización a ${pct(conUno.rho)} y la espera media de ${ms(te.espera)} a ${ms(conUno.espera)}.`);
      acciones.push(`Sacar un 10% de carga (caché, deduplicar, batchear) la deja en ${pct(sinCola.rho)} y la espera media en ${ms(sinCola.espera)}.`);
      if (te.cv2 > 0.5) acciones.push(`Achicar la cola de los lentos (paginar, poner timeout a la query larga, mandarla a otro pool) reduce cv² y baja la espera de todos, no solo la de ellos.`);
    } else {
      const minimo = Math.ceil(op.lambda * op.media / 0.8);
      acciones.push(`Para quedar al 80% harían falta ${minimo} workers (hoy ${op.c}), o bajar la carga a ${num(0.8 * op.c / op.media, 1)} pedidos por segundo.`);
    }
    return { zona, titulo, parrafos, acciones };
  }

  const API = {
    crearRng, normal, DISTRIBUCIONES, bimodalPartes, erlangC, teoria, simular, percentil, histograma,
    curvaUtilizacion, UTILIZACIONES, diagnostico, ms, pct, SIM_DEFAULT,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.Colas = API;
})(typeof window !== "undefined" ? window : globalThis);
