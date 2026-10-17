/* Tests de la lógica de «Asado para cuántos»: node --test apps/asado/tests/logica.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../logica.js");

test("seis adultos con tira, vacío, chorizo y morcilla: medio kilo por cabeza, achuras por unidad, carbón mínimo 3 kg", () => {
  const r = A.calcular({ adultos: 6, comilones: 0, chicos: 0, vegetarianos: 0, cortes: ["tira", "vacio"], achuras: ["chorizo", "morcilla"] });
  assert.equal(r.comensales, 6);
  assert.equal(r.gramosTotales, 2700);
  const chorizo = r.items.find((i) => i.clave === "chorizo"), morcilla = r.items.find((i) => i.clave === "morcilla");
  assert.equal(chorizo.unidades, 6); assert.equal(morcilla.unidades, 3);
  const tira = r.items.find((i) => i.clave === "tira"), vacio = r.items.find((i) => i.clave === "vacio");
  assert.equal(tira.kg, vacio.kg);
  assert.ok(r.totalCarneKg >= 2.6 && r.totalCarneKg <= 3.0, `total ${r.totalCarneKg}`);
  assert.equal(r.combustible.nombre, "Carbón"); assert.ok(r.combustible.kg >= 3);
  assert.equal(r.gramosPorPersona, 450);
});

test("comilones, chicos y vegetarianos pesan distinto; los vegetarianos no suman carne pero sí provoleta, verduras y bebida", () => {
  const base = A.calcular({ adultos: 4, comilones: 0, chicos: 0, vegetarianos: 0 });
  const conComilon = A.calcular({ adultos: 3, comilones: 1, chicos: 0, vegetarianos: 0 });
  const conChico = A.calcular({ adultos: 4, comilones: 0, chicos: 1, vegetarianos: 0 });
  const conVege = A.calcular({ adultos: 4, comilones: 0, chicos: 0, vegetarianos: 2 });
  assert.ok(conComilon.gramosTotales > base.gramosTotales);
  assert.equal(conChico.gramosTotales - base.gramosTotales, 250);
  assert.equal(conVege.gramosTotales, base.gramosTotales);
  assert.ok(conVege.extras.some((x) => x.clave === "verduras" && x.kg === 0.8));
  assert.ok(conVege.extras.find((x) => x.clave === "provoleta").unidades > base.extras.find((x) => x.clave === "provoleta").unidades);
  assert.ok(conVege.bebidas.find((b) => b.clave === "cerveza").ml > base.bebidas.find((b) => b.clave === "cerveza").ml);
  assert.ok(!base.extras.some((x) => x.clave === "verduras"));
});

test("duración: larga suma 15 %, corta resta 10 %", () => {
  const n = A.calcular({ adultos: 10, duracion: "normal" }), l = A.calcular({ adultos: 10, duracion: "larga" }), c = A.calcular({ adultos: 10, duracion: "corta" });
  assert.equal(l.gramosTotales, n.gramosTotales * 1.15);
  assert.equal(c.gramosTotales, n.gramosTotales * 0.9);
  assert.ok(l.bebidas[0].ml > n.bebidas[0].ml);
});

test("sin achuras toda la carne va a los cortes; con solo achuras no hay cortes; el pollo lleva 25 % más; mínimo medio kilo por corte", () => {
  const sin = A.calcular({ adultos: 4, cortes: ["tira"], achuras: [] });
  assert.equal(sin.items.length, 1); assert.equal(sin.items[0].kg, 1.8);
  const solo = A.calcular({ adultos: 4, cortes: [], achuras: ["chorizo"] });
  assert.equal(solo.items.length, 1); assert.equal(solo.items[0].unidades, 4);
  const pollo = A.calcular({ adultos: 4, cortes: ["pollo", "tira"], achuras: [] });
  assert.ok(pollo.items.find((i) => i.clave === "pollo").kg > pollo.items.find((i) => i.clave === "tira").kg);
  const muchos = A.calcular({ adultos: 2, cortes: ["tira", "vacio", "entrana", "matambre", "bondiola"], achuras: ["chorizo", "morcilla"] });
  muchos.items.filter((i) => i.tipo === "carne").forEach((i) => assert.ok(i.kg >= 0.5, i.nombre));
});

test("bebidas se redondean al envase y los chicos solo suman gaseosa y agua; sin nadie, no hay nada", () => {
  const r = A.calcular({ adultos: 3, chicos: 2, bebidas: ["cerveza", "vino", "gaseosa", "agua", "fernet"] });
  const vino = r.bebidas.find((b) => b.clave === "vino"); assert.equal(vino.envases, 1); assert.match(vino.detalle, /^1 botella \(0,8 L\)$/);
  const gaseosa = r.bebidas.find((b) => b.clave === "gaseosa"); assert.equal(gaseosa.ml, 2000); assert.equal(gaseosa.envases, 1);
  const cerveza = r.bebidas.find((b) => b.clave === "cerveza"); assert.equal(cerveza.ml, 2100); assert.equal(cerveza.envases, 3); assert.match(cerveza.detalle, /^3 litros/);
  assert.ok(r.bebidas.some((b) => b.clave === "hielo"));
  const vacio = A.calcular({ adultos: 0, comilones: 0, chicos: 0, vegetarianos: 0 });
  assert.equal(vacio.comensales, 0); assert.equal(vacio.totalCarneKg, 0);
  assert.ok(!vacio.extras.some((x) => x.clave === "pan"));
});

test("leña es el doble que carbón y se prende antes", () => {
  const c = A.calcular({ adultos: 8, combustible: "carbon" }), l = A.calcular({ adultos: 8, combustible: "lena" });
  assert.ok(l.combustible.kg >= c.combustible.kg * 1.8);
  assert.equal(c.tiempos.prenderMinutos, 45); assert.equal(l.tiempos.prenderMinutos, 60);
});

test("el plan de la parrilla: la entrada sale con el chorizo, lo principal termina junto y 40 min después como mínimo", () => {
  const r = A.calcular({ adultos: 6, cortes: ["vacio", "entrana"], achuras: ["chorizo", "morcilla"], provoleta: true });
  const t = r.tiempos;
  assert.equal(t.servirEntrada, 25);
  assert.equal(t.servirPrincipal, 100);
  const vacio = t.plan.find((p) => p.nombre === "Vacío"), entrana = t.plan.find((p) => p.nombre === "Entraña");
  assert.equal(vacio.minuto, 0); assert.equal(entrana.minuto, 82);
  assert.equal(t.plan.find((p) => p.nombre === "Morcilla").minuto, 13);
  assert.equal(t.plan.find((p) => p.nombre === "Provoleta").minuto, 15);
  assert.deepEqual(t.plan.map((p) => p.minuto), [...t.plan.map((p) => p.minuto)].sort((a, b) => a - b), "ordenado por minuto");
  const corto = A.calcular({ adultos: 4, cortes: ["entrana"], achuras: ["chorizo"] });
  assert.equal(corto.tiempos.servirPrincipal, 65, "nunca antes de 40 min después de la entrada");
});

test("lista de compras en texto y costo con precios parciales, dividido entre los grandes", () => {
  const r = A.calcular({ adultos: 5, chicos: 1, cortes: ["tira"], achuras: ["chorizo"], bebidas: ["cerveza"] });
  const l = A.listaCompras(r);
  assert.match(l, /^Asado para 6 \(5 adultos, 1 chico\)/);
  assert.match(l, /Carnicería:\n- Chorizo: 6 u\. \(0,65 kg\)\n- Asado de tira: /);
  assert.match(l, /- Carbón: \d+ kg$/);
  const c = A.costo(r, { tira: 10000, chorizo: 6000, cerveza: 2000, combustible: 1000 });
  assert.equal(c.pagan, 5);
  assert.equal(c.lineas.length, 4);
  const esperado = 10000 * r.items.find((i) => i.clave === "tira").kg + 6000 * 0.65 + 2000 * r.bebidas[0].envases + 1000 * r.combustible.kg;
  assert.ok(Math.abs(c.total - esperado) < 0.01);
  assert.ok(Math.abs(c.porPersona - esperado / 5) < 0.01);
  assert.equal(A.costo(r, {}).total, 0);
  assert.equal(A.pesos(12345.6), "$ 12.346");
  assert.equal(A.formatoKg(1.15), "1,15 kg");
});
