/* Lógica de «Expensas en criollo»: leer montos y texto pegado, clasificar rubros,
   comparar meses y validar lo que se importa. Sin DOM: se usa en el navegador y en Node. */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Logica = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const APP = "expensas-en-criollo";

  const CATEGORIAS = [
    { id: "sueldos", nombre: "Sueldos y cargas" },
    { id: "servicios", nombre: "Servicios (luz, agua, gas)" },
    { id: "abonos", nombre: "Abonos" },
    { id: "mantenimiento", nombre: "Mantenimiento y arreglos" },
    { id: "administracion", nombre: "Administración y banco" },
    { id: "seguros", nombre: "Seguros" },
    { id: "reserva", nombre: "Fondo de reserva" },
    { id: "otros", nombre: "Otros" },
  ];
  const IDS = CATEGORIAS.map((c) => c.id);

  /* El orden importa: gana la primera regla que coincide. */
  const REGLAS = [
    ["reserva", /\bfondo\b.*\b(reserva|obras?|previsional)\b|\breserva\b/],
    ["sueldos", /\b(sueldos?|haberes|jornales|aguinaldo|sac|cargas sociales|suterh|fateryh|seracarh|sindicato|aportes|contribuciones|encargad[oa]|suplente|ayudante|portero|vacaciones|horas extras?|indemnizacion|art|f ?931)\b/],
    ["seguros", /\b(seguros?|poliza|aseguradora)\b/],
    ["administracion", /\b(honorarios|administracion|administradora?|bancari[oa]s?|banco|comision(es)?|impuesto al cheque|debitos y creditos|papeleria|fotocopias|franqueo|libreria|sistema de expensas|escribania|abogad[oa])\b/],
    ["abonos", /\babonos?\b/],
    ["mantenimiento", /\b(reparacion(es)?|arreglos?|repuestos?|cambio|reemplazo|obras?|pintura|plomeria|plomero|electricista|destapacion|impermeabilizacion|albanileria|cerrajer[oi]a?|vidrios?|herreria|mantenimiento|materiales|ferreteria|(art|articulos|elementos|insumos|productos) de limpieza|matafuegos|extintores)\b/],
    ["servicios", /\b(luz|electricidad|energia|edesur|edenor|epec|epe|edea|agua|aysa|gas|metrogas|naturgy|camuzzi|ecogas|telefono|telefonia|internet|cable|abl|municipal(es)?|tasas?)\b/],
    ["abonos", /\b(ascensor(es)?|fumigacion|desinfeccion|desratizacion|vigilancia|seguridad|monitoreo|alarma|camaras|bombas?|limpieza|jardineria|pileta|piscina|tanques?|porton(es)?|caldera)\b/],
  ];

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function sinAcentos(s) {
    return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  function redondear(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  const palabras = (s) => sinAcentos(s).replace(/[^a-z0-9]+/g, " ").trim();

  function categorizar(nombre) {
    const t = palabras(nombre);
    /* «Art. de limpieza» es de artículos, no de la ART. */
    if (/\bart de limpieza\b/.test(t)) return "mantenimiento";
    for (const [id, re] of REGLAS) if (re.test(t)) return id;
    return "otros";
  }

  /* Identidad de un rubro entre meses: sin acentos, sin números de factura, cuotas ni mes. */
  function clave(nombre) {
    const base = palabras(nombre);
    const limpio = base
      .replace(/\b(factura|fc|fact|recibo|comprobante|periodo|cuota|nro|numero|n)\b/g, " ")
      .replace(/\b\d+\b/g, " ")
      .replace(new RegExp("\\b(" + MESES.join("|") + "|setiembre)\\b", "g"), " ")
      .replace(/\s+/g, " ")
      .trim();
    return limpio || base;
  }

  /* "1.234.567,89", "1,234,567.89", "$ 1.000", "(500)", "500,00-" → número. Si no es un monto, null. */
  function parsearMonto(texto) {
    if (typeof texto === "number") return Number.isFinite(texto) ? redondear(texto) : null;
    let s = String(texto == null ? "" : texto).replace(/[\s $]/g, "");
    let signo = 1;
    if (/^\(.*\)$/.test(s)) { signo = -1; s = s.slice(1, -1); }
    if (/^[-−]/.test(s)) { signo = -signo; s = s.slice(1); }
    else if (/[-−]$/.test(s)) { signo = -signo; s = s.slice(0, -1); }
    if (!/^\d+([.,]\d+)*$/.test(s)) return null;
    let n;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3}){2,}(\.\d+)?$/.test(s) || /^\d{1,3}(,\d{3})+\.\d+$/.test(s)) n = s.replace(/,/g, "");
    else if (/^\d+,\d+$/.test(s)) n = s.replace(",", ".");
    else if (/^\d+(\.\d{1,2})?$/.test(s)) n = s;
    else return null;
    const v = Number(n) * signo;
    return Number.isFinite(v) && Math.abs(v) < 1e13 ? redondear(v) : null;
  }

  /* Texto copiado de la liquidación: un rubro por renglón, con el importe al final.
     Con varias columnas de importes se toma la última. */
  function leerTexto(texto) {
    const rubros = [];
    const ignorados = [];
    let total = null;
    /* El signo va pegado al número: un guion suelto es una columna vacía o un separador. */
    const MONTO = /(^|[\s:$])(\(?\s?(?:[-−]\$?\s?|\$\s?[-−]?)?\d[\d.,]*\s?\)?[-−]?)$/;
    for (const original of String(texto || "").split(/\r?\n/)) {
      let l = original.replace(/ /g, " ").replace(/\.{2,}|_{2,}|…/g, " ").replace(/["\t|;]/g, "  ").trim();
      if (!l) continue;
      l = l.replace(/(\s+-?\d+([.,]\d+)?\s?%)+$/, "").trim();
      const m = l.match(MONTO);
      const crudo = m ? m[2].trim() : "";
      const monto = m ? parsearMonto(crudo) : null;
      let nombre = m ? l.slice(0, m.index + m[1].length) : "";
      /* Las columnas de importes anteriores quedan pegadas al nombre: se sacan. */
      nombre = nombre.replace(/[\s$:]+$/, "")
        .replace(/(\s+\$?\s?(-?\d{1,3}(\.\d{3})+(,\d+)?|-?\d+,\d{2}|-))+$/, "")
        .replace(/^[\s\-–•*·]+/, "")
        .replace(/[\s$:,.\-–]+$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      const pareceAnio = /^(19|20)\d\d$/.test(crudo) && !/\$\s*\d+$/.test(l);
      if (monto === null || pareceAnio || !/[a-záéíóúñ]/i.test(nombre)) { ignorados.push(original.trim()); continue; }
      const plano = sinAcentos(nombre);
      if (/^(total|totales|sub ?total|saldo)\b/.test(plano)) {
        if (/^total/.test(plano)) total = monto;
        ignorados.push(original.trim());
        continue;
      }
      if (monto === 0) { ignorados.push(original.trim()); continue; }
      rubros.push({ nombre: nombre.slice(0, 120), categoria: categorizar(nombre), monto });
    }
    return { rubros, ignorados, total, suma: sumar(rubros) };
  }

  function sumar(rubros) {
    return redondear(rubros.reduce((a, r) => a + r.monto, 0));
  }

  const esMes = (m) => typeof m === "string" && /^(19|20)\d\d-(0[1-9]|1[0-2])$/.test(m);

  function mesSiguiente(m) {
    let [a, n] = m.split("-").map(Number);
    n += 1;
    if (n > 12) { n = 1; a += 1; }
    return a + "-" + String(n).padStart(2, "0");
  }

  function rangoMeses(desde, hasta) {
    const lista = [];
    for (let m = desde; m <= hasta && lista.length < 600; m = mesSiguiente(m)) lista.push(m);
    return lista;
  }

  function nombreMes(m) {
    const [a, n] = m.split("-").map(Number);
    return MESES[n - 1] + " " + a;
  }

  /* Inflación acumulada (en %) entre dos meses: compone los meses posteriores a «desde»
     hasta «hasta» inclusive. Si falta alguno, null. */
  function inflacionEntre(inflacion, desde, hasta) {
    if (!(desde < hasta)) return null;
    let factor = 1;
    for (const m of rangoMeses(mesSiguiente(desde), hasta)) {
      const v = inflacion ? inflacion[m] : undefined;
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      factor *= 1 + v / 100;
    }
    return (factor - 1) * 100;
  }

  const variacion = (antes, ahora) => (antes > 0 ? ((ahora - antes) / antes) * 100 : null);

  function mediana(valores) {
    if (!valores.length) return null;
    const v = [...valores].sort((a, b) => a - b);
    const i = Math.floor(v.length / 2);
    return v.length % 2 ? v[i] : (v[i - 1] + v[i]) / 2;
  }

  /* Rubros de un mes agrupados por clave (los repetidos se suman). */
  function agrupar(rubros) {
    const mapa = new Map();
    for (const r of rubros) {
      const k = clave(r.nombre);
      const g = mapa.get(k);
      if (g) g.monto = redondear(g.monto + r.monto);
      else mapa.set(k, { clave: k, nombre: r.nombre, categoria: r.categoria, monto: r.monto });
    }
    return mapa;
  }

  const AJUSTES = { puntos: 10, peso: 1 };
  /* Con menos rubros comparables, la mediana no dice nada. */
  const MINIMO_MEDIANA = 3;

  /* Compara un mes con el anterior cargado.
     Un rubro «salta» si quedó más de `puntos` puntos arriba de la referencia (la inflación;
     si no está cargada, la mediana de los rubros) y la plata de más es al menos el `peso` %
     del total del mes. Un rubro nuevo salta si pesa al menos ese `peso` %. */
  function analizar(datos, mes) {
    const meses = ordenar(datos.meses);
    const i = meses.findIndex((m) => m.mes === mes);
    if (i < 0) return null;
    const actual = meses[i];
    const previo = i > 0 ? meses[i - 1] : null;
    const ajustes = Object.assign({}, AJUSTES, datos.ajustes);
    const total = sumar(actual.rubros);
    const totalPrevio = previo ? sumar(previo.rubros) : null;
    const inflacion = previo ? inflacionEntre(datos.inflacion, previo.mes, actual.mes) : null;
    const ahora = agrupar(actual.rubros);
    const antes = previo ? agrupar(previo.rubros) : new Map();

    let referencia = inflacion;
    let tipoReferencia = inflacion === null ? null : "inflacion";
    if (previo && inflacion === null) {
      const vs = [];
      for (const [k, r] of ahora) {
        const a = antes.get(k);
        const v = a ? variacion(a.monto, r.monto) : null;
        if (v !== null) vs.push(v);
      }
      if (vs.length >= MINIMO_MEDIANA) {
        referencia = mediana(vs);
        tipoReferencia = "mediana";
      }
    }

    const comparar = (montoAntes, montoAhora) => {
      const diferencia = previo ? redondear(montoAhora - montoAntes) : null;
      const pct = previo ? variacion(montoAntes, montoAhora) : null;
      return {
        monto: montoAhora,
        anterior: previo ? montoAntes : null,
        diferencia,
        variacion: pct,
        real: pct !== null && inflacion !== null ? ((1 + pct / 100) / (1 + inflacion / 100) - 1) * 100 : null,
        exceso: previo && inflacion !== null ? redondear(montoAhora - montoAntes * (1 + inflacion / 100)) : null,
        peso: total > 0 ? (montoAhora / total) * 100 : 0,
      };
    };

    const minimo = (Math.abs(total) * ajustes.peso) / 100;
    const claves = new Set([...ahora.keys(), ...antes.keys()]);
    const rubros = [...claves].map((k) => {
      const r = ahora.get(k);
      const a = antes.get(k);
      const fila = Object.assign(
        { clave: k, nombre: (r || a).nombre, categoria: (r || a).categoria },
        comparar(a ? a.monto : 0, r ? r.monto : 0)
      );
      fila.estado = !previo ? "sin-comparar" : !a ? "nuevo" : !r ? "no-esta" : fila.diferencia > 0 ? "subio" : fila.diferencia < 0 ? "bajo" : "igual";
      fila.salto = null;
      fila.deMas = null;
      if (fila.estado === "nuevo" && fila.monto > 0 && fila.monto >= minimo) fila.salto = "nuevo";
      else if (r && a && fila.variacion !== null && referencia !== null) {
        const deMas = fila.monto - a.monto * (1 + referencia / 100);
        if (fila.variacion - referencia > ajustes.puntos && deMas >= minimo) {
          fila.salto = "suba";
          fila.deMas = redondear(deMas);
        }
      }
      /* Cuánto venía variando por mes en los meses cargados antes de esta comparación. */
      const pasos = [];
      for (let j = 1; j < i; j++) {
        if (mesSiguiente(meses[j - 1].mes) !== meses[j].mes) continue;
        const x = agrupar(meses[j - 1].rubros).get(k);
        const y = agrupar(meses[j].rubros).get(k);
        const v = x && y ? variacion(x.monto, y.monto) : null;
        if (v !== null) pasos.push(v);
      }
      fila.habitual = pasos.length ? pasos.reduce((s, v) => s + v, 0) / pasos.length : null;
      return fila;
    });
    rubros.sort((a, b) => b.monto - a.monto || (a.diferencia || 0) - (b.diferencia || 0));

    const porCategoria = (lista, id) => sumar(lista.filter((r) => r.categoria === id));
    const categorias = CATEGORIAS.map((c) => {
      const m = porCategoria(actual.rubros, c.id);
      const a = previo ? porCategoria(previo.rubros, c.id) : 0;
      return Object.assign({ id: c.id, nombre: c.nombre }, comparar(a, m));
    }).filter((c) => c.monto !== 0 || (c.anterior || 0) !== 0).sort((a, b) => b.monto - a.monto);

    const general = comparar(totalPrevio || 0, total);
    const subas = rubros.filter((r) => r.diferencia > 0).sort((a, b) => b.diferencia - a.diferencia);
    const bajas = rubros.filter((r) => r.diferencia < 0).sort((a, b) => a.diferencia - b.diferencia);
    const saltos = rubros.filter((r) => r.salto).sort((a, b) => (b.deMas || b.monto) - (a.deMas || a.monto));

    return {
      mes: actual.mes,
      previo: previo ? previo.mes : null,
      saltea: previo ? mesSiguiente(previo.mes) !== actual.mes : false,
      total, totalPrevio, inflacion, referencia, tipoReferencia,
      diferencia: general.diferencia,
      variacion: general.variacion,
      real: general.real,
      exceso: general.exceso,
      categorias, rubros, subas, bajas, saltos, ajustes,
    };
  }

  /* Con espacios de no separación, para que un importe no se corte entre renglones. */
  const formatoPesos = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
  const pesos = (n) => (n < 0 && Math.round(Math.abs(n)) !== 0 ? "-" : "") + "$ " + formatoPesos.format(Math.round(Math.abs(n)));
  const formatoPct = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
  const porcentaje = (n) => formatoPct.format(Math.abs(n) < 0.05 ? 0 : n) + " %";
  const conSigno = (n, f) => (f(n) !== f(0) && n > 0 ? "+" : "") + f(n);

  /* El resumen en castellano de todos los días. */
  function enCriollo(a) {
    if (!a.previo) return ["En " + nombreMes(a.mes) + " los gastos cargados suman " + pesos(a.total) + ". Cargá un mes anterior para ver qué cambió."];
    const frases = [];
    const d = a.diferencia;
    const igual = Math.round(Math.abs(d)) === 0;
    let f = "Los gastos de " + nombreMes(a.mes) + " " + (igual ? "quedaron igual" : d > 0 ? "subieron" : "bajaron");
    if (!igual) f += (a.variacion !== null ? " " + porcentaje(Math.abs(a.variacion)) : "") + " (" + pesos(Math.abs(d)) + ")";
    f += " contra " + nombreMes(a.previo) + ".";
    frases.push(f);
    if (a.inflacion === null) frases.push("Falta cargar la inflación para saber si eso es mucho o poco.");
    else if (a.real !== null) {
      const base = "La inflación " + (a.saltea ? "acumulada " : "") + "fue " + porcentaje(a.inflacion);
      if (Math.abs(a.real) < 0.5) frases.push(base + ": quedaron parejos con la inflación.");
      else frases.push(base + ": descontándola, " + (a.real > 0 ? "subieron " : "bajaron ") + porcentaje(Math.abs(a.real)) + " (" + pesos(Math.abs(a.exceso)) + (a.real > 0 ? " de más)." : " de menos)."));
    }
    const lista = d >= 0 ? a.subas : a.bajas;
    if (lista.length && !igual) {
      const top = lista.slice(0, 3).map((r) => r.nombre + " (" + conSigno(r.diferencia, pesos) + ")");
      const union = top.length > 1 ? top.slice(0, -1).join(", ") + " y " + top[top.length - 1] : top[0];
      frases.push("Lo que más " + (d >= 0 ? "empujó para arriba: " : "bajó: ") + union + ".");
    }
    return frases;
  }

  function preguntas(a) {
    return a.saltos.slice(0, 8).map((r) => {
      if (r.salto === "nuevo") return "¿Qué es «" + r.nombre + "» (" + pesos(r.monto) + ")? No figuraba en " + nombreMes(a.previo) + ". ¿Es por única vez o se repite?";
      return "¿Por qué «" + r.nombre + "» pasó de " + pesos(r.anterior) + " a " + pesos(r.monto) + " (" + conSigno(r.variacion, porcentaje) + ") entre " + nombreMes(a.previo) + " y " + nombreMes(a.mes) + "? ¿Hay factura o presupuesto?";
    });
  }

  function ordenar(meses) {
    return [...meses].sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
  }

  function vacio() {
    return { app: APP, version: 1, ejemplo: false, coeficiente: null, ajustes: { ...AJUSTES }, inflacion: {}, meses: [] };
  }

  const numeroEntre = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

  /* Valida y limpia un objeto importado o guardado. Tira Error con un mensaje para mostrar. */
  function validar(obj) {
    if (!obj || typeof obj !== "object" || obj.app !== APP) throw new Error("El archivo no es de Expensas en criollo.");
    if (obj.version !== 1) throw new Error("El archivo es de una versión que esta app no conoce.");
    if (!Array.isArray(obj.meses) || obj.meses.length > 600) throw new Error("El archivo no trae una lista de meses válida.");
    const d = vacio();
    d.ejemplo = obj.ejemplo === true;
    if (numeroEntre(obj.coeficiente, 0, 100)) d.coeficiente = obj.coeficiente;
    const aj = obj.ajustes || {};
    if (numeroEntre(aj.puntos, 0, 1000)) d.ajustes.puntos = aj.puntos;
    if (numeroEntre(aj.peso, 0, 100)) d.ajustes.peso = aj.peso;
    for (const [m, v] of Object.entries(obj.inflacion || {})) if (esMes(m) && numeroEntre(v, -50, 500)) d.inflacion[m] = v;
    const vistos = new Set();
    for (const m of obj.meses) {
      if (!m || !esMes(m.mes) || !Array.isArray(m.rubros) || m.rubros.length > 1000) throw new Error("Hay un mes mal armado en el archivo.");
      if (vistos.has(m.mes)) throw new Error("El mes " + nombreMes(m.mes) + " está repetido.");
      vistos.add(m.mes);
      const rubros = m.rubros.map((r) => {
        const nombre = r && typeof r.nombre === "string" ? r.nombre.trim().slice(0, 120) : "";
        if (!nombre || !numeroEntre(r.monto, -1e13, 1e13)) throw new Error("Hay un rubro sin nombre o sin importe en " + nombreMes(m.mes) + ".");
        return { nombre, categoria: IDS.includes(r.categoria) ? r.categoria : categorizar(nombre), monto: redondear(r.monto) };
      });
      d.meses.push({ mes: m.mes, rubros });
    }
    d.meses = ordenar(d.meses);
    return d;
  }

  /* Un consorcio inventado de punta a punta, para mostrar cómo se lee. */
  function ejemplo() {
    const filas = [
      ["Sueldo y adicionales del encargado", 1180000, 1204000, 1233000],
      ["Cargas sociales y aportes", 590000, 602000, 616000],
      ["Luz de espacios comunes", 214000, 219000, 306000],
      ["Agua", 168000, 168000, 172000],
      ["Gas", 96000, 99000, 101000],
      ["Abono ascensores", 232000, 237000, 243000],
      ["Abono fumigación", 38000, 39000, 40000],
      ["Artículos de limpieza", 64000, 61000, 62000],
      ["Reparación de la bomba de agua", 0, 0, 385000],
      ["Destapación de cañería pluvial", 0, 92000, 0],
      ["Honorarios de administración", 340000, 340000, 408000],
      ["Gastos bancarios", 41000, 43000, 44000],
      ["Seguro integral del edificio", 127000, 130000, 133000],
      ["Fondo de reserva", 155000, 160000, 175000],
    ];
    const d = vacio();
    d.ejemplo = true;
    d.coeficiente = 4.2;
    d.inflacion = { "2026-09": 2.0, "2026-10": 2.3 };
    d.meses = ["2026-08", "2026-09", "2026-10"].map((mes, i) => ({
      mes,
      rubros: filas.filter((f) => f[i + 1]).map((f) => ({ nombre: f[0], categoria: categorizar(f[0]), monto: f[i + 1] })),
    }));
    return d;
  }

  return {
    APP, CATEGORIAS, categorizar, clave, parsearMonto, leerTexto, sumar, esMes, mesSiguiente, rangoMeses, nombreMes,
    inflacionEntre, analizar, enCriollo, preguntas, ordenar, vacio, validar, ejemplo, pesos, porcentaje, conSigno, redondear,
  };
});
