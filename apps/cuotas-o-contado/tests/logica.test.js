/* Tests de la cuenta de ¿Cuotas o contado?   node --test apps/cuotas-o-contado/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const C = require("../logica.js");
const cerca = (a, b, tol) => assert.ok(Math.abs(a - b) <= (tol == null ? 1e-6 : tol), `${a} ≈ ${b}`);

test("TNA a tasa de 30 días y vuelta, como la liquida un plazo fijo", () => {
  cerca(C.temDesdeTna(20, 30), 0.2 * 30 / 365);
  cerca(C.temDesdeTna(36.5, 30), 0.03);
  cerca(C.tnaDesdeTem(0.03), 36.5);
  cerca(C.teaDesdeTem(0.01), (Math.pow(1.01, 12) - 1) * 100);
});

test("valor presente: sin tasa suma las cuotas; la primera cuota hoy no se descuenta", () => {
  cerca(C.valorPresente(100, 12, 1, 0), 1200);
  cerca(C.valorPresente(100, 1, 0, 0.5), 100);
  cerca(C.valorPresente(100, 1, 1, 0.25), 80);
  cerca(C.valorPresente(100, 2, 0, 0.1), 100 + 100 / 1.1);
});

test("tasa implícita: 12 cuotas que suman lo mismo que el contado son 0 %", () => {
  cerca(C.tasaImplicita(120000, 10000, 12, 1), 0, 1e-9);
  cerca(C.tasaImplicita(120000, 10000, 12, 0), 0, 1e-9);
});

test("tasa implícita: una cuota a 30 días al 10 % más es 10 % mensual; con descuento del 10 % en 12 cuotas, TNA ~20 %", () => {
  cerca(C.tasaImplicita(100, 110, 1, 1), 0.1, 1e-9);
  const i = C.tasaImplicita(90000, 100000 / 12, 12, 1);
  cerca(i, 0.016594, 1e-5);
  cerca(C.tnaDesdeTem(i), 20.19, 0.01);
  // La raíz cierra: el valor presente a esa tasa es el contado.
  cerca(C.valorPresente(100000 / 12, 12, 1, i), 90000, 1e-4);
});

test("tasa implícita: casos sin solución y cuotas más baratas que el contado (tasa negativa)", () => {
  assert.equal(C.tasaImplicita(100, 110, 1, 0), null);
  assert.equal(C.tasaImplicita(100, 100, 1, 0), 0);
  assert.equal(C.tasaImplicita(0, 100, 3, 1), null);
  const neg = C.tasaImplicita(1200, 90, 12, 1);
  assert.ok(neg < 0, "cuotas que suman menos que el contado: tasa negativa");
});

test("simular la inversión: con tasa cero el saldo final es contado − total; con tasa, crece", () => {
  const sim0 = C.simularInversion(1000, 100, 12, 1, 0);
  assert.equal(sim0.length, 13);
  assert.equal(sim0[0].cuota, 0); assert.equal(sim0[1].cuota, 100);
  cerca(sim0[12].saldo, 1000 - 1200);
  const sim = C.simularInversion(1000, 100, 12, 1, 0.02);
  // Igual que (contado − VP a r) capitalizado hasta el último mes.
  cerca(sim[12].saldo, (1000 - C.valorPresente(100, 12, 1, 0.02)) * Math.pow(1.02, 12), 1e-6);
  const simHoy = C.simularInversion(1000, 100, 12, 0, 0.02);
  assert.equal(simHoy.length, 12); assert.equal(simHoy[0].cuota, 100); cerca(simHoy[0].saldo, 900);
});

test("comparar: cuotas sin interés con inflación y plata que rinde, conviene en cuotas en las tres situaciones salvo quieta (empate)", () => {
  const base = { contado: 120000, cuota: 10000, n: 12, primeraEn: 1, inflacion: 2, rendimiento: 1.5 };
  const r = C.comparar(Object.assign({ situacion: "rinde" }, base));
  assert.equal(r.sinInteres, true); assert.equal(r.gana, "cuotas"); assert.ok(r.sobraNominal > 0);
  cerca(r.implicita.tem, 0, 1e-9);
  const q = C.comparar(Object.assign({ situacion: "quieta" }, base));
  assert.equal(q.gana, "empate"); cerca(q.diferencia, 0);
  const s = C.comparar(Object.assign({ situacion: "sueldo" }, base));
  assert.equal(s.gana, "cuotas"); cerca(s.costoCuotasRef, s.vpInflacion); assert.ok(s.vpInflacion < 120000);
});

test("comparar: plan con interés alto, conviene contado si la plata rinde menos; la cuota de equilibrio cierra la cuenta", () => {
  const c = C.comparar({ contado: 100000, cuota: 12000, n: 12, primeraEn: 1, inflacion: 1.9, rendimiento: 1.64, situacion: "rinde" });
  assert.equal(c.gana, "contado");
  assert.ok(c.implicita.tem > 0.05, "más de 5 % mensual");
  assert.ok(c.sobraNominal < 0, "te falta plata al final");
  cerca(C.valorPresente(c.cuotaEquilibrio, 12, 1, 0.0164), 100000, 1e-4);
  cerca(c.contadoEquilibrio, c.vpRendimiento);
  assert.equal(c.filas.length, 12); assert.equal(c.filas[0].mes, 1); cerca(c.filas[0].enPlataDeHoy, 12000 / 1.019);
  cerca(c.filas[11].acumulado, 144000);
  const v = C.veredicto(c);
  assert.equal(v.titulo, "Conviene contado");
  assert.match(v.detalle, /más \(\d+,\d % del contado\) poniendo la plata a rendir/);
});

test("comparar: si la plata rinde más que la tasa escondida, conviene en cuotas aunque tengan interés", () => {
  const c = C.comparar({ contado: 90000, cuota: 100000 / 12, n: 12, primeraEn: 1, inflacion: 1.9, rendimiento: 3, situacion: "rinde" });
  assert.equal(c.gana, "cuotas"); assert.ok(c.diferencia > 0);
  const v = C.veredicto(c); assert.equal(v.titulo, "Conviene en cuotas"); assert.match(v.detalle, /^Te sale \$ [\d.]+ menos/);
});

test("formato en pesos y porcentaje a la argentina", () => {
  assert.equal(C.pesos(1234567.4), "$ 1.234.567");
  assert.equal(C.pesos(-5), "-$ 5");
  assert.equal(C.fmtPct(1.9), "1,9 %");
  assert.equal(C.fmtPct(20.1889, 2), "20,19 %");
});
