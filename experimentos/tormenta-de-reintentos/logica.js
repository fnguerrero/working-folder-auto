/* Simulación de eventos discretos de reintentos, timeouts y circuit breaker.
   Anda en el navegador (window.Reintentos) y en Node (require). */
(function (raiz) {
  'use strict';

  const BASE = {
    // tráfico y servicio
    rps: 200, duracion: 60, capacidad: 35, cola: 1000, latencia: 120, dispersion: 0.5, fallaBase: 0.005,
    // incidente
    caidaDesde: 15, caidaHasta: 30, fallaCaida: 0.9, lentitudCaida: 3,
    // política
    reintentos: 3, backoff: 'exponencial', espera: 200, esperaMax: 5000, jitter: true, timeout: 1000,
    breaker: true, umbral: 0.5, minimo: 20, ventana: 10, apertura: 5, instancias: 4,
    semilla: 7,
  };

  const ESCENARIOS = {
    sin: { nombre: 'Sin reintentos', reintentos: 0, breaker: false },
    ingenuos: { nombre: 'Reintentos ingenuos', reintentos: 5, backoff: 'fijo', espera: 100, jitter: false, breaker: false },
    cuidados: { nombre: 'Backoff + jitter + breaker', reintentos: 3, backoff: 'exponencial', espera: 200, esperaMax: 5000, jitter: true, breaker: true },
  };

  function azar(semilla) { // mulberry32
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class Monticulo {
    constructor() { this.a = []; this.n = 0; }
    meter(t, tipo, dato) {
      const e = { t, o: this.n++, tipo, dato };
      const a = this.a;
      let i = a.push(e) - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (antes(a[p], e)) break;
        a[i] = a[p]; i = p;
      }
      a[i] = e;
    }
    sacar() {
      const a = this.a;
      if (!a.length) return null;
      const primero = a[0], ultimo = a.pop();
      if (a.length) {
        let i = 0;
        for (;;) {
          let h = 2 * i + 1;
          if (h >= a.length) break;
          if (h + 1 < a.length && antes(a[h + 1], a[h])) h++;
          if (antes(ultimo, a[h])) break;
          a[i] = a[h]; i = h;
        }
        a[i] = ultimo;
      }
      return primero;
    }
  }
  function antes(x, y) { return x.t < y.t || (x.t === y.t && x.o < y.o); }

  /* Circuit breaker por proporción de fallas en una ventana deslizante (como Polly v8). Tiempos en ms. */
  function crearBreaker(umbral, minimo, ventana, apertura) {
    let estado = 'cerrado', abiertoHasta = 0, muestras = [], desde = 0, fallas = 0, aperturas = 0;
    function podar(t) {
      while (desde < muestras.length && muestras[desde].t <= t - ventana) {
        if (muestras[desde].falla) fallas--;
        desde++;
      }
      if (desde > 1000) { muestras = muestras.slice(desde); desde = 0; }
    }
    function abrir(t) { estado = 'abierto'; abiertoHasta = t + apertura; muestras = []; desde = 0; fallas = 0; aperturas++; }
    return {
      /* Devuelve null si el pedido no pasa, 'prueba' si es la sonda de semiabierto, 'normal' si pasa. */
      pedir(t) {
        if (estado === 'cerrado') return 'normal';
        if (estado === 'abierto' && t >= abiertoHasta) { estado = 'semiabierto'; return 'prueba'; }
        return null;
      },
      anotar(t, falla, tipo) {
        if (tipo === 'prueba') {
          if (falla) abrir(t); else { estado = 'cerrado'; muestras = []; desde = 0; fallas = 0; }
          return;
        }
        if (estado !== 'cerrado') return; // respuestas de antes de abrir: ya no cuentan
        muestras.push({ t, falla });
        if (falla) fallas++;
        podar(t);
        const total = muestras.length - desde;
        if (total >= minimo && fallas / total >= umbral) abrir(t);
      },
      get estado() { return estado; },
      get aperturas() { return aperturas; },
    };
  }

  /* Espera antes del reintento n (1, 2, 3...), en ms. */
  function espera(cfg, n, r) {
    let d = cfg.backoff === 'exponencial' ? cfg.espera * Math.pow(2, n - 1) : cfg.espera;
    d = Math.min(d, cfg.esperaMax);
    return cfg.jitter ? r() * d : d; // "full jitter"
  }

  function percentil(ordenados, p) {
    if (!ordenados.length) return 0;
    const i = Math.min(ordenados.length - 1, Math.max(0, Math.ceil(p * ordenados.length) - 1));
    return ordenados[i];
  }

  function normalizar(entrada) {
    const c = Object.assign({}, BASE, entrada || {});
    const lim = (k, a, b, entero) => {
      let v = Number(c[k]);
      if (!Number.isFinite(v)) v = BASE[k];
      v = Math.min(b, Math.max(a, v));
      c[k] = entero ? Math.round(v) : v;
    };
    lim('rps', 1, 2000, true); lim('duracion', 10, 180, true); lim('capacidad', 1, 2000, true); lim('cola', 0, 5000, true);
    lim('latencia', 1, 10000); lim('dispersion', 0, 1.5); lim('fallaBase', 0, 1);
    lim('caidaDesde', 0, c.duracion); lim('caidaHasta', c.caidaDesde, c.duracion); lim('fallaCaida', 0, 1); lim('lentitudCaida', 1, 50);
    lim('reintentos', 0, 10, true); lim('espera', 0, 30000); lim('esperaMax', 0, 60000); lim('timeout', 10, 60000);
    lim('umbral', 0.05, 1); lim('minimo', 2, 1000, true); lim('ventana', 0.5, 60); lim('apertura', 0.5, 60); lim('instancias', 1, 50, true);
    lim('semilla', 0, 4294967295, true);
    if (c.backoff !== 'fijo') c.backoff = 'exponencial';
    c.jitter = !!c.jitter; c.breaker = !!c.breaker;
    return c;
  }

  function simular(entrada) {
    const cfg = normalizar(entrada);
    const rLlegadas = azar(cfg.semilla), rServicio = azar(cfg.semilla + 101), rEspera = azar(cfg.semilla + 202);
    const fin = cfg.duracion * 1000, desdeC = cfg.caidaDesde * 1000, hastaC = cfg.caidaHasta * 1000;
    const enCaida = t => t >= desdeC && t < hastaC;
    const cubos = cfg.duracion;
    const serie = Array.from({ length: cubos }, () => ({ pedidos: 0, intentos: 0, bien: 0, mal: 0, cortados: 0, tiempos: [] }));
    const cubo = t => Math.min(cubos - 1, Math.floor(t / 1000));
    const breakers = cfg.breaker
      ? Array.from({ length: cfg.instancias }, () => crearBreaker(cfg.umbral, cfg.minimo, cfg.ventana * 1000, cfg.apertura * 1000))
      : null;

    const ev = new Monticulo();
    const colaServ = [];
    let colaIni = 0, ocupados = 0;
    const tot = { pedidos: 0, bien: 0, mal: 0, cortados: 0, intentos: 0, reintentos: 0, timeouts: 0, rechazados: 0, desperdiciados: 0, pedidosCaida: 0, intentosCaida: 0 };
    const latBien = [], latTodos = [];

    // Llegadas Poisson: dependen solo de la semilla, así todas las políticas reciben el mismo tráfico.
    let t = 0, id = 0;
    for (;;) {
      t += -Math.log(1 - rLlegadas()) * 1000 / cfg.rps;
      if (t >= fin) break;
      ev.meter(t, 'llegada', { id, inicio: t, n: 0, inst: id % cfg.instancias });
      id++;
    }

    function terminar(p, ahora, bien, cortado) {
      const s = serie[cubo(p.inicio)];
      const lat = ahora - p.inicio;
      if (bien) { tot.bien++; s.bien++; latBien.push(lat); }
      else { tot.mal++; s.mal++; if (cortado) { tot.cortados++; s.cortados++; } }
      latTodos.push(lat);
      s.tiempos.push(lat);
    }

    function atender(a, ahora) {
      ocupados++;
      const caida = enCaida(ahora);
      // lognormal con media = cfg.latencia
      const z = Math.sqrt(-2 * Math.log(1 - rServicio())) * Math.cos(2 * Math.PI * rServicio());
      const s = cfg.dispersion;
      let dur = cfg.latencia * Math.exp(s * z - s * s / 2);
      if (caida) dur *= cfg.lentitudCaida;
      a.falla = rServicio() < (caida ? cfg.fallaCaida : cfg.fallaBase);
      ev.meter(ahora + dur, 'respuesta', a);
    }

    function intentar(p, ahora) {
      let tipo = 'normal';
      if (breakers) {
        tipo = breakers[p.inst].pedir(ahora);
        if (!tipo) { terminar(p, ahora, false, true); return; } // BrokenCircuitException: no se reintenta
      }
      tot.intentos++;
      if (p.n > 0) tot.reintentos++;
      if (ahora < fin) serie[cubo(ahora)].intentos++;
      if (enCaida(ahora)) tot.intentosCaida++;
      const a = { p, tipo, resuelto: false, falla: false };
      if (ocupados < cfg.capacidad) { atender(a, ahora); ev.meter(ahora + cfg.timeout, 'timeout', a); }
      else if (colaServ.length - colaIni < cfg.cola) { colaServ.push(a); ev.meter(ahora + cfg.timeout, 'timeout', a); }
      else { tot.rechazados++; resolver(a, ahora, true); } // cola llena: 503 al instante
    }

    function resolver(a, ahora, falla) {
      if (a.resuelto) return false;
      a.resuelto = true;
      const p = a.p;
      if (breakers) breakers[p.inst].anotar(ahora, falla, a.tipo);
      if (!falla) terminar(p, ahora, true, false);
      else if (p.n < cfg.reintentos) { p.n++; ev.meter(ahora + espera(cfg, p.n, rEspera), 'reintento', p); }
      else terminar(p, ahora, false, false);
      return true;
    }

    for (let e = ev.sacar(); e; e = ev.sacar()) {
      if (e.tipo === 'llegada') {
        tot.pedidos++; serie[cubo(e.t)].pedidos++;
        if (enCaida(e.t)) tot.pedidosCaida++;
        intentar(e.dato, e.t);
      } else if (e.tipo === 'reintento') {
        intentar(e.dato, e.t);
      } else if (e.tipo === 'timeout') {
        if (resolver(e.dato, e.t, true)) tot.timeouts++;
      } else {
        // El servicio termina el trabajo aunque el cliente ya se haya ido: eso es trabajo tirado.
        ocupados--;
        if (!resolver(e.dato, e.t, e.dato.falla)) tot.desperdiciados++;
        while (ocupados < cfg.capacidad && colaIni < colaServ.length) atender(colaServ[colaIni++], e.t);
        if (colaIni > 1000) { colaServ.splice(0, colaIni); colaIni = 0; }
      }
    }

    latBien.sort((x, y) => x - y);
    latTodos.sort((x, y) => x - y);
    for (const s of serie) {
      s.tiempos.sort((x, y) => x - y);
      s.p99 = percentil(s.tiempos, 0.99);
      delete s.tiempos;
    }

    // Recuperación: primer segundo posterior a la caída desde el que hay 3 segundos seguidos con 95% de éxito.
    let recuperacion = null;
    if (hastaC > desdeC) {
      const sano = s => s.pedidos === 0 || s.bien / s.pedidos >= 0.95;
      for (let i = Math.ceil(cfg.caidaHasta); i + 2 < cubos; i++) {
        if (sano(serie[i]) && sano(serie[i + 1]) && sano(serie[i + 2])) { recuperacion = i - cfg.caidaHasta; break; }
      }
    }

    return {
      cfg, serie, totales: tot,
      exito: tot.pedidos ? tot.bien / tot.pedidos : 0,
      amplificacion: tot.pedidos ? tot.intentos / tot.pedidos : 0,
      amplificacionCaida: tot.pedidosCaida ? tot.intentosCaida / tot.pedidosCaida : 0,
      pico: serie.reduce((m, s) => Math.max(m, s.intentos), 0),
      p50: percentil(latBien, 0.5), p99: percentil(latBien, 0.99), p99Todos: percentil(latTodos, 0.99),
      recuperacion,
      aperturas: breakers ? breakers.reduce((s, b) => s + b.aperturas, 0) : 0,
    };
  }

  /* La política elegida contra los tres escenarios, con el mismo tráfico. */
  function comparar(cfg) {
    const lista = [{ clave: 'tuya', nombre: 'Tu política', r: simular(cfg) }];
    for (const [clave, e] of Object.entries(ESCENARIOS)) lista.push({ clave, nombre: e.nombre, r: simular(Object.assign({}, cfg, e)) });
    return lista;
  }

  const num = (v, d = 1) => v.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

  function diagnosticar(res, sinReintentos) {
    const c = res.cfg, T = res.totales, frases = [];
    const hayCaida = c.caidaHasta > c.caidaDesde;
    const amp = hayCaida ? res.amplificacionCaida : res.amplificacion;
    let nivel = 'verde';
    const subir = n => { if (n === 'rojo' || nivel === 'verde') nivel = n; };

    if (amp >= 2) { subir('rojo'); frases.push(`Mandás ${num(amp, 2)} intentos por cada pedido ${hayCaida ? 'justo cuando el servicio está en el piso' : 'en promedio'}.`); }
    else if (amp >= 1.3) { subir('amarillo'); frases.push(`Los reintentos suman un ${num((amp - 1) * 100, 0)}% de carga ${hayCaida ? 'durante la caída' : 'extra'}.`); }
    else if (c.breaker && T.cortados > 0) frases.push(`El breaker contiene la tormenta: al servicio le llegan ${num(amp, 2)} intentos por pedido ${hayCaida ? 'durante la caída' : 'en promedio'}, a cambio de cortar ${num(T.cortados, 0)} pedidos sin intentar.`);
    else frases.push(`La carga extra es baja: ${num(amp, 2)} intentos por pedido ${hayCaida ? 'durante la caída' : 'en promedio'}.`);

    if (hayCaida && res.recuperacion === null) { subir('rojo'); frases.push('El servicio no se recupera antes de que termine la simulación, aunque el incidente ya pasó.'); }
    else if (hayCaida && res.recuperacion >= 5) { subir('amarillo'); frases.push(`Después del incidente tardás ${num(res.recuperacion, 0)} s en volver al 95% de éxito.`); }

    if (T.intentos && T.desperdiciados / T.intentos >= 0.05) { subir('amarillo'); frases.push(`El ${num(T.desperdiciados / T.intentos * 100, 0)}% de los intentos se procesa después de que ya cortaste por timeout: trabajo tirado.`); }
    if (c.timeout < c.latencia * 2) { subir('amarillo'); frases.push(`El timeout (${num(c.timeout, 0)} ms) está muy cerca de la latencia normal (${num(c.latencia, 0)} ms).`); }
    if (c.reintentos > 0 && !c.jitter) { subir('amarillo'); frases.push('Sin jitter, los que fallaron juntos vuelven juntos.'); }
    if (c.rps * c.latencia / 1000 > c.capacidad * 0.85) { subir('amarillo'); frases.push('El servicio ya está al límite sin ningún incidente: subí la capacidad o bajá el tráfico.'); }

    if (sinReintentos && c.reintentos > 0) {
      const d = (res.exito - sinReintentos.exito) * 100;
      if (d >= 0.5) frases.push(`Contra no reintentar, salvás ${num(d)} puntos de pedidos.`);
      else if (d <= -0.5) { subir('amarillo'); frases.push(`Contra no reintentar, perdés ${num(-d)} puntos de pedidos.`); }
      else frases.push('Contra no reintentar, el porcentaje de éxito casi no cambia.');
    }
    return { nivel, frases };
  }

  function csharp(entrada) {
    const c = normalizar(entrada), l = [];
    const ms = v => `TimeSpan.FromMilliseconds(${Math.round(v)})`;
    l.push('// Paquete NuGet: Microsoft.Extensions.Http.Resilience');
    l.push('// El orden importa: reintentos afuera, después el breaker y adentro el timeout por intento.');
    l.push('services.AddHttpClient("servicio")');
    l.push('    .AddResilienceHandler("politica", pipeline =>');
    l.push('    {');
    if (c.reintentos > 0) {
      l.push('        pipeline.AddRetry(new HttpRetryStrategyOptions', '        {');
      l.push(`            MaxRetryAttempts = ${c.reintentos},`);
      l.push(`            BackoffType = DelayBackoffType.${c.backoff === 'exponencial' ? 'Exponential' : 'Constant'},`);
      l.push(`            Delay = ${ms(c.espera)},`);
      l.push(`            MaxDelay = ${ms(c.esperaMax)},`);
      l.push(`            UseJitter = ${c.jitter},`);
      l.push('        });');
    }
    if (c.breaker) {
      l.push('        pipeline.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions', '        {');
      l.push(`            FailureRatio = ${Number(c.umbral.toFixed(2))},`);
      l.push(`            MinimumThroughput = ${c.minimo},`);
      l.push(`            SamplingDuration = ${ms(c.ventana * 1000)},`);
      l.push(`            BreakDuration = ${ms(c.apertura * 1000)},`);
      l.push('        });');
    }
    l.push(`        pipeline.AddTimeout(${ms(c.timeout)});`);
    l.push('    });');
    return l.join('\n');
  }

  const api = { BASE, ESCENARIOS, azar, Monticulo, crearBreaker, espera, percentil, normalizar, simular, comparar, diagnosticar, csharp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Reintentos = api;
})(typeof window !== 'undefined' ? window : this);
