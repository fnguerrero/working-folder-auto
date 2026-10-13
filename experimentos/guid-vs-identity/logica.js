/* GUID o identity — lógica pura, sin DOM.
   Un B+tree chico pero fiel en lo que importa: páginas de tamaño fijo, división cuando se
   llenan, hojas encadenadas en orden lógico y un número de página físico que crece con cada
   página nueva (como una asignación secuencial en el archivo de datos). Sobre eso se miden
   divisiones, llenado, fragmentación y páginas calientes para distintos tipos de clave.
   Se carga en el navegador (window.Indice) y en Node (module.exports). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module && module.exports) module.exports = fabrica();
  else raiz.Indice = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PAGINA = 8192;          // bytes por página, como SQL Server y PostgreSQL
  const CABECERA = 96;          // cabecera de página (SQL Server usa 96; PostgreSQL 24 + punteros)
  const OVERHEAD_FILA = 10;     // bytes de cabecera por fila, redondeado
  const PUNTERO = 8;            // bytes de un puntero a página en un nodo interno

  /* ------------------------------------------------------------ azar reproducible */
  // mulberry32: PRNG chico y determinista, para que los tests y los "seeds" repitan resultados.
  function prng(semilla) {
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hex = (n, largo) => n.toString(16).padStart(largo, "0");
  function uuidDesde(bytesHex) {
    return `${bytesHex.slice(0, 8)}-${bytesHex.slice(8, 12)}-${bytesHex.slice(12, 16)}-${bytesHex.slice(16, 20)}-${bytesHex.slice(20, 32)}`;
  }

  /* ------------------------------------------------------------ generadores de claves */
  // Cada generador devuelve una función que da la siguiente clave. Las claves se comparan como
  // texto, así que los GUID se generan en hexadecimal con guiones (orden por bytes, de izquierda
  // a derecha, que es el de PostgreSQL y el de .NET; SQL Server ordena distinto, ver el texto).
  const GENERADORES = {
    identity: {
      nombre: "int identity",
      bytes: 4,
      crear: () => { let n = 0; return () => hex(++n, 8); },
    },
    bigint: {
      nombre: "bigint identity",
      bytes: 8,
      crear: () => { let n = 0; return () => hex(++n, 16); },
    },
    "guid-aleatorio": {
      nombre: "GUID aleatorio (v4, NEWID)",
      bytes: 16,
      crear: (semilla) => {
        const r = prng(semilla);
        return () => {
          let h = "";
          for (let i = 0; i < 8; i++) h += hex(Math.floor(r() * 65536), 4);
          // versión 4 y variante RFC, por prolijidad (no cambia el orden en nada que importe)
          h = h.slice(0, 12) + "4" + h.slice(13, 16) + (8 + Math.floor(r() * 4)).toString(16) + h.slice(17);
          return uuidDesde(h);
        };
      },
    },
    "guid-v7": {
      nombre: "GUID v7 (Guid.CreateVersion7)",
      bytes: 16,
      crear: (semilla, opciones = {}) => {
        const r = prng(semilla);
        // Milisegundos desde una fecha fija y, dentro del milisegundo, bits aleatorios: así lo
        // hace Guid.CreateVersion7 en .NET 9 (no hay contador), por eso dos GUID del mismo ms
        // no quedan ordenados entre sí. Las inserciones por ms son configurables.
        const porMs = Math.max(1, opciones.insercionesPorMs || 20);
        let ms = 1760000000000, enEsteMs = 0;
        return () => {
          if (++enEsteMs > porMs) { ms += 1; enEsteMs = 1; }
          const tiempo = hex(ms, 12);
          let azar = "";
          for (let i = 0; i < 5; i++) azar += hex(Math.floor(r() * 65536), 4);
          const h = tiempo + "7" + azar.slice(0, 3) + (8 + Math.floor(r() * 4)).toString(16) + azar.slice(3, 18);
          return uuidDesde(h);
        };
      },
    },
    "guid-secuencial": {
      nombre: "GUID secuencial estricto (NEWSEQUENTIALID, EF Core)",
      bytes: 16,
      crear: () => {
        // Monótono siempre, como NEWSEQUENTIALID() dentro de un arranque del servidor o el
        // SequentialGuidValueGenerator de EF Core (que respeta el orden raro de SQL Server).
        let n = 0;
        return () => uuidDesde(hex(++n, 32));
      },
    },
  };

  /* ------------------------------------------------------------ B+tree */
  function capacidadHoja(bytesClave, bytesCarga) {
    return Math.max(2, Math.floor((PAGINA - CABECERA) / (bytesClave + bytesCarga + OVERHEAD_FILA)));
  }
  function capacidadInterna(bytesClave) {
    return Math.max(3, Math.floor((PAGINA - CABECERA) / (bytesClave + PUNTERO)));
  }

  /* opciones:
       bytesClave, bytesCarga: tamaño de la clave y del resto de la fila (en la hoja)
       division: qué pasa cuando se llena la última hoja y la fila nueva va al final:
         "fin"     la página nueva arranca con esa fila sola y la vieja queda llena (SQL Server)
         "derecha" la vieja queda al 90 % y el resto pasa a la nueva (PostgreSQL, fillfactor 90)
         "mitad"   50/50 siempre, como en el B-tree de libro
       En cualquier otra posición la división es siempre 50/50. */
  function crearArbol(opciones) {
    const capHoja = opciones.capacidadHoja || capacidadHoja(opciones.bytesClave, opciones.bytesCarga);
    const capInterna = opciones.capacidadInterna || capacidadInterna(opciones.bytesClave);
    const division = opciones.division || "fin";
    let proximaPagina = 0;
    const nuevaHoja = () => ({ hoja: true, id: proximaPagina++, claves: [], siguiente: null });
    const nuevoInterno = () => ({ hoja: false, id: proximaPagina++, claves: [], hijos: [] });
    let raiz = nuevaHoja();
    const primeraHoja = raiz;
    const stats = { inserciones: 0, divisionesHoja: 0, divisionesInternas: 0, hojas: 1, internos: 0,
      paginasEscritas: 0, altura: 1 };
    // Hojas tocadas por ventana de inserciones, para medir cuántas páginas distintas se escriben.
    let ventana = new Set();

    // Primer índice cuya clave es >= k (búsqueda binaria).
    function limiteInferior(arr, k) {
      let lo = 0, hi = arr.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < k) lo = m + 1; else hi = m; }
      return lo;
    }
    function hijoPara(nodo, k) {
      // claves[i] es la menor clave del hijo i+1
      let lo = 0, hi = nodo.claves.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (nodo.claves[m] <= k) lo = m + 1; else hi = m; }
      return lo;
    }

    function insertar(k) {
      stats.inserciones++;
      const camino = [];
      let nodo = raiz;
      while (!nodo.hoja) { camino.push(nodo); nodo = nodo.hijos[hijoPara(nodo, k)]; }
      const pos = limiteInferior(nodo.claves, k);
      if (nodo.claves[pos] === k) return false; // clave repetida: no entra
      nodo.claves.splice(pos, 0, k);
      ventana.add(nodo.id);
      stats.paginasEscritas++;
      if (nodo.claves.length <= capHoja) return true;

      // División de hoja.
      stats.divisionesHoja++;
      const esUltima = nodo.siguiente === null && pos === nodo.claves.length - 1;
      let corte = Math.ceil(nodo.claves.length / 2);
      if (esUltima && division === "fin") corte = nodo.claves.length - 1;
      else if (esUltima && division === "derecha") corte = Math.max(1, Math.floor(capHoja * 0.9));
      const nueva = nuevaHoja();
      nueva.claves = nodo.claves.splice(corte);
      nueva.siguiente = nodo.siguiente;
      nodo.siguiente = nueva;
      stats.hojas++;
      stats.paginasEscritas += 2;
      ventana.add(nueva.id);
      let separador = nueva.claves[0];
      let derecho = nueva;

      // Subir el separador por el camino, dividiendo internos si hace falta.
      for (let i = camino.length - 1; i >= 0; i--) {
        const padre = camino[i];
        const idx = hijoPara(padre, separador);
        padre.claves.splice(idx, 0, separador);
        padre.hijos.splice(idx + 1, 0, derecho);
        stats.paginasEscritas++;
        if (padre.claves.length <= capInterna) return true;
        stats.divisionesInternas++;
        const medio = padre.claves.length >> 1;
        const nuevo = nuevoInterno();
        separador = padre.claves[medio];
        nuevo.claves = padre.claves.splice(medio + 1);
        padre.claves.splice(medio, 1);
        nuevo.hijos = padre.hijos.splice(medio + 1);
        stats.internos++;
        stats.paginasEscritas += 2;
        derecho = nuevo;
      }
      // Se dividió la raíz: nueva raíz.
      const nuevaRaiz = nuevoInterno();
      nuevaRaiz.claves = [separador];
      nuevaRaiz.hijos = [raiz, derecho];
      raiz = nuevaRaiz;
      stats.internos++;
      stats.altura++;
      stats.paginasEscritas++;
      return true;
    }

    function buscar(k) {
      let nodo = raiz;
      while (!nodo.hoja) nodo = nodo.hijos[hijoPara(nodo, k)];
      const pos = limiteInferior(nodo.claves, k);
      return nodo.claves[pos] === k;
    }

    // Recorre las hojas en orden lógico.
    function hojas() {
      const lista = [];
      for (let h = primeraHoja; h; h = h.siguiente) lista.push(h);
      return lista;
    }

    function medir() {
      const lista = hojas();
      let claves = 0, saltos = 0;
      for (let i = 0; i < lista.length; i++) {
        claves += lista[i].claves.length;
        if (i + 1 < lista.length && lista[i + 1].id !== lista[i].id + 1) saltos++;
      }
      const paginasTotales = stats.hojas + stats.internos;
      return {
        claves, hojas: stats.hojas, internos: stats.internos, altura: stats.altura,
        divisionesHoja: stats.divisionesHoja, divisionesInternas: stats.divisionesInternas,
        paginasEscritas: stats.paginasEscritas,
        llenado: claves / (stats.hojas * capHoja),
        fragmentacion: lista.length > 1 ? saltos / (lista.length - 1) : 0,
        bytes: paginasTotales * PAGINA,
        bytesHojas: stats.hojas * PAGINA,
        capacidadHoja: capHoja, capacidadInterna: capInterna,
      };
    }

    function hojasTocadas() { return ventana.size; }
    function reiniciarVentana() { ventana = new Set(); }

    return { insertar, buscar, hojas, medir, hojasTocadas, reiniciarVentana, capHoja, capInterna };
  }

  /* ------------------------------------------------------------ escenarios */
  // Corre un escenario entero y devuelve las mediciones y una serie para graficar.
  // opciones: { tipo, n, bytesCarga, division, semilla, muestras, ventana, insercionesPorMs }
  function correr(opciones) {
    const gen = GENERADORES[opciones.tipo];
    if (!gen) throw new Error("tipo de clave desconocido: " + opciones.tipo);
    const n = opciones.n;
    const arbol = crearArbol({ bytesClave: gen.bytes, bytesCarga: opciones.bytesCarga, division: opciones.division });
    const siguiente = gen.crear(opciones.semilla || 1, { insercionesPorMs: opciones.insercionesPorMs });
    const muestras = opciones.muestras || 50;
    const cadaCuanto = Math.max(1, Math.floor(n / muestras));
    const ventana = Math.min(opciones.ventana || 1000, n);
    const serie = [];
    let repetidas = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n - ventana + 1) arbol.reiniciarVentana();
      if (!arbol.insertar(siguiente())) repetidas++;
      if (i % cadaCuanto === 0 || i === n) {
        const m = arbol.medir();
        serie.push({ i, llenado: m.llenado, hojas: m.hojas, divisiones: m.divisionesHoja });
      }
    }
    const m = arbol.medir();
    return Object.assign(m, {
      tipo: opciones.tipo, nombre: gen.nombre, bytesClave: gen.bytes, n, repetidas,
      hojasCalientes: arbol.hojasTocadas(), ventana, serie,
    });
  }

  // Versión por pasos, para no congelar el navegador: devuelve un iterador que avanza de a
  // `paso` inserciones y al final entrega el resultado.
  function* correrPorPasos(opciones, paso = 5000) {
    const gen = GENERADORES[opciones.tipo];
    const n = opciones.n;
    const arbol = crearArbol({ bytesClave: gen.bytes, bytesCarga: opciones.bytesCarga, division: opciones.division });
    const siguiente = gen.crear(opciones.semilla || 1, { insercionesPorMs: opciones.insercionesPorMs });
    const muestras = opciones.muestras || 50;
    const cadaCuanto = Math.max(1, Math.floor(n / muestras));
    const ventana = Math.min(opciones.ventana || 1000, n);
    const serie = [];
    let repetidas = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n - ventana + 1) arbol.reiniciarVentana();
      if (!arbol.insertar(siguiente())) repetidas++;
      if (i % cadaCuanto === 0 || i === n) {
        const m = arbol.medir();
        serie.push({ i, llenado: m.llenado, hojas: m.hojas, divisiones: m.divisionesHoja });
      }
      if (i % paso === 0 && i < n) yield { hecho: i, total: n };
    }
    const m = arbol.medir();
    return Object.assign(m, {
      tipo: opciones.tipo, nombre: gen.nombre, bytesClave: gen.bytes, n, repetidas,
      hojasCalientes: arbol.hojasTocadas(), ventana, serie,
    });
  }

  /* ------------------------------------------------------------ formato */
  function fmtEntero(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function fmtBytes(b) {
    if (b >= 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2).replace(".", ",") + " GB";
    if (b >= 1024 * 1024) return (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
    if (b >= 1024) return (b / 1024).toFixed(0) + " KB";
    return b + " B";
  }
  function fmtPorcentaje(x, dec = 0) { return (x * 100).toFixed(dec).replace(".", ",") + " %"; }

  return {
    PAGINA, CABECERA, OVERHEAD_FILA, PUNTERO, GENERADORES,
    prng, capacidadHoja, capacidadInterna, crearArbol, correr, correrPorPasos,
    fmtEntero, fmtBytes, fmtPorcentaje,
  };
});
