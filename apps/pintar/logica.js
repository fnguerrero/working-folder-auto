/* Para pintar — cuentas de superficies, pintura, latas, pisos y zócalos. Sin dependencias; se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  /** Supuestos editables (los de la casa argentina de siempre). */
  const DEFAULTS = {
    puerta: { ancho: 0.8, alto: 2.05 }, ventana: { ancho: 1.2, alto: 1.1 },
    rendimiento: { latexInterior: 10, latexExterior: 8, cielorraso: 10, fijador: 12, sintetico: 12, enduido: 1 /* kg/m² en dos capas finas */ },
    manos: { clara: 2, oscura: 3, nueva: 2, exterior: 2, cielorraso: 2, sintetico: 2 },
    margen: 0.1, // 10 % por las dudas
    latas: { latex: [20, 10, 4, 1], cielorraso: [20, 10, 4, 1], fijador: [20, 10, 4, 1], sintetico: [4, 1, 0.5], enduido: [25, 6, 1.5] },
    piso: { tipo: "ceramico", largoCm: 45, anchoCm: 45, juntaMm: 3, espesorMm: 8, m2PorCaja: 1.62, diagonal: false, desperdicio: 0.1, desperdicioDiagonal: 0.15, pegamentoKgM2: { ceramico: 4, porcelanato: 5 }, bolsaPegamento: 30, bolsaPastina: 1, densidadPastina: 1.7 },
    ritmo: { m2PorHora: 12, secadoHoras: 4 }, // una persona con rodillo, una mano
  };
  const AREA_PUERTA_SINTETICO = 4; // m²: dos caras y marco
  const AREA_VENTANA_SINTETICO = 2; // m²: marco y hojas por las dos caras

  function ambienteNuevo(nombre) {
    return { nombre: nombre || "Ambiente", largo: 4, ancho: 3, alto: 2.6, puertas: 1, ventanas: 1, paredes: "clara", techo: true, aberturas: false, piso: false, zocalo: false, exterior: false };
  }
  function mezclar(a, b) { const o = JSON.parse(JSON.stringify(a)); for (const k of Object.keys(b || {})) { o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? mezclar(o[k] || {}, b[k]) : b[k]; } return o; }
  const r1 = (x) => Math.round(x * 10) / 10; const r2 = (x) => Math.round(x * 100) / 100;

  /** Superficies y materiales de un ambiente. */
  function calcularAmbiente(amb, cfgParcial) {
    const cfg = mezclar(DEFAULTS, cfgParcial);
    const largo = +amb.largo || 0, ancho = +amb.ancho || 0, alto = +amb.alto || 0, puertas = +amb.puertas || 0, ventanas = +amb.ventanas || 0;
    const perimetro = ancho > 0 ? 2 * (largo + ancho) : largo; // ancho 0: una sola pared (un frente, una medianera)
    const bruta = perimetro * alto;
    const aberturas = puertas * cfg.puerta.ancho * cfg.puerta.alto + ventanas * cfg.ventana.ancho * cfg.ventana.alto;
    const paredes = Math.max(0, bruta - aberturas);
    const techo = largo * ancho;
    const r = { nombre: amb.nombre, perimetro: r2(perimetro), paredes: r2(amb.paredes === "no" ? 0 : paredes), techo: r2(amb.techo ? techo : 0), piso: r2(amb.piso ? techo : 0), zocalo: 0, carpinteria: 0, litros: {}, kilos: {}, manos: {}, horas: 0, pasos: [] };
    const materiales = {}; // clave → cantidad (L o kg)
    const suma = (k, v) => { materiales[k] = (materiales[k] || 0) + v; };
    if (amb.paredes !== "no" && paredes > 0) {
      const ext = !!amb.exterior;
      const tipo = ext ? "latexExterior" : "latexInterior";
      const manos = amb.paredes === "oscura" ? cfg.manos.oscura : amb.paredes === "nueva" ? cfg.manos.nueva : ext ? cfg.manos.exterior : cfg.manos.clara;
      r.manos.paredes = manos;
      suma(ext ? "latexExterior" : "latexInterior", (paredes * manos) / cfg.rendimiento[tipo]);
      r.horas += (paredes * manos) / cfg.ritmo.m2PorHora;
      if (amb.paredes === "nueva") { suma("fijador", paredes / cfg.rendimiento.fijador); suma("enduido", paredes * cfg.rendimiento.enduido); r.horas += paredes / cfg.ritmo.m2PorHora + (paredes * 2) / cfg.ritmo.m2PorHora; r.pasos.push("enduido en dos capas finas y lija", "fijador al agua"); }
      else if (amb.paredes === "oscura") r.pasos.push("tres manos (o dos de una cubritiva) para tapar el color");
      r.pasos.push(`${manos} manos de látex ${ext ? "exterior" : "interior"} en paredes`);
    }
    if (amb.techo && techo > 0) {
      r.manos.techo = cfg.manos.cielorraso;
      suma("cielorraso", (techo * cfg.manos.cielorraso) / cfg.rendimiento.cielorraso);
      r.horas += (techo * cfg.manos.cielorraso) / cfg.ritmo.m2PorHora * 1.3; // el techo cansa más
      r.pasos.unshift(`${cfg.manos.cielorraso} manos de látex para cielorraso (el techo va antes que las paredes)`);
    }
    if (amb.aberturas && (puertas || ventanas)) {
      const area = puertas * AREA_PUERTA_SINTETICO + ventanas * AREA_VENTANA_SINTETICO;
      r.carpinteria = area; r.manos.sintetico = cfg.manos.sintetico;
      suma("sintetico", (area * cfg.manos.sintetico) / cfg.rendimiento.sintetico);
      r.horas += (area * cfg.manos.sintetico) / 4; // a pincel, 4 m²/h
      r.pasos.push(`${cfg.manos.sintetico} manos de esmalte sintético en ${puertas ? puertas + (puertas > 1 ? " puertas" : " puerta") : ""}${puertas && ventanas ? " y " : ""}${ventanas ? ventanas + (ventanas > 1 ? " ventanas" : " ventana") : ""} (al final, con cinta)`);
    }
    if (amb.piso && techo > 0) {
      const p = calcularPiso(techo, cfg.piso);
      Object.assign(r, { pisoDetalle: p });
      suma("piso", p.m2Comprar); suma("pegamento", p.pegamentoKg); suma("pastina", p.pastinaKg);
      r.horas += techo / 2; // 2 m²/h colocando
      r.pasos.push(`piso: ${p.cajas} cajas (${p.m2Comprar} m² con desperdicio), pegamento y pastina`);
    }
    if (amb.zocalo) {
      const metros = Math.max(0, perimetro - puertas * cfg.puerta.ancho) * 1.05;
      r.zocalo = r2(metros); suma("zocalo", metros);
      r.pasos.push(`${r.zocalo} m de zócalo (perímetro menos puertas, más 5 %)`);
    }
    for (const k of Object.keys(materiales)) { if (["enduido", "pegamento", "pastina"].includes(k)) r.kilos[k] = r2(materiales[k]); else if (k === "piso" || k === "zocalo") r[k === "piso" ? "pisoM2" : "zocaloM"] = r2(materiales[k]); else r.litros[k] = r2(materiales[k]); }
    r.horas = r1(r.horas);
    return r;
  }

  function calcularPiso(areaM2, cfgPiso) {
    const c = mezclar(DEFAULTS.piso, cfgPiso);
    const desperdicio = c.diagonal ? c.desperdicioDiagonal : c.desperdicio;
    const m2Comprar = areaM2 * (1 + desperdicio);
    const cajas = Math.ceil(m2Comprar / c.m2PorCaja - 1e-9);
    const L = c.largoCm / 100, A = c.anchoCm / 100;
    const piezasPorM2 = 1 / (L * A);
    const metrosJuntaPorM2 = 1 / L + 1 / A;
    const pastinaKgM2 = metrosJuntaPorM2 * (c.juntaMm / 1000) * (c.espesorMm / 1000) * c.densidadPastina * 1000 * 1.15; // +15 % que queda en la esponja
    const pegamentoKgM2 = c.pegamentoKgM2[c.tipo] || 4;
    return {
      m2Comprar: r2(m2Comprar), cajas, piezas: Math.ceil(m2Comprar * piezasPorM2), piezasPorM2: r1(piezasPorM2),
      pegamentoKg: r1(areaM2 * pegamentoKgM2), bolsasPegamento: Math.ceil((areaM2 * pegamentoKgM2) / c.bolsaPegamento - 1e-9),
      pastinaKg: r2(areaM2 * pastinaKgM2), pastinaKgM2: r2(pastinaKgM2), bolsasPastina: Math.ceil((areaM2 * pastinaKgM2) / c.bolsaPastina - 1e-9),
      separadores: Math.ceil(areaM2 * piezasPorM2 * 4 / 100), // bolsas de 100, cuatro por pieza
      desperdicio,
    };
  }

  /** Precio relativo por litro según el envase (la lata grande sale menos por litro): para elegir qué latas comprar. */
  const FACTOR = { 25: 1, 20: 1, 10: 1.15, 6: 1.2, 4: 1.35, 1.5: 1.6, 1: 1.8, 0.5: 2.2 };
  /** Latas: la combinación más barata con el precio relativo por envase; a igual precio, la que compra menos litros de más; después, menos latas. Trabaja en medios litros. */
  function latas(litros, tamanios) {
    if (litros <= 0) return [];
    const u = (x) => Math.round(x * 2);
    const sizes = tamanios.map((t) => ({ s: u(t), costo: u(t) * (FACTOR[t] || 1.5) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const objetivo = Math.ceil(litros * 2 - 1e-9); const tope = objetivo + sizes[0].s;
    const mejor = new Array(tope + 1).fill(null); mejor[0] = { costo: 0, n: 0, cuenta: {} };
    for (let t = 1; t <= tope; t++) {
      for (const { s, costo } of sizes) {
        const prev = t - s >= 0 ? mejor[t - s] : null; if (!prev) continue;
        const cand = { costo: prev.costo + costo, n: prev.n + 1, cuenta: Object.assign({}, prev.cuenta, { [s]: (prev.cuenta[s] || 0) + 1 }) };
        if (mejor[t] === null || cand.costo < mejor[t].costo - 1e-9 || (Math.abs(cand.costo - mejor[t].costo) < 1e-9 && cand.n < mejor[t].n)) mejor[t] = cand;
      }
    }
    let elegido = null, total = 0;
    for (let t = objetivo; t <= tope; t++) { const m = mejor[t]; if (m && (elegido === null || m.costo < elegido.costo - 1e-9)) { elegido = m; total = t; } }
    if (!elegido) return [];
    return Object.keys(elegido.cuenta).map((s) => ({ tamanio: s / 2, cantidad: elegido.cuenta[s], totalLitros: total / 2 })).sort((a, b) => b.tamanio - a.tamanio);
  }
  function bolsas(kilos, tamanios) { return latas(kilos, tamanios).map((x) => ({ tamanio: x.tamanio, cantidad: x.cantidad, totalKilos: x.totalLitros })); }

  const NOMBRES = {
    latexInterior: ["Látex interior", "L"], latexExterior: ["Látex exterior", "L"], cielorraso: ["Látex para cielorraso", "L"], fijador: ["Fijador sellador al agua", "L"], sintetico: ["Esmalte sintético", "L"], enduido: ["Enduido plástico interior", "kg"],
    piso: ["Piso", "m²"], pegamento: ["Pegamento para cerámicos", "kg"], pastina: ["Pastina", "kg"], zocalo: ["Zócalo", "m"],
  };

  /** Todo junto: por ambiente, totales con margen, latas, lista de compras, horas. */
  function calcular(ambientes, cfgParcial, precios) {
    const cfg = mezclar(DEFAULTS, cfgParcial); const pr = precios || {};
    const porAmbiente = ambientes.map((a) => calcularAmbiente(a, cfg));
    const totales = {}; const suma = (k, v) => { totales[k] = (totales[k] || 0) + v; };
    let horas = 0, paredes = 0, techo = 0, pisoM2 = 0, zocaloM = 0, carpinteria = 0;
    for (const r of porAmbiente) {
      for (const k of Object.keys(r.litros)) suma(k, r.litros[k]);
      for (const k of Object.keys(r.kilos)) suma(k, r.kilos[k]);
      if (r.pisoM2) suma("piso", r.pisoM2); if (r.zocaloM) suma("zocalo", r.zocaloM);
      horas += r.horas; paredes += r.paredes; techo += r.techo; pisoM2 += r.piso; zocaloM += r.zocalo; carpinteria += r.carpinteria;
    }
    const lista = [];
    const ordenMateriales = ["enduido", "fijador", "cielorraso", "latexInterior", "latexExterior", "sintetico", "piso", "pegamento", "pastina", "zocalo"];
    for (const k of ordenMateriales) {
      if (!totales[k]) continue;
      const [nombre, unidad] = NOMBRES[k];
      if (k === "piso") { lista.push({ clave: "piso", nombre: `${nombre} ${cfg.piso.largoCm}×${cfg.piso.anchoCm}`, cantidad: Math.ceil(totales.piso / cfg.piso.m2PorCaja - 1e-9), unidad: "cajas", detalle: `${r2(totales.piso)} m² con el desperdicio; ${cfg.piso.m2PorCaja} m² por caja` }); continue; }
      if (k === "pegamento") { const b = Math.ceil(totales.pegamento / cfg.piso.bolsaPegamento - 1e-9); lista.push({ clave: k, nombre: nombre + (cfg.piso.tipo === "porcelanato" ? " (para porcelanato)" : ""), cantidad: b, unidad: `bolsas de ${cfg.piso.bolsaPegamento} kg`, detalle: `${r1(totales.pegamento)} kg` }); continue; }
      if (k === "pastina") { const b = Math.ceil(totales.pastina / cfg.piso.bolsaPastina - 1e-9); lista.push({ clave: k, nombre, cantidad: b, unidad: cfg.piso.bolsaPastina === 1 ? "kg" : `bolsas de ${cfg.piso.bolsaPastina} kg`, detalle: `${r2(totales.pastina)} kg (junta de ${cfg.piso.juntaMm} mm)` }); continue; }
      if (k === "zocalo") { lista.push({ clave: k, nombre, cantidad: Math.ceil(totales.zocalo), unidad: "m", detalle: "con 5 % de más" }); continue; }
      const necesario = totales[k] * (1 + cfg.margen);
      const envases = k === "enduido" ? bolsas(necesario, cfg.latas.enduido) : latas(necesario, cfg.latas[k === "latexInterior" || k === "latexExterior" ? "latex" : k]);
      const comprado = envases.length ? (envases[0].totalLitros || envases[0].totalKilos) : 0;
      lista.push({ clave: k, nombre, cantidad: comprado, unidad, detalle: `${r1(totales[k])} ${unidad} más ${Math.round(cfg.margen * 100)} %: ${envases.map((e) => `${e.cantidad} de ${e.tamanio} ${unidad}`).join(" + ")}`, envases });
    }
    // Accesorios, a ojo pero razonable.
    const m2Pintura = paredes + techo;
    if (m2Pintura > 0) {
      lista.push({ clave: "rodillo", nombre: "Rodillo de lana 22 cm (con mango)", cantidad: Math.max(1, Math.ceil(m2Pintura / 150)), unidad: "u", detalle: "uno cada 150 m² de pared y techo" });
      lista.push({ clave: "pincel", nombre: "Pincel 2\" para recortes", cantidad: 1 + (totales.sintetico ? 1 : 0), unidad: "u", detalle: totales.sintetico ? "uno para látex y otro para sintético" : "" });
      lista.push({ clave: "cinta", nombre: "Cinta de papel 24 mm × 50 m", cantidad: Math.max(1, Math.ceil((porAmbiente.reduce((s, r) => s + (r.paredes ? r.perimetro : 0), 0) * 2 + carpinteria * 2) / 45)), unidad: "rollos", detalle: "zócalos, techo y marcos" });
      lista.push({ clave: "bandeja", nombre: "Bandeja para rodillo", cantidad: 1, unidad: "u" });
      lista.push({ clave: "lija", nombre: "Lija al agua n.º 180", cantidad: Math.max(2, Math.ceil(m2Pintura / 25)), unidad: "pliegos" });
      lista.push({ clave: "nylon", nombre: "Polietileno para tapar (rollo 3 m)", cantidad: Math.max(1, Math.ceil(techo / 60)), unidad: "u" });
    }
    if (totales.sintetico) lista.push({ clave: "aguarras", nombre: "Aguarrás", cantidad: 1, unidad: "L", detalle: "para diluir y limpiar" });
    let costo = 0, conPrecio = 0;
    for (const item of lista) { const p = +pr[item.clave]; if (p > 0) { item.precio = p; item.subtotal = Math.round(p * item.cantidad); costo += item.subtotal; conPrecio++; } }
    const jornadas = horas > 0 ? Math.ceil(horas / 6 - 1e-9) : 0;
    return { porAmbiente, totales: Object.fromEntries(Object.keys(totales).map((k) => [k, r2(totales[k])])), lista, costo, conPrecio, horas: r1(horas), jornadas, superficies: { paredes: r2(paredes), techo: r2(techo), piso: r2(pisoM2), zocalo: r2(zocaloM), carpinteria: r2(carpinteria) } };
  }

  function orden(resultado) {
    const hayNueva = resultado.porAmbiente.some((r) => r.pasos.some((p) => p.startsWith("enduido")));
    const hayPiso = resultado.superficies.piso > 0; const haySint = resultado.superficies.carpinteria > 0; const hayTecho = resultado.superficies.techo > 0;
    const pasos = ["Sacá los muebles o juntalos en el medio y tapalos; desenchufá y sacá las tapas de las llaves de luz."];
    if (hayPiso) pasos.push("Piso primero: se coloca, se deja secar el pegamento 24 h, se toma la junta con pastina y recién se pinta (así la pintura no se mancha con el polvo).");
    pasos.push("Lavá las paredes con agua y detergente si hay grasa (cocina) y lijá lo que esté descascarado.");
    if (hayNueva) pasos.push("Revoque nuevo: enduido en dos capas finas con espátula ancha, lija 180 entre capas, y fijador al agua. Esperá 4 h antes de pintar.");
    if (hayTecho) pasos.push("Techo antes que paredes: recortá el borde con pincel y después rodillo en franjas, siempre en el mismo sentido y a contraluz para ver lo que falta.");
    pasos.push("Paredes: recortes con pincel en zócalos, esquinas y marcos, y rodillo en W cerrando sin dejar franjas. Entre manos, 4 h (más si está húmedo).");
    pasos.push("Diluí la primera mano hasta 20 % con agua; la última, sin diluir. Nunca pintes con menos de 10 °C ni con sol directo en el exterior.");
    if (haySint) pasos.push("Carpintería al final: lija fina, cinta de papel alrededor, sintético a pincel en dos manos con 12 h entre una y otra (o en un día con el esmalte al agua).");
    pasos.push("Sacá la cinta de papel con la pintura todavía fresca: seca, arranca.");
    return pasos;
  }

  function listaTexto(resultado, titulo) {
    const l = [titulo || "Para pintar", ""];
    for (const i of resultado.lista) l.push(`- ${i.nombre}: ${i.cantidad} ${i.unidad}${i.detalle ? " (" + i.detalle + ")" : ""}${i.subtotal ? " — $" + i.subtotal.toLocaleString("es-AR") : ""}`);
    if (resultado.costo) l.push("", `Total${resultado.conPrecio < resultado.lista.length ? " (solo lo que tiene precio)" : ""}: $${resultado.costo.toLocaleString("es-AR")}`);
    l.push("", `Unas ${resultado.horas} horas de trabajo para una persona: ${resultado.jornadas} ${resultado.jornadas === 1 ? "jornada" : "jornadas"} de 6 h, sin contar el secado.`);
    return l.join("\n");
  }

  const api = { DEFAULTS, FACTOR, ambienteNuevo, mezclar, calcularAmbiente, calcularPiso, latas, bolsas, calcular, orden, listaTexto, NOMBRES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.Pintar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
