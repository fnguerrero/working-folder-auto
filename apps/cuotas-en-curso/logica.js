/* Cuotas en curso — lógica pura, sin DOM.
   Se carga en el navegador (queda en window.Cuotas) y en Node (module.exports),
   para que los tests corran con `node --test` sin ningún arreglo especial. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module && module.exports) module.exports = fabrica();
  else raiz.Cuotas = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const CLAVE = "cuotas-en-curso.v1";
  const MAX_CUOTAS = 72;
  const PALETA = ["#4f7cff", "#ff8a3d", "#2ec4a6", "#e05297", "#b58cff", "#f2c94c"];
  const SIN_TARJETA = "Sin tarjeta";
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];
  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct",
    "nov", "dic"];

  /* ------------------------------------------------------------ meses */
  // Un mes es "AAAA-MM". Para operar se pasa a un entero (año * 12 + mes - 1),
  // así no intervienen Date ni los husos horarios.
  const esMes = (ym) => typeof ym === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
  const esFecha = (f) => typeof f === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(f);

  function indiceMes(ym) {
    const [a, m] = ym.split("-").map(Number);
    return a * 12 + (m - 1);
  }
  function mesDeIndice(i) {
    const a = Math.floor(i / 12), m = i - a * 12 + 1;
    return a + "-" + String(m).padStart(2, "0");
  }
  const sumarMeses = (ym, n) => mesDeIndice(indiceMes(ym) + n);
  const diferenciaMeses = (desde, hasta) => indiceMes(hasta) - indiceMes(desde);
  const mesDeFecha = (fecha) => fecha.slice(0, 7);

  function mesActual(hoy) {
    const d = hoy || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }
  function fechaActual(hoy) {
    const d = hoy || new Date();
    return mesActual(d) + "-" + String(d.getDate()).padStart(2, "0");
  }
  function nombreMes(ym, corto) {
    const [a, m] = ym.split("-").map(Number);
    const nombre = (corto ? MESES_CORTOS : MESES)[m - 1];
    return corto ? nombre + " " + String(a).slice(2) : nombre + " " + a;
  }

  /* --------------------------------------------------------- importes */
  // Los importes viven en centavos enteros: nada de sumar flotantes.
  function aCentavos(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
    if (typeof valor !== "string") return NaN;
    let t = valor.trim().replace(/\s|\$/g, "");
    if (!t) return NaN;
    // "120.000,50" (formato argentino) o "120000.50" (teclado numérico).
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100);
  }
  function formatoPesos(centavos, conCentavos) {
    const signo = centavos < 0 ? "-" : "";
    const abs = Math.abs(Math.round(centavos));
    const enteros = Math.floor(abs / 100), resto = abs % 100;
    const miles = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const dec = conCentavos || resto ? "," + String(resto).padStart(2, "0") : "";
    return signo + "$ " + miles + dec;
  }
  const porcentaje = (v) => String(Math.round(v * 10) / 10).replace(".", ",") + " %";

  /* ---------------------------------------------------------- compras */
  function nuevoId() {
    return "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  }
  const limpiarTexto = (t) => String(t == null ? "" : t).replace(/\s+/g, " ").trim();

  /* Toma lo que viene del formulario (o de un import) y devuelve
     {ok, compra, errores}. Nunca tira: los errores vuelven por nombre de campo. */
  function normalizarCompra(entrada, hoy) {
    const e = entrada || {};
    const errores = {};
    const desc = limpiarTexto(e.desc);
    if (!desc) errores.desc = "Poné qué compraste.";
    const fecha = esFecha(e.fecha) ? e.fecha : "";
    if (!fecha) errores.fecha = "La fecha no es válida.";
    const total = Number.isInteger(e.total) ? e.total : aCentavos(e.total);
    if (!(total > 0)) errores.total = "El total tiene que ser mayor a cero.";
    const cuotas = Number(e.cuotas);
    if (!Number.isInteger(cuotas) || cuotas < 1 || cuotas > MAX_CUOTAS)
      errores.cuotas = "Las cuotas van de 1 a " + MAX_CUOTAS + ".";
    let primeraCuota = e.primeraCuota;
    if (!primeraCuota && fecha) primeraCuota = sumarMeses(mesDeFecha(fecha), 1);
    if (!esMes(primeraCuota)) errores.primeraCuota = "El mes de la primera cuota no es válido.";
    const tarjeta = limpiarTexto(e.tarjeta) || SIN_TARJETA;
    const compra = {
      id: typeof e.id === "string" && e.id ? e.id : nuevoId(),
      desc, tienda: limpiarTexto(e.tienda), fecha, total, cuotas, primeraCuota, tarjeta,
      nota: limpiarTexto(e.nota),
    };
    return { ok: Object.keys(errores).length === 0, compra, errores };
  }

  /* Las cuotas son iguales; el redondeo al centavo va a la última. */
  function cuotasDe(compra) {
    const base = Math.floor(compra.total / compra.cuotas);
    const salida = [];
    for (let n = 1; n <= compra.cuotas; n++) {
      const importe = n === compra.cuotas ? compra.total - base * (compra.cuotas - 1) : base;
      salida.push({ n, de: compra.cuotas, mes: sumarMeses(compra.primeraCuota, n - 1), importe });
    }
    return salida;
  }
  const ultimaCuota = (compra) => sumarMeses(compra.primeraCuota, compra.cuotas - 1);

  /* Estado de una compra visto desde `mes`: la cuota del mes en curso cuenta
     como pendiente (todavía no llegó el resumen). */
  function estadoCompra(compra, mes) {
    const cuotas = cuotasDe(compra);
    const pagadas = cuotas.filter((c) => indiceMes(c.mes) < indiceMes(mes));
    const pendientes = cuotas.filter((c) => indiceMes(c.mes) >= indiceMes(mes));
    return {
      pagadas: pagadas.length,
      restantes: pendientes.length,
      pagado: pagadas.reduce((s, c) => s + c.importe, 0),
      saldo: pendientes.reduce((s, c) => s + c.importe, 0),
      ultimaCuota: ultimaCuota(compra),
      terminada: pendientes.length === 0,
      empezada: pagadas.length > 0 || indiceMes(compra.primeraCuota) <= indiceMes(mes),
      cuotaDelMes: cuotas.find((c) => c.mes === mes) || null,
    };
  }

  /* Tarjetas en orden de aparición, con un color fijo de la paleta. */
  function tarjetas(compras) {
    const vistas = [];
    compras.forEach((c) => { if (!vistas.includes(c.tarjeta)) vistas.push(c.tarjeta); });
    return vistas.map((nombre, i) => ({ nombre, color: PALETA[i % PALETA.length] }));
  }
  function colorTarjeta(lista, nombre) {
    const t = lista.find((x) => x.nombre === nombre);
    return t ? t.color : PALETA[lista.length % PALETA.length];
  }

  /* Cuotas agrupadas por mes, para `cantidad` meses a partir de `desde`. */
  function cuotasPorMes(compras, desde, cantidad) {
    const meses = [];
    for (let i = 0; i < cantidad; i++) {
      meses.push({ mes: sumarMeses(desde, i), total: 0, porTarjeta: {}, items: [] });
    }
    const porMes = Object.fromEntries(meses.map((m) => [m.mes, m]));
    compras.forEach((compra) => {
      cuotasDe(compra).forEach((c) => {
        const m = porMes[c.mes];
        if (!m) return;
        m.total += c.importe;
        m.porTarjeta[compra.tarjeta] = (m.porTarjeta[compra.tarjeta] || 0) + c.importe;
        m.items.push({
          compraId: compra.id, desc: compra.desc, tarjeta: compra.tarjeta,
          n: c.n, de: c.de, importe: c.importe, ultima: c.n === c.de,
          simulada: Boolean(compra.simulada),
        });
      });
    });
    meses.forEach((m) => m.items.sort((a, b) => b.importe - a.importe));
    return meses;
  }

  function resumenMes(compras, mes, tope) {
    const [m] = cuotasPorMes(compras, mes, 1);
    const porTarjeta = Object.entries(m.porTarjeta)
      .map(([tarjeta, total]) => ({ tarjeta, total }))
      .sort((a, b) => b.total - a.total);
    const hayTope = Number.isInteger(tope) && tope > 0;
    return {
      mes, total: m.total, porTarjeta, items: m.items,
      tope: hayTope ? tope : null,
      proporcion: hayTope ? m.total / tope : null,
      excedido: hayTope && m.total > tope,
      margen: hayTope ? tope - m.total : null,
      terminanEsteMes: m.items.filter((i) => i.ultima).length,
    };
  }

  /* ------------------------------------------------------ pesos de hoy */
  // Una cuota dentro de k meses, con inflación mensual i, hoy vale cuota / (1+i)^k.
  function valorPresente(centavos, mesesAdelante, inflacionPct) {
    const i = Number(inflacionPct) / 100;
    if (!(i > 0) || mesesAdelante <= 0) return Math.round(centavos);
    return Math.round(centavos / Math.pow(1 + i, mesesAdelante));
  }

  function saldos(compras, mes, inflacionPct) {
    const porCompra = compras.map((compra) => {
      const pendientes = cuotasDe(compra).filter((c) => indiceMes(c.mes) >= indiceMes(mes));
      const nominal = pendientes.reduce((s, c) => s + c.importe, 0);
      const presente = pendientes.reduce(
        (s, c) => s + valorPresente(c.importe, diferenciaMeses(mes, c.mes), inflacionPct), 0);
      return { id: compra.id, desc: compra.desc, tarjeta: compra.tarjeta, nominal, presente,
        restantes: pendientes.length };
    });
    return {
      nominal: porCompra.reduce((s, c) => s + c.nominal, 0),
      presente: porCompra.reduce((s, c) => s + c.presente, 0),
      porCompra: porCompra.filter((c) => c.nominal > 0).sort((a, b) => b.nominal - a.nominal),
    };
  }

  /* --------------------------------------------------------- simulador */
  function simular(compras, hipotetica, desde, cantidad, tope) {
    const sim = Object.assign({}, hipotetica, { id: "simulada", simulada: true });
    const meses = cuotasPorMes(compras.concat([sim]), desde, cantidad);
    const hayTope = Number.isInteger(tope) && tope > 0;
    const excedidos = hayTope ? meses.filter((m) => m.total > tope).map((m) => m.mes) : [];
    const sinSim = cuotasPorMes(compras, desde, cantidad);
    const yaExcedidos = hayTope ? sinSim.filter((m) => m.total > tope).map((m) => m.mes) : [];
    const picoCon = Math.max(0, ...meses.map((m) => m.total));
    const picoSin = Math.max(0, ...sinSim.map((m) => m.total));
    return {
      meses, excedidos,
      nuevosExcedidos: excedidos.filter((m) => !yaExcedidos.includes(m)),
      picoCon, picoSin,
      cuota: cuotasDe(sim)[0].importe,
      ultimaCuota: ultimaCuota(sim),
    };
  }

  /* ------------------------------------------------------------ estado */
  function estadoInicial() {
    return { v: VERSION, ajustes: { tope: null, inflacion: 3 }, compras: [] };
  }

  /* Acepta lo que haya en localStorage o en un archivo importado y devuelve
     siempre un estado válido. Las compras rotas se descartan y se cuentan. */
  function migrar(datos) {
    const base = estadoInicial();
    const descartadas = [];
    if (!datos || typeof datos !== "object") return { estado: base, descartadas };
    const aj = datos.ajustes || {};
    const tope = Number.isInteger(aj.tope) ? aj.tope : aCentavos(aj.tope);
    base.ajustes.tope = tope > 0 ? tope : null;
    const infl = Number(aj.inflacion);
    base.ajustes.inflacion = Number.isFinite(infl) && infl >= 0 && infl <= 100 ? infl : 3;
    const compras = Array.isArray(datos.compras) ? datos.compras : [];
    const ids = new Set();
    compras.forEach((c, i) => {
      const r = normalizarCompra(c);
      if (!r.ok || ids.has(r.compra.id)) { descartadas.push(i); return; }
      ids.add(r.compra.id);
      base.compras.push(r.compra);
    });
    return { estado: base, descartadas };
  }

  /* ------------------------------------------------------ export/import */
  function aJSON(estado, fecha) {
    return JSON.stringify({
      app: "cuotas-en-curso", v: VERSION,
      exportado: fecha || new Date().toISOString().slice(0, 10),
      ajustes: estado.ajustes, compras: estado.compras,
    }, null, 1);
  }

  function deJSON(texto) {
    let datos;
    try { datos = JSON.parse(texto); } catch (e) { return { error: "Eso no es un archivo JSON válido." }; }
    if (!datos || !Array.isArray(datos.compras)) return { error: "El archivo no tiene compras adentro." };
    const r = migrar(datos);
    return { estado: r.estado, descartadas: r.descartadas };
  }

  /* CSV con una fila por cuota, separado por ";" y con coma decimal, que es
     lo que abre bien el Excel en español sin pasar por el asistente. */
  function aCSV(compras) {
    const celda = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const importe = (c) => (c / 100).toFixed(2).replace(".", ",");
    const filas = [["mes", "compra", "tienda", "tarjeta", "cuota", "de", "importe"].join(";")];
    const lineas = [];
    compras.forEach((compra) => {
      cuotasDe(compra).forEach((c) => {
        lineas.push({ mes: c.mes, linea: [c.mes, celda(compra.desc), celda(compra.tienda),
          celda(compra.tarjeta), c.n, c.de, importe(c.importe)].join(";") });
      });
    });
    lineas.sort((a, b) => (a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0));
    return filas.concat(lineas.map((l) => l.linea)).join("\r\n") + "\r\n";
  }

  return {
    VERSION, CLAVE, MAX_CUOTAS, PALETA, SIN_TARJETA, MESES, MESES_CORTOS,
    esMes, esFecha, indiceMes, mesDeIndice, sumarMeses, diferenciaMeses, mesDeFecha,
    mesActual, fechaActual, nombreMes,
    aCentavos, formatoPesos, porcentaje,
    nuevoId, normalizarCompra, cuotasDe, ultimaCuota, estadoCompra, tarjetas, colorTarjeta,
    cuotasPorMes, resumenMes, valorPresente, saldos, simular,
    estadoInicial, migrar, aJSON, deJSON, aCSV,
  };
});
