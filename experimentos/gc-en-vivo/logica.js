/* El GC en vivo — modelo del recolector generacional de .NET, con reloj de 1 ms.
   No es el GC de verdad: es un modelo con tres generaciones, presupuestos, promoción por supervivencia,
   LOH, GC de fondo y heaps por núcleo, calibrado contra las mediciones de real/. Se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  /** Constantes de costo (ms) calibradas contra un .NET 8 real en 4 vCPU; ver real/README.md. */
  const K = {
    pausaFija: 0.45,          // ms de un gen0 sin sobrevivientes en workstation (frenar, barrer, arrancar)
    pausaFijaServer: 1.6,     // en server hay que coordinar un hilo de GC por heap
    pausaFijaDatas: 0.22,     // con DATAS el gen0 es chiquito y la pausa también
    planPorMB: 0.12,          // ms por MB de gen0/gen1 que hay que recorrer entero cuando algo sobrevive (unos 120 ns por objeto de 1 KB)
    escalaVivo: 4,            // con menos de unos pocos MB vivos el costo de planear casi no aparece
    gen1Recorrido: 0.3,       // de gen1 se recorre solo una parte (lo que no murió ya está planeado)
    copiarPorMB: 0.06,        // ms por MB que sobrevive y hay que promover (el GC real barre en vez de copiar cuando sobrevive mucho)
    porGen2MB: 0.035,         // cada gen1 que promueve a gen2 paga por el tamaño de gen2 (medido: con 1 o 2 GB en gen2, uno de cada dos gen1 pasa de 17 a 130 ms)
    marcarPorMB: 0.1,         // ms por MB vivo en un gen2 bloqueante (objetos de 1 KB: unos 100 ns por objeto)
    marcarFondoPorMB: 0.25,   // ms de trabajo de fondo por MB vivo (en un hilo, concurrente)
    pausaFondoInicio: 2.5,    // la primera pausa de un GC de fondo es un GC efímero más este múltiplo del costo de recorrer gen0
    pausaFondoFin: 1.0,       // ms de la segunda pausa
    pausaFondoPorMB: 0.01,    // y algo que crece con el heap vivo
    gen0EnFondo: 1.3,         // los GC efímeros mientras hay un GC de fondo cuestan más
    finalizarPorObj: 0.00055, // ms por objeto con finalizador que hay que anotar (medido: 86.000 objetos, +45 ms)
    paraleloEficiencia: 0.55, // cuánto del trabajo variable se reparte entre hilos del GC en server
    datasBase: 2.5, datasFactor: 0.8, // DATAS: el gen0 arranca chico y crece con lo que sobrevive
  };

  const PRESUPUESTOS = {
    workstation: { gen0MB: 86, gen1MB: 10, gen2Pct: 40, gen2MinMB: 24, lohMB: 3 },
    server: { gen0MB: 250, gen1MB: 24, gen2Pct: 40, gen2MinMB: 48, lohMB: 12 },
    datas: { gen0MB: 2.5, gen1MB: 50, gen2Pct: 40, gen2MinMB: 24, lohMB: 3 },
  };

  const defaults = {
    nucleos: 4, modo: "workstation", concurrente: true, duracionS: 20,
    ritmoMBs: 200, objKB: 1, vidaMediaPct: 0, vidaMediaMs: 500, cacheMB: 0, crecerMBs: 0,
    finalizadores: false, pool: false, presupuestoGen0MB: 0 /* 0 = el de la tabla */,
    pedidosPorS: 200, servicioMs: 5,
  };

  function percentil(arr, p) { if (!arr.length) return 0; const l = arr.slice().sort((a, b) => a - b); return l[Math.min(l.length - 1, Math.floor(p * l.length))]; }

  /**
   * Corre la simulación. Devuelve eventos (cada pausa), muestras del heap, contadores y la latencia de los pedidos.
   */
  function simular(opts) {
    const o = Object.assign({}, defaults, opts);
    const server = o.modo === "server", datas = o.modo === "datas";
    const heaps = server ? Math.max(1, o.nucleos) : 1;
    const P = PRESUPUESTOS[server ? "server" : datas ? "datas" : "workstation"];
    const fija = server ? K.pausaFijaServer : datas ? K.pausaFijaDatas : K.pausaFija;
    const presupuestoGen0 = o.presupuestoGen0MB > 0 ? o.presupuestoGen0MB : P.gen0MB; // por heap
    let B0 = presupuestoGen0 * heaps; const B1 = P.gen1MB * heaps, lohB = P.lohMB * heaps;
    const esLoh = o.objKB >= 85;
    const ritmo = o.pool && esLoh ? 0 : o.ritmoMBs; // con ArrayPool el LOH no se toca
    const porMs = ritmo / 1000; // MB por ms
    const pm = Math.min(1, Math.max(0, o.vidaMediaPct / 100));
    const paralelo = server ? 1 / (1 + (o.nucleos - 1) * K.paraleloEficiencia) : 1;
    const objetosPorMB = 1024 / Math.max(0.05, o.objKB);

    // estado
    let t = 0; const fin = o.duracionS * 1000;
    let gen0 = []; let gen0Bytes = 0;          // cohortes {muere, mb} de vida media; lo de vida corta muere al toque
    let gen1 = []; let gen1Alloc = 0;          // cohortes promovidas; gen1Alloc: promovido desde la última gen1 (lo que ocupa gen1)
    let gen2 = []; let gen2Fijo = o.cacheMB;   // cohortes de vida media en gen2 + lo fijo (caché y lo que crece)
    let gen2Alloc = 0;                          // promovido a gen2 + crecimiento desde el último gen2
    let lohVivo = 0, lohMuerto = 0, lohAlloc = 0;
    let fondo = null;                           // GC de fondo en curso {restante (ms de trabajo), ...}
    let ultimoGen2Vivo = o.cacheMB;
    const eventos = [], muestras = [];
    const n = { gen0: 0, gen1: 0, gen2: 0, gen2Fondo: 0 };
    let pausaTotal = 0, trabajoFondo = 0, pausaMax = 0;
    const pedidos = []; // latencias

    const vivo = (arr, now) => { let s = 0; for (const c of arr) if (c.muere > now) s += c.mb; return s; };
    const purgar = (arr, now) => arr.filter((c) => c.muere > now);

    function pausa(gen, tipo, ms) {
      ms = Math.max(0.05, ms);
      eventos.push({ t, gen, tipo, ms });
      pausaTotal += ms; if (ms > pausaMax) pausaMax = ms;
      t += ms; // mientras dura la pausa no pasa nada más
    }
    function costoEfimero(sobrevive, objetosFinalizables, sobreviveGen0, recorridoMB, promueveAGen2) {
      const conVivos = 1 - Math.exp(-sobrevive / K.escalaVivo);
      const variable = K.planPorMB * recorridoMB * conVivos + K.copiarPorMB * sobrevive + (promueveAGen2 ? K.porGen2MB * (gen2Fijo + vivo(gen2, t)) * conVivos : 0) + K.finalizarPorObj * objetosFinalizables;
      if (datas && o.presupuestoGen0MB <= 0) B0 = Math.min(PRESUPUESTOS.workstation.gen0MB, K.datasBase + K.datasFactor * (sobreviveGen0 == null ? sobrevive : sobreviveGen0));
      return (fija + variable * paralelo) * (fondo ? K.gen0EnFondo : 1);
    }
    function gcGen0() {
      n.gen0++;
      const sobrevive = vivo(gen0, t);
      pausa(0, fondo ? 2 : 0, costoEfimero(sobrevive, o.finalizadores ? gen0Bytes * objetosPorMB : 0, sobrevive, gen0Bytes, false));
      // los que sobreviven pasan a gen1; con finalizadores, lo de vida corta sobrevive una vez más (queda en gen1 hasta la próxima)
      gen1.push(...purgar(gen0, t));
      if (o.finalizadores) gen1.push({ muere: t + 1, mb: gen0Bytes * 0.5 });
      gen1Alloc += sobrevive + (o.finalizadores ? gen0Bytes * 0.5 : 0);
      gen0 = []; gen0Bytes = 0;
    }
    function gcGen1() {
      n.gen1++;
      const s0 = vivo(gen0, t), s1 = vivo(gen1, t);
      pausa(1, fondo ? 2 : 0, costoEfimero(s0 + s1, o.finalizadores ? gen0Bytes * objetosPorMB : 0, s0, gen0Bytes + K.gen1Recorrido * gen1Alloc, s1 > 0));
      gen2.push(...purgar(gen1, t)); gen2Alloc += s1;
      gen1 = purgar(gen0, t); gen1Alloc = s0; gen0 = []; gen0Bytes = 0;
    }
    function vivoTotal() { return gen2Fijo + vivo(gen2, t) + vivo(gen1, t) + vivo(gen0, t) + lohVivo; }
    function gcGen2Bloqueante() {
      n.gen2++;
      const total = vivoTotal();
      pausa(2, 0, fija + (K.marcarPorMB * total + K.planPorMB * (gen0Bytes + K.gen1Recorrido * gen1Alloc)) * paralelo);
      terminarGen2();
    }
    function terminarGen2() {
      gen2.push(...purgar(gen1, t), ...purgar(gen0, t));
      gen2 = purgar(gen2, t); gen1 = []; gen0 = []; gen0Bytes = 0; gen1Alloc = 0;
      lohMuerto = 0; lohAlloc = 0; gen2Alloc = 0;
      ultimoGen2Vivo = gen2Fijo + vivo(gen2, t);
    }
    function empezarFondo() {
      n.gen2++; n.gen2Fondo++;
      const total = vivoTotal();
      const s0 = vivo(gen0, t), s1 = vivo(gen1, t), conVivos = 1 - Math.exp(-(s0 + s1) / K.escalaVivo);
      pausa(2, 1, costoEfimero(s0 + s1, 0, s0, gen0Bytes + K.gen1Recorrido * gen1Alloc, false) + (K.pausaFondoInicio * K.planPorMB * gen0Bytes * conVivos + K.pausaFondoPorMB * total) * paralelo);
      fondo = { restante: K.marcarFondoPorMB * total * paralelo, total };
      // la primera pausa trae adentro un gen1: lo vivo de gen0 y gen1 se promueve; lo que entre a gen2 mientras marca queda para el próximo
      gen2.push(...purgar(gen1, t)); gen1 = purgar(gen0, t); gen1Alloc = s0; gen0 = []; gen0Bytes = 0;
    }
    function presupuestoGen2() { return Math.max(P.gen2MinMB * heaps, ultimoGen2Vivo * P.gen2Pct / 100); }

    let proximaMuestra = 0, proximoPedido = 0;
    const paso = 1; // ms
    while (t < fin) {
      // asignar 1 ms
      if (porMs > 0) {
        if (esLoh) { lohAlloc += porMs; lohVivo += porMs * pm; lohMuerto += porMs * (1 - pm); if (pm > 0) gen2.push({ muere: t + o.vidaMediaMs, mb: 0 }); }
        else { gen0Bytes += porMs; if (pm > 0) gen0.push({ muere: t + o.vidaMediaMs, mb: porMs * pm }); }
      }
      if (o.crecerMBs > 0) { gen0Bytes += o.crecerMBs / 1000; gen0.push({ muere: Infinity, mb: o.crecerMBs / 1000 }); }
      // trabajo de fondo
      if (fondo) { fondo.restante -= paso; if (fondo.restante <= 0) { pausa(2, 1, fija + K.pausaFondoFin + K.pausaFondoPorMB * fondo.total * 0.2); trabajoFondo += K.marcarFondoPorMB * fondo.total * paralelo; fondo = null; terminarGen2(); } }
      // ¿toca un GC?
      // el LOH lleno dispara un gen2 ahí mismo (bloqueante, como se midió); si no, al llenarse gen0 se decide
      // qué generación toca: gen2 si lo que entró a gen2 pasó su presupuesto, gen1 si lo promovido pasó el suyo, gen0 si no
      if (lohAlloc >= lohB && !fondo) gcGen2Bloqueante();
      else if (gen0Bytes >= B0) {
        if (gen2Alloc >= presupuestoGen2() && !fondo) { if (o.concurrente) empezarFondo(); else gcGen2Bloqueante(); }
        else if (gen1Alloc >= B1) gcGen1(); else gcGen0();
      }
      // pedidos
      while (proximoPedido <= t && o.pedidosPorS > 0) { pedidos.push(proximoPedido); proximoPedido += 1000 / o.pedidosPorS; }
      if (t >= proximaMuestra) {
        muestras.push({ t, gen0: gen0Bytes, gen1: vivo(gen1, t) + gen1Alloc * 0, gen2: gen2Fijo + vivo(gen2, t), loh: lohVivo + lohMuerto, fondo: !!fondo });
        proximaMuestra += 100;
      }
      t += paso;
    }
    // latencia de los pedidos: servicio + las pausas que les caen encima
    const lat = [];
    let i = 0; eventos.sort((a, b) => a.t - b.t);
    for (const inicio of pedidos) {
      let finP = inicio + o.servicioMs;
      while (i < eventos.length && eventos[i].t + eventos[i].ms < inicio) i++;
      for (let j = i; j < eventos.length && eventos[j].t < finP; j++) finP += eventos[j].ms;
      lat.push(finP - inicio);
    }
    const pausasMs = eventos.map((e) => e.ms);
    const resumen = (gen, tipo) => { const xs = eventos.filter((e) => e.gen === gen && (tipo == null || (tipo === 1 ? e.tipo === 1 : e.tipo !== 1))).map((e) => e.ms); return { n: xs.length, sumMs: xs.reduce((a, b) => a + b, 0), maxMs: xs.length ? Math.max(...xs) : 0, p50Ms: percentil(xs, 0.5), p99Ms: percentil(xs, 0.99) }; };
    return {
      opciones: o, eventos, muestras, colecciones: n,
      pausaTotalMs: pausaTotal, pausaPct: pausaTotal / fin * 100, pausaMaxMs: pausaMax, pausaP99Ms: percentil(pausasMs, 0.99),
      trabajoFondoMs: trabajoFondo, cpuGcPct: (pausaTotal * (server ? o.nucleos : 1) + trabajoFondo) / (fin * o.nucleos) * 100,
      pausas: { gen0: resumen(0), gen1: resumen(1), gen2Bloqueante: resumen(2, 0), gen2Fondo: resumen(2, 1) },
      latencia: { n: lat.length, p50: percentil(lat, 0.5), p99: percentil(lat, 0.99), max: lat.length ? Math.max(...lat) : 0, afectados: lat.filter((x) => x > o.servicioMs + 0.5).length },
      heapMaxMB: muestras.length ? Math.max(...muestras.map((m) => m.gen0 + m.gen1 + m.gen2 + m.loh)) : 0,
      vivoFinalMB: vivoTotal(),
      presupuestos: { gen0MB: B0, gen1MB: B1, lohMB: lohB, heaps },
    };
  }

  /** Diagnóstico en criollo a partir del resultado. */
  function diagnosticar(r) {
    const o = r.opciones, d = [];
    const p = r.pausas;
    if (r.colecciones.gen0 + r.colecciones.gen1 + r.colecciones.gen2 === 0) { d.push({ nivel: "ok", titulo: "No hubo ni un GC", texto: "Con ese ritmo y ese presupuesto, en " + o.duracionS + " s el gen0 no se llenó nunca. El GC no es tu problema." }); return d; }
    if (o.vidaMediaPct > 0 && o.objKB < 85 && p.gen1.n + p.gen2Bloqueante.n + p.gen2Fondo.n > 0 && (p.gen1.sumMs + p.gen2Bloqueante.sumMs + p.gen2Fondo.sumMs) > p.gen0.sumMs * 0.5)
      d.push({ nivel: "mal", titulo: "Crisis de la mediana edad", texto: "El " + o.vidaMediaPct + " % de lo que asignás vive " + o.vidaMediaMs + " ms: lo suficiente para sobrevivir al gen0 y que haya que copiarlo a gen1, y de ahí a gen2, donde recién muere. Cada byte se copia dos veces y las gen1 y gen2 se llevan " + (p.gen1.sumMs + p.gen2Bloqueante.sumMs + p.gen2Fondo.sumMs).toFixed(0) + " ms de pausa. Es el patrón de un caché con expiración corta, de un buffer de pedidos pendientes o de un `List` que se llena y se tira. Lo que ayuda: que vivan menos (morir en gen0 es gratis) o mucho más (que queden en gen2 y no se toquen); agrandar el gen0 para que les dé tiempo a morir; o un `ArrayPool`/`ObjectPool` para no asignarlos." });
    if (o.objKB >= 85 && !o.pool && r.colecciones.gen2 > 0)
      d.push({ nivel: "mal", titulo: "Churn en el LOH", texto: "Objetos de " + o.objKB + " KB van al heap de objetos grandes, que solo se limpia con un gen2: cada " + (r.presupuestos.lohMB).toFixed(0) + " MB de LOH asignados hay un gen2 completo (" + r.colecciones.gen2 + " en " + o.duracionS + " s) y mientras tanto la memoria se queda ocupada por basura. Con `ArrayPool<byte>.Shared` (o `MemoryPool`, o un buffer reutilizado) esas asignaciones desaparecen; también sirve achicar el buffer por debajo de 85.000 bytes o `GCLOHThreshold`." });
    if (p.gen2Bloqueante.maxMs > 20)
      d.push({ nivel: "mal", titulo: "Gen2 bloqueantes de " + p.gen2Bloqueante.maxMs.toFixed(0) + " ms", texto: (o.concurrente ? "Hubo gen2 bloqueantes a pesar del GC de fondo (" + (o.objKB >= 85 ? "los disparó el LOH" : "se disparó un gen2 mientras el anterior no había terminado") + ")." : "Con el GC concurrente apagado, cada gen2 recorre todo lo vivo (" + r.vivoFinalMB.toFixed(0) + " MB) con todos los hilos frenados.") + " Un pedido que cae en el medio espera ese tiempo entero: el p99 de la simulación da " + r.latencia.p99.toFixed(1) + " ms para pedidos de " + o.servicioMs + " ms. " + (o.concurrente ? "" : "Prendé `<ConcurrentGarbageCollection>true</ConcurrentGarbageCollection>` (es el default; alguien lo apagó).") });
    if (o.crecerMBs > 0)
      d.push({ nivel: "mal", titulo: "El heap vivo no para de crecer", texto: "Hay " + o.crecerMBs + " MB/s que quedan vivos para siempre. Cada gen2 recorre más (" + r.vivoFinalMB.toFixed(0) + " MB al final) y las pausas o el trabajo de fondo crecen con él; en producción eso termina en un OOM o en un pod reiniciado. Es la firma de una fuga: un caché sin tope, un `static List`, suscripciones a eventos que nadie desengancha, un `MemoryCache` sin `SizeLimit`. Un dump con `dotnet-gcdump` muestra quién retiene qué." });
    if (o.cacheMB >= 512 && o.concurrente && p.gen2Fondo.n > 0 && !(o.objKB >= 85))
      d.push({ nivel: "medio", titulo: "Heap grande, pero el GC de fondo lo aguanta", texto: "Hay " + o.cacheMB + " MB vivos y los gen2 (" + r.colecciones.gen2 + ") fueron de fondo: dos pausas cortas (la más larga, " + p.gen2Fondo.maxMs.toFixed(1) + " ms) y el marcado en un hilo aparte, " + (r.trabajoFondoMs / 1000).toFixed(1) + " s de CPU en total. El costo no desapareció: se mudó de la latencia al CPU. En un contenedor con un solo núcleo ese hilo compite con tus pedidos." });
    if (p.gen0.n > 0 && p.gen0.sumMs > 0.8 * r.pausaTotalMs && r.pausaPct < 1)
      d.push({ nivel: "ok", titulo: "Casi todo muere en gen0: el caso barato", texto: r.colecciones.gen0 + " gen0 de " + p.gen0.p50Ms.toFixed(2) + " ms (mediana), " + r.pausaPct.toFixed(2) + " % del tiempo en pausa. Asignar mucho no es el problema mientras lo asignado muera joven: el gen0 se limpia copiando solo lo vivo, y si no hay nada vivo, cuesta casi nada. Lo caro es asignar y retener." });
    if (r.pausaPct >= 5)
      d.push({ nivel: "mal", titulo: r.pausaPct.toFixed(1) + " % del tiempo con todo frenado", texto: "Por encima del 5 % ya es un impuesto visible en el throughput y en la latencia; el `PauseTimePercentage` de `GC.GetGCMemoryInfo()` es el número que mirás en producción (y `dotnet-counters` lo muestra como «% Time in GC since last GC»)." });
    if (o.finalizadores)
      d.push({ nivel: "medio", titulo: "Finalizadores: todo sobrevive una vez de más", texto: "Un objeto con finalizador no se libera en el GC que lo encuentra muerto: se anota en la cola de finalización, sobrevive (se promueve) y recién se libera en el siguiente GC de su nueva generación, después de que el hilo finalizador corrió. Lo de vida corta se vuelve de vida media. Si el objeto solo envuelve un `IDisposable`, no le pongas finalizador; si envuelve un handle nativo, `SafeHandle` ya lo tiene bien hecho." });
    if (o.modo === "datas")
      d.push({ nivel: "medio", titulo: "DATAS: muchos GC chicos", texto: "Con `DOTNET_GCDynamicAdaptationMode=1` el server GC arranca con un solo heap y un gen0 de pocos MB, y va agregando heaps según la carga: en vez de pocos GC grandes hay muchos chicos (" + r.colecciones.gen0 + " gen0 de " + r.pausas.gen0.p50Ms.toFixed(2) + " ms) y la memoria queda baja. En .NET 9 es el default del server GC." });
    if (o.modo === "server" && o.nucleos > 1)
      d.push({ nivel: "medio", titulo: "Server GC: " + o.nucleos + " heaps, pausas más cortas, más memoria", texto: "Cada núcleo tiene su heap y su hilo de GC: el trabajo se reparte y las pausas duran menos, pero el presupuesto de gen0 es " + r.presupuestos.gen0MB.toFixed(0) + " MB en total y el heap comprometido llega a " + r.heapMaxMB.toFixed(0) + " MB. En un contenedor chico puede ser más memoria de la que hay; `DOTNET_GCDynamicAdaptationMode=1` (DATAS) ajusta la cantidad de heaps según la carga (en .NET 9 es el default)." });
    if (r.latencia.p99 > o.servicioMs * 2 && d.every((x) => x.nivel !== "mal"))
      d.push({ nivel: "medio", titulo: "El p99 de los pedidos lo pone el GC", texto: "Pedidos de " + o.servicioMs + " ms con p99 de " + r.latencia.p99.toFixed(1) + " ms: " + r.latencia.afectados + " de " + r.latencia.n + " cayeron en una pausa." });
    if (!d.length) d.push({ nivel: "ok", titulo: "Nada raro", texto: r.pausaPct.toFixed(2) + " % del tiempo en pausa, la más larga " + r.pausaMaxMs.toFixed(1) + " ms." });
    return d;
  }

  const ESCENARIOS = [
    { clave: "corta", nombre: "Asignar mucho que muere al toque", opts: { ritmoMBs: 200, objKB: 1 }, texto: "200 MB/s de objetos de 1 KB que no se retienen. El caso normal de una API: DTOs, strings, listas de un pedido." },
    { clave: "media", nombre: "Crisis de la mediana edad", opts: { ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500 }, texto: "Lo mismo, pero cada objeto vive 500 ms antes de soltarse: sobrevive al gen0, se copia a gen1 y a gen2, y recién ahí muere." },
    { clave: "cache", nombre: "Un caché de 1 GB que nadie toca", opts: { ritmoMBs: 200, objKB: 1, cacheMB: 1024 }, texto: "Un giga de objetos chicos que viven para siempre, más el churn de vida corta. Sorpresa: no cuesta nada mientras nada se promueva." },
    { clave: "cache-media", nombre: "El caché de 1 GB más vida media", opts: { ritmoMBs: 200, objKB: 1, cacheMB: 1024, vidaMediaPct: 100, vidaMediaMs: 500 }, texto: "El giga vivo más objetos que viven 500 ms: ahora sí hay gen2, y cada uno recorre el giga. De fondo, por suerte." },
    { clave: "cache-bloq", nombre: "El caché y una fuga, sin GC concurrente", opts: { ritmoMBs: 0, objKB: 1, cacheMB: 1024, crecerMBs: 25, duracionS: 40, concurrente: false }, texto: "Un giga vivo, 25 MB/s que se quedan, y `gcConcurrent=0`: cada gen2 frena todo mientras recorre el giga y lo que creció." },
    { clave: "loh", nombre: "Buffers de 100 KB sin pool", opts: { ritmoMBs: 200, objKB: 100 }, texto: "Un `new byte[102400]` por pedido (leer un archivo, un `MemoryStream` grande). Van al LOH y solo un gen2 los limpia." },
    { clave: "loh-pool", nombre: "Los mismos buffers con ArrayPool", opts: { ritmoMBs: 200, objKB: 100, pool: true }, texto: "`ArrayPool<byte>.Shared.Rent(102400)` y `Return`: el LOH no se toca." },
    { clave: "crecer", nombre: "Una fuga de 25 MB/s", opts: { ritmoMBs: 0, objKB: 1, crecerMBs: 25, duracionS: 40 }, texto: "Todo lo asignado queda vivo. Las gen2 son cada vez más largas y la memoria no vuelve." },
    { clave: "server", nombre: "Server GC con 4 núcleos", opts: { ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, modo: "server" }, texto: "La crisis de la mediana edad con un heap por núcleo: el gen0 es tan grande que a los objetos les da tiempo de morir antes del GC." },
    { clave: "datas", nombre: "Server con DATAS", opts: { ritmoMBs: 200, objKB: 1, vidaMediaPct: 100, vidaMediaMs: 500, modo: "datas" }, texto: "`DOTNET_GCDynamicAdaptationMode=1`: arranca con un heap y un gen0 chiquito, y adapta. Muchos GC cortos." },
    { clave: "finalizador", nombre: "Objetos con finalizador", opts: { ritmoMBs: 200, objKB: 1, finalizadores: true }, texto: "Un `~Clase()` en objetos de vida corta: todos sobreviven una vez de más y hay que anotarlos uno por uno." },
  ];

  const api = { K, PRESUPUESTOS, defaults, simular, diagnosticar, ESCENARIOS, percentil };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.GcEnVivo = api;
})(typeof window !== "undefined" ? window : globalThis);
