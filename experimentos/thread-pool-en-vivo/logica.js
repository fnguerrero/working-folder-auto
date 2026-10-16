/* Por qué se cuelga tu API: lógica pura del simulador del thread pool de .NET.
   Se carga en el navegador (window.ThreadPoolSim) y en Node (module.exports).

   Es un MODELO, no el runtime: reproduce las reglas documentadas del PortableThreadPool
   (hilos mínimos = núcleos, el gate thread que agrega un hilo cada 500 ms cuando hay cola y nadie
   libre, y en .NET 6+ la inyección rápida cuando un hilo se bloquea en Task.Wait / .Result) con un
   reloj de 1 ms. No modela el hill climbing ni la presión de memoria. Ver el README y las fuentes. */
(function (raiz) {
  "use strict";

  // ---------- Azar reproducible ----------
  function crearRng(semilla) {
    let a = (semilla >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const exponencial = (rng, media) => -Math.log(1 - rng()) * media;

  // ---------- Parámetros ----------
  const DEFAULTS = {
    nucleos: 4,          // Environment.ProcessorCount; los hilos mínimos del pool arrancan igual.
    minHilos: 0,         // 0 = igual a núcleos (el default del runtime). ThreadPool.SetMinThreads cambia esto.
    maxHilos: 32767,
    rps: 100,            // pedidos por segundo (llegadas Poisson)
    patron: "constante", // "constante" o "rafaga": además de la carga constante, una ráfaga de `rafaga` pedidos a los 2 s
    rafaga: 200,
    cpuMs: 2,            // CPU de cada pedido antes de la I/O (deserializar, validar, armar la consulta)
    ioMs: 50,            // lo que tarda la I/O (base de datos, HTTP, archivo)
    cpuDespuesMs: 1,     // CPU después de la I/O (mapear, serializar la respuesta)
    variacionIo: 0.2,    // ± fracción uniforme sobre ioMs
    modoIo: "result",    // "async" (await), "result" (.Result / .Wait() sobre una Task), "sync" (I/O sincrónica, lock, Thread.Sleep)
    runtime: "net6",     // "net6" (.NET 6 o más nuevo, detecta bloqueos en Task.Wait) o "clasico" (.NET Core ≤ 5, .NET Framework)
    finalizacionPorPool: true, // con .Result: la finalización de la I/O (timer, socket) es un work item más, que va al final de la cola.
                               // Es lo que pasa con Task.Delay siempre, con sockets en Linux y en .NET 7+ en Windows. false = la corre
                               // un hilo de I/O aparte (IOCP en Windows antes de .NET 7) y el hilo bloqueado despierta solo.
    inyeccionMs: 500,    // sin aviso de bloqueo, cada cuánto el pool agrega un hilo si hay cola y nadie libre. 500 = el gate thread
                         // documentado; medido contra .NET 8 real con I/O sincrónica dio ~1.800 (el hill climbing es más lento).
    duracionS: 30,
    semilla: 1,
    muestreoMs: 100,     // cada cuánto se guarda una muestra para los gráficos
    gantt: true,         // guardar el estado de cada hilo cada 10 ms para el diagrama
  };

  // Constantes del runtime (PortableThreadPool).
  const GATE_MS = 500;                       // GateThreadDelayMs: el gate thread corre cada 500 ms
  const BLOQUEO_SIN_DEMORA_FACTOR = 1.25;    // ThreadsToAddWithoutDelay_ProcCountFactor
  const BLOQUEO_POR_PASO_FACTOR = 0.25;      // ThreadsPerDelayStep_ProcCountFactor
  const BLOQUEO_PASO_MS = 25;                // DelayStepMs
  const BLOQUEO_MAX_MS = 250;                // MaxDelayMs
  const RETIRO_OCIOSO_MS = 20000;            // un hilo de más que lleva 20 s sin trabajo se va

  const LIBRE = 1, CPU = 2, BLOQUEADO = 3;

  // ---------- Simulación ----------
  function simular(opciones) {
    const o = Object.assign({}, DEFAULTS, opciones || {});
    const rng = crearRng(o.semilla);
    const minHilos = o.minHilos > 0 ? o.minHilos : o.nucleos;
    const maxHilos = Math.max(minHilos, o.maxHilos);
    const bloqueaHilo = o.modoIo !== "async";
    const detectaBloqueo = o.runtime === "net6" && o.modoIo === "result";
    const finPorPool = o.modoIo === "result" && o.finalizacionPorPool !== false;
    const gateMs = Math.max(1, Math.round(o.inyeccionMs > 0 ? o.inyeccionMs : GATE_MS));
    const sinDemora = Math.ceil(o.nucleos * BLOQUEO_SIN_DEMORA_FACTOR);
    const porPaso = Math.max(1, Math.floor(o.nucleos * BLOQUEO_POR_PASO_FACTOR));
    const duracionMs = Math.round(o.duracionS * 1000);
    const MAX_HILOS_GANTT = 512;

    const hilos = [];           // {estado, restante, pedido, fase, ociosoDesde}
    const cola = [];            // {pedido, fase: "inicio" | "continuacion"}
    const ioPendientes = [];    // {pedido, restante}
    const latencias = [];       // ms, por pedido terminado
    const muestras = [];        // cada muestreoMs
    const gantt = [];           // cada 10 ms: Uint8Array con el estado de cada hilo
    let llegados = 0, completados = 0, colaMax = 0, hilosMax = 0, bloqueadosMax = 0;
    let completadosVentana = 0, latVentana = [];
    let proximaLlegada = exponencial(rng, 1000 / o.rps);
    let rafagaHecha = false;
    let pasoBloqueo = 0, proximoPasoBloqueo = 0;
    let ultimaCreacion = -1;
    let cpuOcupadaMs = 0; // núcleos·ms usados

    const crearHilo = (t) => {
      hilos.push({ estado: LIBRE, restante: 0, pedido: null, fase: null, ociosoDesde: t, creado: t });
      ultimaCreacion = t;
      if (hilos.length > hilosMax) hilosMax = hilos.length;
    };
    const encolar = (t, fase, pedido) => { cola.push({ pedido, fase }); if (cola.length > colaMax) colaMax = cola.length; };
    const llegar = (t) => { llegados++; encolar(t, "inicio", { llegada: t }); };
    const ioDe = () => o.ioMs * (1 + (rng() * 2 - 1) * o.variacionIo);
    const despachar = (t) => {
      for (const h of hilos) {
        if (h.estado !== LIBRE) continue;
        while (cola.length > 0) {
          const item = cola.shift();
          if (item.fase === "finalizacion") {
            // La finalización de la I/O de otro hilo: despierta al que estaba bloqueado en .Result. Cuesta nada y
            // este hilo sigue buscando trabajo.
            const b = item.hilo; b.estado = CPU; b.fase = "continuacion"; b.restante = o.cpuDespuesMs;
            continue;
          }
          h.estado = CPU; h.pedido = item.pedido; h.fase = item.fase;
          h.restante = item.fase === "inicio" ? o.cpuMs : o.cpuDespuesMs;
          if (item.fase === "inicio" && item.pedido.inicio === undefined) item.pedido.inicio = t;
          break;
        }
      }
    };

    for (let t = 0; t < duracionMs; t++) {
      // 1. Llegadas.
      while (proximaLlegada <= t) { llegar(t); proximaLlegada += exponencial(rng, 1000 / o.rps); }
      if (o.patron === "rafaga" && !rafagaHecha && t >= 2000) { rafagaHecha = true; for (let i = 0; i < o.rafaga; i++) llegar(t); }

      // 2. Progreso de lo que está corriendo.
      let enCpu = 0;
      for (const h of hilos) if (h.estado === CPU) enCpu++;
      const factor = enCpu > 0 ? Math.min(1, o.nucleos / enCpu) : 0;
      cpuOcupadaMs += Math.min(enCpu, o.nucleos);
      let bloqueados = 0;
      for (const h of hilos) {
        if (h.estado === CPU) {
          h.restante -= factor;
          if (h.restante <= 1e-9) {
            if (h.fase === "inicio") {
              if (bloqueaHilo) { h.estado = BLOQUEADO; h.restante = ioDe(); h.fase = "io"; }
              else { ioPendientes.push({ pedido: h.pedido, restante: ioDe() }); h.estado = LIBRE; h.pedido = null; h.ociosoDesde = t; }
            } else { // continuación terminada: pedido listo
              h.pedido.fin = t + 1;
              const lat = h.pedido.fin - h.pedido.llegada;
              latencias.push(lat); latVentana.push(lat); completados++; completadosVentana++;
              h.estado = LIBRE; h.pedido = null; h.ociosoDesde = t;
            }
          }
        } else if (h.estado === BLOQUEADO) {
          if (h.fase === "esperaFinalizacion") { bloqueados++; continue; } // la I/O terminó, pero nadie corrió todavía su finalización
          h.restante -= 1;
          if (h.restante <= 1e-9) {
            if (finPorPool) { h.fase = "esperaFinalizacion"; cola.push({ fase: "finalizacion", hilo: h }); if (cola.length > colaMax) colaMax = cola.length; bloqueados++; }
            else { h.estado = CPU; h.fase = "continuacion"; h.restante = o.cpuDespuesMs; }
          }
          else bloqueados++;
        }
      }
      for (let i = ioPendientes.length - 1; i >= 0; i--) {
        const p = ioPendientes[i]; p.restante -= 1;
        if (p.restante <= 1e-9) { encolar(t, "continuacion", p.pedido); ioPendientes.splice(i, 1); }
      }
      if (bloqueados > bloqueadosMax) bloqueadosMax = bloqueados;

      // 3. Despacho: cada hilo libre toma el siguiente ítem de la cola (FIFO).
      despachar(t);
      // 4. Hilos: hasta el mínimo se crean sin demora cuando hay trabajo.
      while (cola.length > 0 && hilos.length < minHilos) { crearHilo(t); despachar(t); }
      // Gate thread (cada 500 ms): hay cola y todos los hilos están ocupados → un hilo más. Es la inanición "clásica".
      if (t > 0 && t % gateMs === 0 && cola.length > 0 && hilos.length < maxHilos) { crearHilo(t); despachar(t); }
      // .NET 6+: cuando un hilo se bloquea en Task.Wait el pool lo sabe y sube la meta a mínimo + bloqueados.
      if (detectaBloqueo) {
        const meta = Math.min(maxHilos, minHilos + bloqueados);
        if (hilos.length < meta) {
          if (hilos.length - minHilos < sinDemora) {
            const hasta = Math.min(meta, minHilos + sinDemora);
            while (hilos.length < hasta) crearHilo(t);
            pasoBloqueo = 0; proximoPasoBloqueo = t + BLOQUEO_PASO_MS;
          } else if (t >= proximoPasoBloqueo) {
            for (let i = 0; i < porPaso && hilos.length < meta; i++) crearHilo(t);
            pasoBloqueo++;
            proximoPasoBloqueo = t + Math.min(BLOQUEO_MAX_MS, BLOQUEO_PASO_MS * (pasoBloqueo + 1));
          }
          despachar(t);
        } else pasoBloqueo = 0;
      }
      // Hilos de más que llevan mucho ociosos se retiran.
      if (hilos.length > minHilos && cola.length === 0) {
        for (let i = hilos.length - 1; i >= 0 && hilos.length > minHilos; i--) {
          if (hilos[i].estado === LIBRE && t - hilos[i].ociosoDesde >= RETIRO_OCIOSO_MS) hilos.splice(i, 1);
        }
      }

      // 5. Muestras.
      if (o.gantt && t % 10 === 0) {
        const fila = new Uint8Array(Math.min(hilos.length, MAX_HILOS_GANTT));
        for (let i = 0; i < fila.length; i++) fila[i] = hilos[i].estado;
        gantt.push(fila);
      }
      if ((t + 1) % o.muestreoMs === 0) {
        latVentana.sort((a, b) => a - b);
        muestras.push({
          t: (t + 1) / 1000, hilos: hilos.length, bloqueados, enCpu: Math.min(enCpu, o.nucleos), cola: cola.length,
          ioPendientes: ioPendientes.length, completados: completadosVentana,
          p50: percentilOrdenado(latVentana, 0.5), p99: percentilOrdenado(latVentana, 0.99),
        });
        completadosVentana = 0; latVentana = [];
      }
    }

    const ordenadas = latencias.slice().sort((a, b) => a - b);
    // Un ítem de finalización no es un pedido: el pedido ya está contado en el hilo que lo espera.
    const enVuelo = cola.filter((i) => i.fase !== "finalizacion").length + ioPendientes.length + hilos.reduce((n, h) => n + (h.pedido ? 1 : 0), 0);
    return {
      opciones: o, minHilos, muestras, gantt, latencias: ordenadas,
      llegados, completados, enVuelo, colaMax, hilosMax, bloqueadosMax, hilosFinal: hilos.length,
      p50: percentilOrdenado(ordenadas, 0.5), p99: percentilOrdenado(ordenadas, 0.99), max: ordenadas.length ? ordenadas[ordenadas.length - 1] : 0,
      media: ordenadas.length ? ordenadas.reduce((s, x) => s + x, 0) / ordenadas.length : 0,
      cpuPromedio: cpuOcupadaMs / (duracionMs * o.nucleos),
      recuperacion: tiempoRecuperacion(muestras),
      colaFinal: cola.length,
    };
  }

  function percentilOrdenado(xs, p) {
    if (!xs.length) return 0;
    const i = Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1));
    return xs[i];
  }

  // Cuándo la cola volvió a cero (o casi) después de su pico. null si nunca.
  function tiempoRecuperacion(muestras) {
    let pico = 0, tPico = 0;
    for (const m of muestras) if (m.cola > pico) { pico = m.cola; tPico = m.t; }
    if (pico < 10) return { pico, tPico, t: 0, ok: true };
    for (const m of muestras) if (m.t > tPico && m.cola <= Math.max(2, pico * 0.02)) return { pico, tPico, t: m.t, ok: true };
    return { pico, tPico, t: null, ok: false };
  }

  // ---------- Cuentas de servilleta (la teoría contra la que se compara) ----------
  function cuentas(opciones) {
    const o = Object.assign({}, DEFAULTS, opciones || {});
    const minHilos = o.minHilos > 0 ? o.minHilos : o.nucleos;
    const cpuTotal = o.cpuMs + o.cpuDespuesMs;
    const porPedidoBloqueando = o.cpuMs + o.ioMs + o.cpuDespuesMs;        // ms que un hilo queda tomado por pedido
    const capacidadPorHilo = 1000 / porPedidoBloqueando;                   // pedidos/s que atiende un hilo bloqueando
    const capacidadCpu = o.nucleos * 1000 / cpuTotal;                      // tope por CPU (async)
    const hilosNecesarios = Math.ceil(o.rps / capacidadPorHilo);           // Little: concurrencia = λ·W
    const capacidadInicial = Math.min(capacidadCpu, minHilos * capacidadPorHilo);
    const faltan = Math.max(0, hilosNecesarios - minHilos);
    const gateMs = o.inyeccionMs > 0 ? o.inyeccionMs : GATE_MS;
    const segundosHastaAlcanzar = faltan * gateMs / 1000;                  // a un hilo cada inyeccionMs (500 por defecto)
    // Mientras se inyectan hilos, la capacidad crece linealmente: lo que se acumula es la integral de (λ − capacidad).
    let colaAcumulada = 0;
    for (let k = 0; k < faltan; k++) colaAcumulada += Math.max(0, o.rps - (minHilos + k) * capacidadPorHilo) * gateMs / 1000;
    return {
      minHilos, cpuTotal, porPedidoBloqueando, capacidadPorHilo, capacidadCpu, hilosNecesarios, capacidadInicial, faltan,
      segundosHastaAlcanzar, colaAcumulada: Math.round(colaAcumulada),
      utilizacionCpuAsync: o.rps * cpuTotal / 1000 / o.nucleos,
      utilizacionCpuBloqueando: Math.min(1, o.rps * cpuTotal / 1000 / o.nucleos),
      cabeAsync: o.rps < capacidadCpu,
      cabeBloqueandoConMinimos: o.rps < capacidadInicial,
      memoriaHilosMb: hilosNecesarios, // ~1 MB de stack reservado por hilo
    };
  }

  // ---------- Diagnóstico en criollo ----------
  function diagnosticar(r) {
    const o = r.opciones, c = cuentas(o);
    const f = (x, d = 0) => Number(x).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
    const ms = (x) => (x >= 10000 ? `${f(x / 1000, 1)} s` : `${f(x)} ms`);
    const ideal = o.cpuMs + o.ioMs + o.cpuDespuesMs;
    const puntos = [], acciones = [];
    let zona, titulo, resumen;
    const modo = o.modoIo === "async" ? "async de punta a punta" : o.modoIo === "result" ? ".Result / .Wait() sobre una Task" : "I/O sincrónica (o lock, o Thread.Sleep)";

    if (o.modoIo === "async") {
      if (!c.cabeAsync) {
        zona = "colapso"; titulo = "La CPU no da abasto, y eso no lo arregla ningún hilo";
        resumen = `Con ${o.nucleos} núcleos y ${f(c.cpuTotal)} ms de CPU por pedido, el tope son ${f(c.capacidadCpu)} pedidos/s y llegan ${f(o.rps)}. La cola crece sin parar: ${f(r.colaFinal)} pedidos esperando al final.`;
        acciones.push("Menos CPU por pedido (perfilá: serialización, LINQ pesado, regex, logging) o más núcleos/instancias.");
      } else {
        zona = r.p99 <= ideal * 2 ? "ok" : "degradado";
        titulo = zona === "ok" ? "Async de punta a punta: el pool no se entera de la I/O" : "Async, pero la CPU está al límite";
        resumen = `Cada pedido ocupa un hilo solo ${f(c.cpuTotal)} ms (lo demás es esperar la I/O sin hilo). Con ${o.nucleos} núcleos alcanza para ${f(c.capacidadCpu)} pedidos/s y llegan ${f(o.rps)}: CPU al ${f(c.utilizacionCpuAsync * 100)} %. p99 medido: ${ms(r.p99)} contra ${f(ideal)} ms de mínimo posible.`;
        if (zona === "degradado") acciones.push("Estás cerca del tope de CPU: la cola aparece por los picos. Un núcleo más, o una instancia más, o menos CPU por pedido.");
        else acciones.push("Nada que arreglar acá. Si en producción igual ves inanición, buscá el bloqueo escondido: un `.Result`, un `lock` largo, I/O sincrónica en una librería, un `Task.Run` que espera.");
      }
      puntos.push(`Hilos usados: ${f(r.hilosMax)} como máximo (el mínimo del pool es ${f(c.minHilos)}). Ninguno bloqueado.`);
    } else if (o.modoIo === "result" && o.finalizacionPorPool !== false && r.completados < r.llegados * 0.6 && r.colaFinal > Math.max(20, o.rps)) {
      zona = "colapso"; titulo = "Sync over async: las finalizaciones se encolan detrás de los pedidos y el pool se clava";
      resumen = `Cada \`.Result\` deja un hilo bloqueado esperando una Task que solo termina cuando un hilo del pool corra su finalización (el timer, la respuesta del socket). Esa finalización es un work item más y va al FINAL de la cola, detrás de los pedidos que siguen llegando. Los hilos nuevos toman pedidos y se bloquean también. Terminaron ${f(r.completados)} de ${f(r.llegados)} pedidos${o.runtime === "net6" ? ` aunque el pool llegó a ${f(r.hilosMax)} hilos por la detección de bloqueos de .NET 6+` : ""}; cola al final: ${f(r.colaFinal)}.`;
      puntos.push("Esto es lo que se midió contra un .NET 8 real (ver «Contrastado contra un .NET 8 de verdad», abajo): con `Task.Delay(100).Wait()` o `HttpClient...Result` a 100 pedidos/s en 2 núcleos, la API no contesta ningún pedido hasta que para el tráfico.");
      puntos.push(`La detección de bloqueos de .NET 6+ no alcanza: agrega hilos (acá ${f(r.hilosMax)}), pero cada hilo nuevo toma el siguiente pedido de la cola y se bloquea igual. Solo zafa si en algún momento un hilo libre llega a una finalización antes que a un pedido, y con carga sostenida eso no pasa.`);
      acciones.push("Async de punta a punta. No hay parche de hilos que arregle esto: `SetMinThreads` solo corre el umbral, y un `lock` o I/O sincrónica de verdad (modo «I/O sincrónica») al menos termina solo cuando la I/O termina.");
      acciones.push("Si no podés tocar el código ya, desacoplá la finalización del pool: un `Task.Run` NO sirve (va a la misma cola); limitar la concurrencia con `SemaphoreSlim` antes del `.Result` sí ayuda, porque siempre quedan hilos libres para correr finalizaciones.");
    } else {
      const rapido = o.modoIo === "result" && o.runtime === "net6";
      puntos.push(`Cada pedido tiene tomado un hilo ${f(c.porPedidoBloqueando)} ms (${f(o.cpuMs)} de CPU + ${f(o.ioMs)} bloqueado esperando la I/O + ${f(o.cpuDespuesMs)} de CPU). Un hilo atiende como mucho ${f(c.capacidadPorHilo, 1)} pedidos/s.`);
      puntos.push(`Para ${f(o.rps)} pedidos/s hacen falta ${f(c.hilosNecesarios)} hilos a la vez (Little: λ·W = ${f(o.rps)} × ${f(c.porPedidoBloqueando / 1000, 3)} s). El pool arranca con ${f(c.minHilos)}.`);
      if (c.cabeBloqueandoConMinimos && o.patron === "rafaga" && r.p99 > ideal * 2) {
        zona = r.recuperacion.ok ? "inanicion" : "colapso";
        titulo = r.recuperacion.ok ? `La ráfaga se traba en los hilos: ${f(r.recuperacion.t - 2, 1)} s para digerirla` : "La ráfaga se traba en los hilos y no se digiere en toda la corrida";
        resumen = `Con ${f(o.rps)} pedidos/s los ${f(c.minHilos)} hilos alcanzaban (capacidad ${f(c.capacidadInicial)}/s). Pero los ${f(o.rafaga)} de la ráfaga quieren un hilo cada uno al mismo tiempo, y se atienden de a ${f(c.minHilos)} cada ${f(c.porPedidoBloqueando)} ms mientras el gate thread agrega uno cada 500 ms. Pico de ${f(r.colaMax)} en cola, p99 de ${ms(r.p99)}, máximo ${ms(r.max)}.`;
        acciones.push("Con async la ráfaga se absorbe con los mismos hilos: cada pedido ocupa un hilo solo unos milisegundos y la I/O de los 300 corre en paralelo sin hilos.");
        acciones.push("Si no podés cambiar el código, un `SetMinThreads` más alto amortigua el pico (y, si el cuello es la base, un límite de concurrencia con `SemaphoreSlim` evita que la tires abajo).");
      } else if (c.cabeBloqueandoConMinimos) {
        zona = r.p99 <= ideal * 2 ? "ok" : "degradado";
        titulo = zona === "ok" ? "Bloquea, pero con los hilos que hay alcanza" : "Bloquea y va justo";
        resumen = `Con ${f(c.minHilos)} hilos la capacidad es ${f(c.capacidadInicial)} pedidos/s y llegan ${f(o.rps)}. Funciona, pero es un equilibrio frágil: un pico de tráfico, una base más lenta o un deploy con menos núcleos, y esto se convierte en inanición.`;
        acciones.push("Pasalo a async igual: hoy zafa por volumen, no por diseño.");
      } else if (!c.cabeAsync) {
        zona = "colapso"; titulo = "Además de bloquear, la CPU no alcanza";
        resumen = `Aunque el pool llegue a los ${f(c.hilosNecesarios)} hilos, ${f(o.nucleos)} núcleos con ${f(c.cpuTotal)} ms de CPU por pedido topean en ${f(c.capacidadCpu)} pedidos/s. Cola al final: ${f(r.colaFinal)}.`;
        acciones.push("Primero bajar la CPU por pedido o sumar núcleos; después, async.");
      } else if (!rapido) {
        zona = r.recuperacion.ok ? "inanicion" : "colapso";
        titulo = r.recuperacion.ok ? `Inanición del thread pool: tardó ${f(r.recuperacion.t, 1)} s en recuperarse` : "Inanición del thread pool: no se recuperó en toda la corrida";
        const porque = o.modoIo === "sync" ? "Con I/O sincrónica, lock o Thread.Sleep el pool no sabe que el hilo está bloqueado: para él es un hilo ocupado." : o.runtime === "clasico" ? "Antes de .NET 6 el pool tampoco distinguía un hilo bloqueado en .Result de uno trabajando." : "";
        resumen = `${porque} Lo único que lo salva es el gate thread, que cada 500 ms ve «hay cola y nadie libre» y agrega UN hilo. Faltan ${f(c.faltan)} hilos: ${f(c.segundosHastaAlcanzar, 1)} s de inyección, y mientras tanto se acumulan unos ${f(c.colaAcumulada)} pedidos (medido: pico de ${f(r.colaMax)} en cola, p99 de ${ms(r.p99)}, máximo ${ms(r.max)}).`;
        acciones.push("La solución es async de punta a punta: `await` en vez de `.Result`/`.Wait()`, `ExecuteReaderAsync`, `SendAsync`, `ReadAsync`. Sin ningún `Task.Run` que después espere.");
        acciones.push(`Parche mientras tanto: \`ThreadPool.SetMinThreads(${f(Math.ceil(c.hilosNecesarios * 1.5))}, ${f(Math.ceil(c.hilosNecesarios * 1.5))})\` al arrancar (o \`System.Threading.ThreadPool.MinThreads\` en runtimeconfig.json). Compra tiempo, no arregla.`);
        if (o.modoIo === "sync") acciones.push("Si el bloqueo es un `lock` o una conexión sincrónica, .NET 6+ tampoco lo detecta: ahí no hay inyección rápida que valga.");
      } else {
        zona = r.p99 <= ideal * 2 ? "ok" : r.p99 <= ideal * 6 ? "degradado" : "inanicion";
        titulo = "Lo salva la detección de bloqueos de .NET 6+, a costa de hilos";
        resumen = `Cada \`.Result\` sobre una Task que no terminó avisa al pool, que sube la meta a mínimo + bloqueados y crea hilos casi sin demora (los primeros ${f(Math.ceil(o.nucleos * 1.25))}, después de a ${f(Math.max(1, Math.floor(o.nucleos * 0.25)))} con pausas de 25 a 250 ms). Llegó a ${f(r.hilosMax)} hilos (${f(r.bloqueadosMax)} bloqueados a la vez): p99 de ${ms(r.p99)}, pico de cola ${f(r.colaMax)}.`;
        puntos.push(`${f(r.hilosMax)} hilos son unos ${f(r.hilosMax)} MB de stack reservado y más cambios de contexto. Y solo funciona porque el bloqueo es \`Task.Wait\`: un \`lock\`, una conexión sincrónica o un \`Thread.Sleep\` no avisan.`);
        acciones.push("Pasarlo a async de punta a punta igual: con `await` esto corre con los hilos mínimos.");
      }
    }
    if (o.patron === "rafaga") puntos.push(`La ráfaga de ${f(o.rafaga)} pedidos a los 2 s es lo que dispara todo: cada uno quiere un hilo al mismo tiempo.`);
    puntos.push(`Medido en ${f(o.duracionS)} s: ${f(r.llegados)} pedidos, ${f(r.completados)} terminados, p50 ${ms(r.p50)}, p99 ${ms(r.p99)}, máximo ${ms(r.max)}; CPU al ${f(r.cpuPromedio * 100)} % en promedio.`);
    return { zona, titulo, resumen, puntos, acciones, cuentas: c, modo };
  }

  // ---------- Escenarios ----------
  const PRESETS = {
    clasico: { nombre: "El clásico: .Result en .NET Framework", descripcion: "4 núcleos, 200 pedidos/s, la base tarda 100 ms y el controller hace .Result. Windows antes de .NET 7: la finalización de la I/O la corre un hilo de IOCP aparte, así que lo único que falta son hilos, y el pool los agrega de a uno.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "result", runtime: "clasico", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: false, inyeccionMs: 500 } },
    net8: { nombre: "Lo mismo en .NET 8 (medido)", descripcion: "Idéntico, en .NET 8: el runtime detecta el bloqueo e inyecta hilos, pero las finalizaciones de la I/O son work items que van al final de la cola, detrás de los pedidos. Medido contra un .NET 8 real: no contesta nada. Desmarcá «la finalización pasa por la cola del pool» para ver el modelo optimista.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "result", runtime: "net6", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 500 } },
    async: { nombre: "Async de punta a punta", descripcion: "Mismo tráfico con await: el hilo se libera mientras espera la base.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "async", runtime: "net6", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 500 } },
    sync: { nombre: "I/O sincrónica en .NET 8", descripcion: "ToList() sin Async, un lock largo o un Thread.Sleep: .NET 8 tampoco lo ve, y agrega hilos despacio.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "sync", runtime: "net6", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 500 } },
    minthreads: { nombre: "Parche: SetMinThreads(64)", descripcion: "El .Result clásico con el pool arrancando en 64 hilos.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "result", runtime: "clasico", patron: "constante", minHilos: 64, duracionS: 30, finalizacionPorPool: false, inyeccionMs: 500 } },
    pod: { nombre: "En tu PC anda, en el pod de 2 vCPU explota (medido)", descripcion: "I/O sincrónica con 100 pedidos/s en 2 núcleos, con el ritmo de inyección medido en .NET 8 (un hilo cada ~1,8 s): p99 de 7 s y la cola no vuelve a cero en 30 s. Subí los núcleos a 16 y mirá.",
      valores: { nucleos: 2, rps: 100, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "sync", runtime: "net6", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 1800 } },
    pico: { nombre: "Pico de tráfico bloqueando", descripcion: "30 pedidos/s que zafan con 4 hilos, hasta que a los 2 s entran 300 de golpe.",
      valores: { nucleos: 4, rps: 30, cpuMs: 2, ioMs: 100, cpuDespuesMs: 1, modoIo: "sync", runtime: "net6", patron: "rafaga", rafaga: 300, minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 500 } },
    lenta: { nombre: "La base se puso lenta", descripcion: "Async, pero la consulta pasó de 100 ms a 2 s: el pool ni se inmuta, el que sufre es el usuario.",
      valores: { nucleos: 4, rps: 200, cpuMs: 2, ioMs: 2000, cpuDespuesMs: 1, modoIo: "async", runtime: "net6", patron: "constante", minHilos: 0, duracionS: 30, finalizacionPorPool: true, inyeccionMs: 500 } },
  };

  const API = { crearRng, simular, cuentas, diagnosticar, PRESETS, DEFAULTS, LIBRE, CPU, BLOQUEADO, percentilOrdenado, tiempoRecuperacion };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.ThreadPoolSim = API;
})(typeof window !== "undefined" ? window : globalThis);
