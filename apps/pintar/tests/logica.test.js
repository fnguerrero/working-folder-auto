/* Tests de Para pintar.   node --test apps/pintar/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const P = require("../logica.js");
const amb = (o) => Object.assign(P.ambienteNuevo("Pieza"), o);

test("superficies: perímetro, paredes menos aberturas, techo, una sola pared con ancho 0", () => {
  const r = P.calcularAmbiente(amb({ largo: 4, ancho: 3, alto: 2.6, puertas: 1, ventanas: 1 }));
  assert.equal(r.perimetro, 14); assert.equal(r.paredes, 14 * 2.6 - 0.8 * 2.05 - 1.2 * 1.1); assert.equal(r.techo, 12);
  const f = P.calcularAmbiente(amb({ largo: 10, ancho: 0, alto: 3, puertas: 1, ventanas: 2, techo: false, exterior: true }));
  assert.equal(f.perimetro, 10); assert.equal(f.paredes, 30 - 1.64 - 2.64); assert.equal(f.techo, 0); assert.ok(f.litros.latexExterior > 0); assert.equal(f.litros.latexInterior, undefined);
  const sin = P.calcularAmbiente(amb({ paredes: "no", techo: false })); assert.equal(sin.paredes, 0); assert.deepEqual(sin.litros, {}); assert.equal(sin.horas, 0);
  const grande = P.calcularAmbiente(amb({ largo: 4, ancho: 3, alto: 2.6, puertas: 20, ventanas: 20 })); assert.equal(grande.paredes, 0, "nunca negativo");
});

test("pintura: manos por estado, rendimientos, revoque nuevo con enduido y fijador, sintético por abertura", () => {
  const base = { largo: 4, ancho: 3, alto: 2.6, puertas: 1, ventanas: 1 }; const paredes = 14 * 2.6 - 0.8 * 2.05 - 1.2 * 1.1;
  const c = P.calcularAmbiente(amb(base)); assert.equal(c.manos.paredes, 2); assert.equal(c.litros.latexInterior, Math.round((paredes * 2) / 10 * 100) / 100); assert.equal(c.litros.cielorraso, 2.4);
  const o = P.calcularAmbiente(amb(Object.assign({ paredes: "oscura" }, base))); assert.equal(o.manos.paredes, 3); assert.ok(o.litros.latexInterior > c.litros.latexInterior * 1.4);
  const n = P.calcularAmbiente(amb(Object.assign({ paredes: "nueva" }, base))); assert.equal(n.kilos.enduido, Math.round(paredes * 100) / 100); assert.equal(n.litros.fijador, Math.round(paredes / 12 * 100) / 100); assert.match(n.pasos.join(" "), /enduido.*fijador/);
  const s = P.calcularAmbiente(amb(Object.assign({ aberturas: true, puertas: 2, ventanas: 1 }, base, { puertas: 2 }))); assert.equal(s.carpinteria, 10); assert.equal(s.litros.sintetico, Math.round(10 * 2 / 12 * 100) / 100); assert.match(s.pasos.join(" "), /2 puertas y 1 ventana/);
  const r = P.calcularAmbiente(amb(base), { rendimiento: { latexInterior: 5 } }); assert.equal(r.litros.latexInterior, c.litros.latexInterior * 2);
});

test("piso: desperdicio, cajas enteras, pegamento, pastina por la junta, separadores; zócalo", () => {
  const p = P.calcularPiso(20, { largoCm: 45, anchoCm: 45, juntaMm: 3, espesorMm: 8, m2PorCaja: 1.62 });
  assert.equal(p.m2Comprar, 22); assert.equal(p.cajas, 14); assert.equal(p.pegamentoKg, 80); assert.equal(p.bolsasPegamento, 3);
  assert.equal(p.pastinaKgM2, Math.round((2 / 0.45) * 0.003 * 0.008 * 1700 * 1.15 * 100) / 100); assert.ok(p.pastinaKgM2 > 0.15 && p.pastinaKgM2 < 0.3);
  const d = P.calcularPiso(20, { diagonal: true, m2PorCaja: 1.62 }); assert.equal(d.m2Comprar, 23); assert.equal(d.desperdicio, 0.15);
  const porc = P.calcularPiso(20, { tipo: "porcelanato", largoCm: 60, anchoCm: 60, juntaMm: 2, m2PorCaja: 1.44 }); assert.equal(porc.pegamentoKg, 100); assert.ok(porc.pastinaKgM2 < p.pastinaKgM2, "junta más chica y pieza más grande: menos pastina");
  const grande = P.calcularPiso(20, { largoCm: 120, anchoCm: 60, m2PorCaja: 1.44 }); assert.equal(grande.piezas, Math.ceil(22 / 0.72));
  const z = P.calcularAmbiente(amb({ largo: 4, ancho: 3, puertas: 2, zocalo: true })); assert.equal(z.zocalo, Math.round((14 - 1.6) * 1.05 * 100) / 100);
  const con = P.calcularAmbiente(amb({ largo: 4, ancho: 3, piso: true })); assert.equal(con.piso, 12); assert.equal(con.pisoDetalle.cajas, Math.ceil(13.2 / 1.62)); assert.equal(con.pisoM2, 13.2);
});

test("latas: la combinación más barata con el precio relativo por envase, nunca menos de lo que hace falta", () => {
  const l = (x, t) => P.latas(x, t || [20, 10, 4, 1]).map((e) => `${e.cantidad}x${e.tamanio}`).join("+");
  assert.equal(l(0.3), "1x1"); assert.equal(l(3), "3x1"); assert.equal(l(5), "1x4+1x1"); assert.equal(l(9), "1x10"); assert.equal(l(13), "1x10+3x1"); assert.equal(l(17), "1x20"); assert.equal(l(36), "2x20");
  assert.equal(l(2.2, [4, 1, 0.5]), "2x1+1x0.5"); assert.equal(P.latas(2.2, [4, 1, 0.5])[0].totalLitros, 2.5);
  assert.deepEqual(P.latas(0, [20]), []);
  for (let x = 0.5; x < 60; x = Math.round((x + 0.7) * 10) / 10) { const e = P.latas(x, [20, 10, 4, 1]); assert.ok(e[0].totalLitros >= x, `cubre ${x}`); assert.ok(e[0].totalLitros < x + 20, `no exagera ${x}`); }
  assert.equal(P.bolsas(44.5, [25, 6, 1.5]).map((e) => `${e.cantidad}x${e.tamanio}`).join("+"), "1x25+3x6+1x1.5");
});

test("todo junto: totales con margen, lista de compras, accesorios, precios y costo, horas y jornadas", () => {
  const r = P.calcular([amb({ largo: 5, ancho: 4, alto: 2.6, puertas: 2, ventanas: 2, aberturas: true, piso: true, zocalo: true }), amb({ nombre: "Pieza", paredes: "nueva" })], {}, { latexInterior: 9000, piso: 30000 });
  const claves = r.lista.map((i) => i.clave);
  assert.deepEqual(claves, ["enduido", "fijador", "cielorraso", "latexInterior", "sintetico", "piso", "pegamento", "pastina", "zocalo", "rodillo", "pincel", "cinta", "bandeja", "lija", "nylon", "aguarras"]);
  const latex = r.lista.find((i) => i.clave === "latexInterior"); assert.equal(latex.cantidad, 20); assert.match(latex.detalle, /14\.9 L más 10 %: 1 de 20 L/); assert.equal(latex.subtotal, 180000);
  const piso = r.lista.find((i) => i.clave === "piso"); assert.equal(piso.cantidad, 14); assert.equal(piso.unidad, "cajas"); assert.equal(piso.subtotal, 420000);
  assert.equal(r.costo, 600000); assert.equal(r.conPrecio, 2);
  assert.equal(r.lista.find((i) => i.clave === "pincel").cantidad, 2); assert.equal(r.lista.find((i) => i.clave === "pegamento").cantidad, 3);
  assert.equal(r.superficies.piso, 20); assert.ok(r.horas > 30 && r.horas < 60); assert.equal(r.jornadas, Math.ceil(r.horas / 6));
  const vacio = P.calcular([], {}, {}); assert.deepEqual(vacio.lista, []); assert.equal(vacio.horas, 0); assert.equal(vacio.jornadas, 0);
  const sinPrecio = P.calcular([amb({})], {}, {}); assert.equal(sinPrecio.costo, 0); assert.ok(!sinPrecio.lista.some((i) => i.clave === "aguarras"));
  const m = P.calcular([amb({})], { margen: 0 }, {}); const m2 = P.calcular([amb({})], { margen: 0.5 }, {}); assert.ok(m2.lista.find((i) => i.clave === "latexInterior").cantidad >= m.lista.find((i) => i.clave === "latexInterior").cantidad);
});

test("orden de trabajo y lista en texto", () => {
  const r = P.calcular([amb({ paredes: "nueva", aberturas: true, piso: true })], {}, { latexInterior: 9000 });
  const o = P.orden(r); assert.match(o[1], /^Piso primero/); assert.ok(o.some((p) => /Revoque nuevo/.test(p))); assert.ok(o.some((p) => /Carpintería al final/.test(p))); assert.match(o[o.length - 1], /cinta de papel/);
  const o2 = P.orden(P.calcular([amb({})], {}, {})); assert.ok(!o2.some((p) => /Piso primero|Revoque nuevo|Carpintería/.test(p))); assert.ok(o2.some((p) => /Techo antes que paredes/.test(p)));
  const t = P.listaTexto(r, "Para pintar: Pieza"); assert.match(t, /^Para pintar: Pieza\n\n- Enduido plástico interior: /); assert.match(t, /Látex interior: \d+ L .*— \$[\d.]+\n/); assert.match(t, /Total \(solo lo que tiene precio\): \$/); assert.match(t, /jornadas? de 6 h/);
});
