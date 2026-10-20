/* El caché en vivo — tráfico Zipf, políticas de reemplazo (LRU, LFU, FIFO, aleatorio, LRU muestreado como Redis, compactación
   como MemoryCache de .NET, óptimo de Belady), TTL, la aproximación de Che para LRU y la estampida cuando vence una clave caliente.
   Sin dependencias; se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  // ---------- azar reproducible ----------
  function rng(semilla) {
    let a = (semilla >>> 0) || 1;
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function poisson(lambda, r) { // Knuth para lambda chico; normal aproximada para grande
    if (lambda > 50) { const u = r(), v = r(); return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(u + 1e-12)) * Math.cos(2 * Math.PI * v))); }
    const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= r(); } while (p > L); return k - 1;
  }

  // ---------- popularidad ----------
  /** Probabilidades Zipf: p_i ∝ 1/i^alfa, i = 1..N (alfa 0 = uniforme). */
  function zipf(N, alfa) {
    const p = new Float64Array(N); let s = 0;
    for (let i = 0; i < N; i++) { p[i] = 1 / Math.pow(i + 1, alfa); s += p[i]; }
    for (let i = 0; i < N; i++) p[i] /= s;
    return p;
  }
  function acumulada(p) { const c = new Float64Array(p.length); let s = 0; for (let i = 0; i < p.length; i++) { s += p[i]; c[i] = s; } c[p.length - 1] = 1; return c; }
  function muestrear(c, u) { let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; } return lo; }

  /** Traza de pedidos. opts: { N, alfa, M, novedades (fracción de claves de una sola vez), rotacion (cada cuántos pedidos la popularidad se corre un escalón), semilla } */
  function generarTraza(opts) {
    const o = Object.assign({ N: 100000, alfa: 0.9, M: 100000, novedades: 0, rotacion: 0, semilla: 1 }, opts);
    const r = rng(o.semilla); const c = acumulada(zipf(o.N, o.alfa));
    const t = new Int32Array(o.M); let siguienteNueva = o.N; let corrimiento = 0;
    for (let i = 0; i < o.M; i++) {
      if (o.rotacion > 0 && i > 0 && i % o.rotacion === 0) corrimiento += Math.max(1, Math.round(o.N * 0.01)); // cada escalón corre lo caliente un 1 % del catálogo
      if (o.novedades > 0 && r() < o.novedades) { t[i] = siguienteNueva++; continue; }
      const rango = muestrear(c, r());
      t[i] = o.rotacion > 0 ? (rango + corrimiento) % o.N : rango;
    }
    return { traza: t, opciones: o, claves: siguienteNueva };
  }

  // ---------- políticas ----------
  const POLITICAS = {
    lru: "LRU", lfu: "LFU", fifo: "FIFO", aleatorio: "Aleatorio", redis: "LRU muestreado (Redis)", memorycache: "MemoryCache de .NET (compacta 5 %)", belady: "Óptimo (Belady)",
  };
  function nextUse(traza) {
    const n = traza.length; const nu = new Int32Array(n); const ultimo = new Map();
    for (let i = n - 1; i >= 0; i--) { const k = traza[i]; nu[i] = ultimo.has(k) ? ultimo.get(k) : 0x7fffffff; ultimo.set(k, i); }
    return nu;
  }
  // Montículo máximo sencillo de pares [prioridad, clave] para Belady.
  class Heap { constructor() { this.a = []; } get size() { return this.a.length; } push(p, k) { const a = this.a; a.push([p, k]); let i = a.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (a[j][0] >= a[i][0]) break; [a[i], a[j]] = [a[j], a[i]]; i = j; } } pop() { const a = this.a; const top = a[0]; const last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] > a[m][0]) m = l; if (r < a.length && a[r][0] > a[m][0]) m = r; if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m; } } return top; } }

  /** Simula una política. opts: { C (entradas), politica, ttl (en pedidos; 0 = sin TTL), ventanas (cuántos puntos de la serie), semilla, muestras (Redis) } */
  function simular(traza, opts) {
    const o = Object.assign({ C: 1000, politica: "lru", ttl: 0, ventanas: 50, semilla: 7, muestras: 5, expiracion: "absoluta" }, opts);
    const deslizante = o.expiracion === "deslizante";
    const n = traza.length; const C = Math.max(1, Math.floor(o.C)); const ttl = o.ttl > 0 ? o.ttl : Infinity; const r = rng(o.semilla);
    let hits = 0, expirados = 0, evicciones = 0;
    const serie = []; const porVentana = Math.max(1, Math.floor(n / o.ventanas)); let hitsVentana = 0;
    const cache = new Map(); // clave → { exp, ...según política }
    const pol = o.politica;
    // Estructuras extra
    let arr = null, pos = null, ultimoAcceso = null; // aleatorio / redis
    let freq = null, buckets = null, minFreq = 1; // lfu
    let heap = null, nu = null; // belady
    if (pol === "aleatorio" || pol === "redis") { arr = []; pos = new Map(); ultimoAcceso = new Map(); }
    if (pol === "lfu") { freq = new Map(); buckets = new Map(); }
    if (pol === "belady") { heap = new Heap(); nu = nextUse(traza); }
    const quitar = (k) => {
      cache.delete(k); evicciones++;
      if (arr) { const i = pos.get(k); const u = arr[arr.length - 1]; arr[i] = u; pos.set(u, i); arr.pop(); pos.delete(k); ultimoAcceso.delete(k); }
      if (freq) { const f = freq.get(k); buckets.get(f).delete(k); if (!buckets.get(f).size) buckets.delete(f); freq.delete(k); }
    };
    const evictarUno = (i) => {
      if (pol === "lru" || pol === "fifo") { quitar(cache.keys().next().value); return; }
      if (pol === "aleatorio") { quitar(arr[Math.floor(r() * arr.length)]); return; }
      if (pol === "redis") { let peor = null, peorT = Infinity; for (let s = 0; s < o.muestras; s++) { const k = arr[Math.floor(r() * arr.length)]; const t = ultimoAcceso.get(k); if (t < peorT) { peorT = t; peor = k; } } quitar(peor); return; }
      if (pol === "lfu") { while (!buckets.has(minFreq)) minFreq++; quitar(buckets.get(minFreq).keys().next().value); return; }
      if (pol === "belady") { for (;;) { const [p, k] = heap.pop(); const e = cache.get(k); if (e && e.nu === p) { quitar(k); return; } } }
    };
    const cadaCuanto = ttl === Infinity ? 0 : Math.max(500, Math.floor(ttl / 4)); // expiración activa, como el escaneo de MemoryCache o el ciclo de Redis
    for (let i = 0; i < n; i++) {
      if (cadaCuanto && i % cadaCuanto === 0 && i) { for (const [k, e] of cache) if (i >= e.exp) { expirados++; quitar(k); evicciones--; } }
      const k = traza[i]; const e = cache.get(k);
      if (e !== undefined && i < e.exp) {
        hits++; hitsVentana++;
        if (deslizante) e.exp = i + ttl;
        if (pol === "lru") { cache.delete(k); cache.set(k, e); }
        else if (pol === "redis" || pol === "aleatorio") ultimoAcceso.set(k, i);
        else if (pol === "lfu") { const f = freq.get(k); buckets.get(f).delete(k); if (!buckets.get(f).size) { buckets.delete(f); if (minFreq === f) minFreq = f + 1; } freq.set(k, f + 1); if (!buckets.has(f + 1)) buckets.set(f + 1, new Set()); buckets.get(f + 1).add(k); }
        else if (pol === "belady") { e.nu = nu[i]; heap.push(nu[i], k); }
      } else {
        if (e !== undefined) { expirados++; quitar(k); evicciones--; }
        // Miss: traer y guardar.
        if (cache.size >= C) {
          if (pol === "memorycache") { // compacta el 5 % de golpe, los menos usados (orden LRU del Map)
            const cuantos = Math.max(1, Math.round(C * 0.05)); const it = cache.keys(); for (let j = 0; j < cuantos; j++) quitar(it.next().value);
          } else evictarUno(i);
        }
        const nuevo = { exp: i + ttl };
        if (pol === "belady") { nuevo.nu = nu[i]; heap.push(nu[i], k); }
        cache.set(k, nuevo);
        if (arr) { pos.set(k, arr.length); arr.push(k); ultimoAcceso.set(k, i); }
        if (freq) { freq.set(k, 1); if (!buckets.has(1)) buckets.set(1, new Set()); buckets.get(1).add(k); minFreq = 1; }
      }
      if ((i + 1) % porVentana === 0) { serie.push(hitsVentana / porVentana); hitsVentana = 0; }
    }
    return { hits, misses: n - hits, hitRate: hits / n, expirados, evicciones, serie, C, politica: pol, ttl: o.ttl, expiracion: o.expiracion };
  }

  // ---------- aproximación de Che (LRU bajo IRM) ----------
  /** h de LRU con C entradas para probabilidades p (Zipf), fracción de novedades q y TTL (en pedidos; 0 = sin TTL).
      Con TTL deslizante (se renueva al acceder) la entrada vive min(T, ttl) desde el último acceso: Che con ese tiempo.
      Con TTL absoluto (no se renueva) una clave con tasa p vive ttl y recibe p·ttl aciertos por cada miss: h_i = p·ttl / (1 + p·ttl), exacto si el caché no se llena.
      Devuelve { h, T, lleno }. */
  function che(p, C, q, ttl, expiracion) {
    const tau = ttl > 0 ? ttl : Infinity; const esc = 1 - (q || 0); const absoluta = expiracion !== "deslizante" && tau !== Infinity;
    const termino = (pi, T) => { // probabilidad de que la clave esté en el caché (ocupación) y de acierto, con el tiempo característico T
      if (absoluta) { const x = pi * tau; return Math.min(x / (1 + x), 1 - Math.exp(-pi * T)); } // vive hasta lo primero: el TTL o el olvido de LRU
      return 1 - Math.exp(-pi * Math.min(T, tau));
    };
    const ocup = (T) => { let s = 0; for (let i = 0; i < p.length; i++) s += termino(esc * p[i], T); return s + (q || 0) * Math.min(T, tau); };
    const hit = (T) => { let s = 0; for (let i = 0; i < p.length; i++) s += p[i] * termino(esc * p[i], T); return esc * s; };
    const Tmax = tau === Infinity ? 1e12 : tau * 1.0000001;
    if (ocup(Tmax) <= C) return { h: hit(Tmax), T: tau, lleno: false };
    let lo = 0, hi = 1; while (ocup(hi) < C) hi *= 2;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (ocup(m) < C) lo = m; else hi = m; }
    return { h: hit(hi), T: hi, lleno: true };
  }
  /** Cuántas entradas hacen falta para un hit rate objetivo (sin TTL, con Che): se busca el T que da ese h y se lee la ocupación. */
  function entradasPara(p, hObjetivo, q) {
    const esc = 1 - (q || 0);
    const hit = (T) => { let s = 0; for (let i = 0; i < p.length; i++) s += p[i] * (1 - Math.exp(-esc * p[i] * T)); return esc * s; };
    const ocup = (T) => { let s = 0; for (let i = 0; i < p.length; i++) s += 1 - Math.exp(-esc * p[i] * T); return s + (q || 0) * T; };
    if (hit(1e9) <= hObjetivo) return null;
    let lo = 0, hi = 1; while (hit(hi) < hObjetivo) hi *= 2;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (hit(m) < hObjetivo) lo = m; else hi = m; }
    return Math.ceil(ocup(hi));
  }

  // ---------- estampida ----------
  /** Clave(s) caliente(s) que vencen juntas. opts: { claves K, rps por clave, ttlSeg, latenciaMs del backend, proteccion: "ninguna"|"singleflight"|"temprano"|"jitter", segundos, semilla } */
  function estampida(opts) {
    const o = Object.assign({ claves: 20, rps: 200, ttlSeg: 10, latenciaMs: 80, proteccion: "ninguna", segundos: 30, semilla: 3 }, opts);
    const r = rng(o.semilla); const pasos = o.segundos * 1000; const porPaso = o.rps / 1000;
    const claves = []; for (let k = 0; k < o.claves; k++) claves.push({ exp: o.ttlSeg * 1000 * (o.proteccion === "jitter" ? 0.8 + 0.4 * r() : 1), enVuelo: null, refrescando: false });
    const backend = new Float64Array(Math.ceil(pasos / 100)); // llamadas al backend por cada 100 ms
    let enVuelo = 0, maxEnVuelo = 0, llamadas = 0, pedidos = 0, hits = 0, esperaTotal = 0; const esperas = []; const concurrencia = new Float64Array(Math.ceil(pasos / 100));
    const vuelos = []; // { fin, clave, cuantos }
    for (let t = 0; t < pasos; t++) {
      // terminan vuelos
      for (let i = vuelos.length - 1; i >= 0; i--) { if (vuelos[i].fin <= t) { const v = vuelos[i]; const c = claves[v.clave]; c.exp = t + o.ttlSeg * 1000 * (o.proteccion === "jitter" ? 0.8 + 0.4 * r() : 1); c.enVuelo = null; c.refrescando = false; enVuelo--; vuelos.splice(i, 1); } }
      for (let k = 0; k < o.claves; k++) {
        const c = claves[k]; const n = poisson(porPaso, r); if (!n) continue; pedidos += n;
        const vigente = t < c.exp;
        if (vigente) {
          hits += n;
          if (o.proteccion === "temprano" && !c.refrescando && c.exp - t < o.ttlSeg * 1000 * 0.2) { c.refrescando = true; c.enVuelo = { fin: t + o.latenciaMs, clave: k }; vuelos.push(c.enVuelo); enVuelo++; llamadas++; backend[Math.floor(t / 100)]++; }
          continue;
        }
        // miss
        if (o.proteccion === "singleflight" || o.proteccion === "temprano") {
          if (!c.enVuelo) { c.enVuelo = { fin: t + o.latenciaMs, clave: k }; vuelos.push(c.enVuelo); enVuelo++; llamadas++; backend[Math.floor(t / 100)]++; }
          const espera = c.enVuelo.fin - t; esperaTotal += espera * n; for (let j = 0; j < n; j++) esperas.push(espera);
        } else {
          for (let j = 0; j < n; j++) { vuelos.push({ fin: t + o.latenciaMs, clave: k }); llamadas++; esperas.push(o.latenciaMs); }
          enVuelo += n; esperaTotal += o.latenciaMs * n; backend[Math.floor(t / 100)] += n;
          if (!c.enVuelo) c.enVuelo = vuelos[vuelos.length - 1];
        }
      }
      if (enVuelo > maxEnVuelo) maxEnVuelo = enVuelo;
      const idx = Math.floor(t / 100); if (enVuelo > concurrencia[idx]) concurrencia[idx] = enVuelo;
    }
    esperas.sort((a, b) => a - b);
    const p = (q) => (esperas.length ? esperas[Math.min(esperas.length - 1, Math.floor(q * esperas.length))] : 0);
    return { backend: Array.from(backend), concurrencia: Array.from(concurrencia), llamadas, pedidos, hits, hitRate: pedidos ? hits / pedidos : 0, maxEnVuelo, esperaMedia: pedidos ? esperaTotal / pedidos : 0, p99Miss: p(0.99), misses: esperas.length, llamadasPorSegundo: llamadas / o.segundos, opciones: o };
  }

  // ---------- diagnóstico ----------
  function diagnostico(ctx) {
    const { resultados, cheLru, p, o, rps, latHit, latMiss } = ctx; const out = [];
    const pc = (x) => (x * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const mejor = Object.keys(resultados).filter((k) => k !== "belady").sort((a, b) => resultados[b].hitRate - resultados[a].hitRate)[0];
    const lru = resultados.lru; const h = lru.hitRate;
    const backendQps = rps * (1 - h);
    const lat = (hr) => ({ media: hr * latHit + (1 - hr) * latMiss, p99: hr >= 0.99 ? latHit : latMiss });
    out.push({ titulo: `LRU acierta el ${pc(h)} % con ${o.C.toLocaleString("es-AR")} entradas sobre ${o.N.toLocaleString("es-AR")} claves`, texto: `El backend recibe ${backendQps.toFixed(0)} de los ${rps} pedidos por segundo. Latencia media ${lat(h).media.toFixed(1)} ms; el p99 ${h >= 0.99 ? "es el del caché" : "es el del backend (" + latMiss + " ms): con menos de 99 % de aciertos, uno de cada cien pedidos paga el miss entero"}.` });
    if (cheLru) out.push({ titulo: `La fórmula (Che) dice ${pc(cheLru.h)} %`, texto: Math.abs(cheLru.h - h) < 0.03 ? "La simulación y la aproximación coinciden: el tráfico es estacionario y LRU se comporta como dice la teoría." : "Difieren: la popularidad rota o hay muchas claves de una sola vez; la fórmula supone pedidos independientes con popularidad fija." });
    const para = o.para || { h90: entradasPara(p, 0.9, o.novedades), h95: entradasPara(p, 0.95, o.novedades), h99: entradasPara(p, 0.99, o.novedades) };
    const para90 = para.h90, para95 = para.h95, para99 = para.h99;
    out.push({ titulo: "Cuánto caché hace falta", texto: `Para el 90 % de aciertos, ${para90 ? para90.toLocaleString("es-AR") + " entradas" : "no alcanza ni con todo"}; para el 95 %, ${para95 ? para95.toLocaleString("es-AR") : "no alcanza"}; para el 99 %, ${para99 ? para99.toLocaleString("es-AR") : "no alcanza (las claves de una sola vez nunca aciertan)"}. ${o.alfa >= 0.8 ? "Con popularidad tan concentrada, el primer 5 % del catálogo se lleva la mayor parte del tráfico: el caché chico rinde mucho y el grande poco más." : "Con popularidad pareja, cada entrada de más suma lo mismo: para subir el hit rate hay que agrandar en proporción al catálogo."}` });
    if (o.novedades > 0) out.push({ titulo: `${Math.round(o.novedades * 100)} % de claves que se piden una sola vez`, texto: `Un scan, un bot o un reporte que recorre todo meten claves que nadie va a volver a pedir y le sacan lugar a las calientes. LRU las aguanta ${lru.ttl ? "un rato" : "hasta que caen por el fondo"}; LFU (${pc(resultados.lfu.hitRate)} %) las ignora porque nunca pasan de un uso. En .NET: no cachees las respuestas de un scan (mirá el User-Agent o el patrón) o usá un caché admisión-por-frecuencia como el de BitFaster.Caching (W-TinyLFU).` });
    if (o.rotacion > 0) out.push({ titulo: "La popularidad rota", texto: `Cada ${o.rotacion.toLocaleString("es-AR")} pedidos cambia qué es lo caliente (trending, ofertas del día). LFU se queda enamorado de lo que fue popular (${pc(resultados.lfu.hitRate)} %); LRU se adapta solo. Si rota de verdad, LRU o un LFU con decaimiento (Redis LFU tiene lfu-decay-time).` });
    if (lru.ttl > 0) out.push({ titulo: `TTL de ${Math.round(lru.ttl / rps)} s`, texto: `${lru.expirados.toLocaleString("es-AR")} aciertos se perdieron porque la entrada había vencido. El TTL no sirve para que el caché entre en memoria (eso lo hace el tamaño); sirve para acotar cuánto tiempo se ve un dato viejo. Si el dato cambia poco, TTL largo y invalidar al escribir.` });
    out.push({ titulo: `La mejor política acá: ${POLITICAS[mejor]} (${pc(resultados[mejor].hitRate)} %); el óptimo imposible, ${pc(resultados.belady.hitRate)} %`, texto: `Belady sabe el futuro: es el techo. ${resultados.belady.hitRate - resultados[mejor].hitRate < 0.03 ? "LRU está a menos de 3 puntos del techo: no hay mucho que ganar cambiando de política, sí agrandando el caché." : "Hay " + ((resultados.belady.hitRate - resultados[mejor].hitRate) * 100).toFixed(0) + " puntos entre lo mejor que tenés y el techo: la política importa en este tráfico."} MemoryCache de .NET con SizeLimit compacta de a 5 % y pierde un poco frente a LRU puro; Redis muestrea 5 claves y queda casi igual que LRU exacto.` });
    return out;
  }

  // ---------- todo junto (lo que corre el worker) ----------
  /** pedido: { N, alfa, M, novedades, rotacion, semilla, C, ttl (pedidos), politicas: [..], curva: { tamanios: [..], politicas: [..], M } } */
  function correrTodo(pedido) {
    const o = pedido; const { traza } = generarTraza(o); const p = zipf(o.N, o.alfa);
    const resultados = {};
    for (const pol of o.politicas || Object.keys(POLITICAS)) resultados[pol] = simular(traza, { C: o.C, politica: pol, ttl: o.ttl, semilla: o.semilla, expiracion: o.expiracion });
    const cheLru = che(p, o.C, o.novedades, o.ttl, o.expiracion);
    const curva = { tamanios: [], series: {}, che: [] };
    if (o.curva) {
      const sub = o.curva.M && o.curva.M < traza.length ? traza.subarray(0, o.curva.M) : traza;
      curva.tamanios = o.curva.tamanios;
      for (const pol of o.curva.politicas) curva.series[pol] = o.curva.tamanios.map((C) => simular(sub, { C, politica: pol, ttl: o.ttl, semilla: o.semilla, ventanas: 1, expiracion: o.expiracion }).hitRate);
      curva.che = o.curva.tamanios.map((C) => che(p, C, o.novedades, o.ttl, o.expiracion).h);
    }
    return { resultados, cheLru, curva, para: { h90: entradasPara(p, 0.9, o.novedades), h95: entradasPara(p, 0.95, o.novedades), h99: entradasPara(p, 0.99, o.novedades) } };
  }

  const api = { correrTodo, rng, poisson, zipf, acumulada, muestrear, generarTraza, simular, che, entradasPara, estampida, diagnostico, POLITICAS, nextUse };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.CacheVivo = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
