/* Tests de la lógica, con casos calculados a mano. Correr desde la raíz del repo:
     node --test apps/lo-que-te-corresponde/tests/*.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.011, `${msg || ""}: ${a} ≠ ${b}`);

test("fechas: validación, días corridos y suma de meses", () => {
  assert.ok(L.esFecha("2024-02-29"));
  assert.ok(!L.esFecha("2023-02-29"));
  assert.ok(!L.esFecha("2024-13-01"));
  assert.ok(!L.esFecha("hoy"));
  assert.equal(L.diasInclusive("2024-01-01", "2024-01-31"), 31);
  assert.equal(L.diasInclusive("2024-01-01", "2024-06-30"), 182);
  assert.equal(L.diasInclusive("2023-01-01", "2023-06-30"), 181);
  assert.equal(L.diasInclusive("2024-07-01", "2024-12-31"), 184);
  assert.equal(L.diasInclusive("2024-05-10", "2024-05-09"), 0);
  assert.equal(L.sumarMeses("2024-01-31", 1), "2024-02-29");
  assert.equal(L.sumarMeses("2024-11-15", 6), "2025-05-15");
  assert.equal(L.diasDelAnio(2024), 366);
  assert.equal(L.diasDelAnio(2023), 365);
  assert.equal(L.fechaLarga("2024-10-13"), "13 de octubre de 2024");
});

test("antigüedad en años, meses y días", () => {
  assert.deepEqual(L.antiguedad("2020-03-01", "2024-02-29"), { anios: 4, meses: 0, dias: 0, totalDias: 1461 });
  assert.deepEqual(L.antiguedad("2024-01-01", "2024-01-01"), { anios: 0, meses: 0, dias: 1, totalDias: 1 });
  assert.deepEqual(L.antiguedad("2024-01-01", "2024-01-31"), { anios: 0, meses: 1, dias: 0, totalDias: 31 });
  const a = L.antiguedad("2019-05-15", "2024-10-13");
  assert.equal(a.anios, 5); assert.equal(a.meses, 4); assert.equal(a.dias, 29);
  assert.equal(L.textoAntiguedad(a), "5 años, 4 meses, 29 días");
  assert.equal(L.textoAntiguedad({ anios: 1, meses: 0, dias: 0 }), "1 año");
  assert.equal(L.textoAntiguedad({ anios: 0, meses: 0, dias: 0 }), "0 días");
});

test("art. 245: fracción mayor de tres meses suma un año", () => {
  assert.equal(L.aniosIndemnizables({ anios: 2, meses: 3, dias: 0 }), 2);
  assert.equal(L.aniosIndemnizables({ anios: 2, meses: 3, dias: 1 }), 3);
  assert.equal(L.aniosIndemnizables({ anios: 2, meses: 4, dias: 0 }), 3);
  assert.equal(L.aniosIndemnizables({ anios: 0, meses: 11, dias: 0 }), 1);
  assert.equal(L.aniosIndemnizables({ anios: 0, meses: 2, dias: 0 }), 0);
});

test("período de prueba y preaviso", () => {
  assert.ok(L.enPeriodoDePrueba("2024-01-15", "2024-07-14"));
  assert.ok(!L.enPeriodoDePrueba("2024-01-15", "2024-07-15"));
  assert.ok(L.enPeriodoDePrueba("2024-01-15", "2024-04-14", 3));
  assert.ok(!L.enPeriodoDePrueba("2024-01-15", "2024-04-15", 3));
  assert.equal(L.mesesDePreaviso("2024-01-15", "2024-03-01"), 0.5);
  assert.equal(L.mesesDePreaviso("2019-01-01", "2023-12-31"), 1); // exactamente 5 años
  assert.equal(L.mesesDePreaviso("2019-01-01", "2024-01-01"), 2); // más de 5
  assert.equal(L.mesesDePreaviso("2010-01-01", "2024-01-01"), 2);
});

test("escala de vacaciones del art. 150", () => {
  assert.equal(L.diasDeVacaciones(0), 14);
  assert.equal(L.diasDeVacaciones(5), 14);
  assert.equal(L.diasDeVacaciones(6), 21);
  assert.equal(L.diasDeVacaciones(10), 21);
  assert.equal(L.diasDeVacaciones(11), 28);
  assert.equal(L.diasDeVacaciones(20), 28);
  assert.equal(L.diasDeVacaciones(21), 35);
  assert.equal(L.aniosAl31("2018-06-01", 2024), 6);
  assert.equal(L.aniosAl31("2019-01-01", 2024), 6); // 1/1/2019 al 31/12/2024: 6 años justos
  assert.equal(L.aniosAl31("2019-01-02", 2024), 5);
});

test("vacaciones: año completo y año corto", () => {
  const v = L.vacaciones({ ingreso: "2016-03-01", anio: 2024, sueldo: 1500000 });
  assert.equal(v.dias, 21);
  assert.equal(v.regla, "art. 150");
  cerca(v.valorDia, 60000, "sueldo/25");
  cerca(v.bruto, 1260000, "21 días");
  cerca(v.plus, (60000 - 50000) * 21, "plus vacacional");
  cerca(v.neto, 1260000 * 0.83, "neto");
  assert.deepEqual(v.ventana, { desde: "2024-10-01", hasta: "2025-04-30" });

  const corto = L.vacaciones({ ingreso: "2024-09-01", anio: 2024, sueldo: 1000000 });
  assert.equal(corto.regla, "art. 153");
  assert.equal(corto.corridos, 122);
  assert.equal(corto.dias, Math.floor(Math.floor(122 * 5 / 7) / 20)); // 87 efectivos → 4 días
  assert.equal(corto.dias, 4);
  const conReales = L.vacaciones({ ingreso: "2024-09-01", anio: 2024, sueldo: 1000000, diasTrabajadosReales: 100 });
  assert.equal(conReales.dias, 5);

  // Justo la mitad del año: entra en la escala.
  const mitad = L.vacaciones({ ingreso: "2023-07-02", anio: 2023, sueldo: 1 });
  assert.equal(mitad.corridos, 183);
  assert.ok(mitad.mitadDelAnio);
});

test("aguinaldo: semestre completo y proporcional", () => {
  const completo = L.aguinaldo({ mejorSueldo: 2000000, fecha: "2024-06-30" });
  assert.equal(completo.semestre.n, 1);
  assert.equal(completo.semestre.pago, "2024-06-30");
  assert.ok(completo.completo);
  assert.equal(completo.bruto, 1000000);
  assert.equal(completo.aportes, 170000);
  assert.equal(completo.neto, 830000);

  const segundo = L.aguinaldo({ mejorSueldo: 1000000, fecha: "2024-12-18" });
  assert.equal(segundo.semestre.n, 2);
  assert.equal(segundo.semestre.pago, "2024-12-18");

  // Ingresó el 1 de abril: trabajó abril, mayo y junio (91 días de 182).
  const prop = L.aguinaldo({ mejorSueldo: 1000000, fecha: "2024-06-30", ingreso: "2024-04-01" });
  assert.equal(prop.diasTrabajados, 91);
  assert.equal(prop.diasSemestre, 182);
  cerca(prop.bruto, 500000 * 91 / 182, "SAC proporcional");

  // Egresa el 15 de septiembre: del 1/7 al 15/9 son 77 días de 184.
  const egreso = L.aguinaldo({ mejorSueldo: 1000000, egreso: "2024-09-15" });
  assert.equal(egreso.diasTrabajados, 77);
  cerca(egreso.bruto, 500000 * 77 / 184, "SAC al egreso");

  // Licencia sin goce de sueldo descuenta días.
  const sinGoce = L.aguinaldo({ mejorSueldo: 1000000, fecha: "2024-06-30", diasSinGoce: 30 });
  assert.equal(sinGoce.diasTrabajados, 152);
});

test("validación de la liquidación", () => {
  const e = L.validarLiquidacion({ ingreso: "x", egreso: "2024-01-01", sueldo: 0, motivo: "nada" });
  assert.ok(e.ingreso && e.sueldo && e.motivo);
  assert.ok(L.validarLiquidacion({ ingreso: "2024-02-01", egreso: "2024-01-01", sueldo: 1, motivo: "despido" }).egreso);
  assert.ok(L.validarLiquidacion({ ingreso: "2024-01-01", egreso: "2024-02-01", sueldo: 1, motivo: "despido", tope: -3 }).tope);
  assert.deepEqual(L.validarLiquidacion({ ingreso: "2024-01-01", egreso: "2024-02-01", sueldo: 1, motivo: "despido", tope: "" }), {});
  assert.ok(L.liquidacionFinal({ ingreso: "x" }).errores);
});

test("despido sin causa: caso completo calculado a mano", () => {
  // Ingreso 15/5/2019, despido 13/10/2024, sueldo $1.000.000, sin preaviso.
  const r = L.liquidacionFinal({ ingreso: "2019-05-15", egreso: "2024-10-13", sueldo: 1000000, motivo: "despido" });
  const c = Object.fromEntries(r.conceptos.map((x) => [x.id, x.monto]));
  assert.equal(r.aniosIndemnizables, 6);          // 5 años, 4 meses, 29 días → 6
  assert.equal(r.mesesPreaviso, 2);
  cerca(c.dias, 1000000 / 30 * 13, "13 días de octubre");
  cerca(c.sac, 500000 * 105 / 184, "SAC: 1/7 al 13/10 = 105 días");
  cerca(c.vacaciones, 1000000 / 25 * (14 * 287 / 366), "vacaciones: 287 días de 2024");
  cerca(c["sac-vacaciones"], c.vacaciones / 12, "SAC vacaciones");
  assert.equal(c.antiguedad, 6000000);
  assert.equal(c.preaviso, 2000000);
  cerca(c["sac-preaviso"], 2000000 / 12, "SAC preaviso");
  assert.equal(c.integracion, 600000);            // 18 días que faltan de octubre
  assert.equal(c["sac-integracion"], 50000);
  cerca(r.totales.remunerativo, c.dias + c.sac, "remunerativo");
  cerca(r.totales.aportes, (c.dias + c.sac) * 0.17, "aportes solo sobre lo remunerativo");
  cerca(r.totales.bruto, r.conceptos.reduce((s, x) => s + x.monto, 0), "bruto");
  cerca(r.totales.neto, r.totales.bruto - r.totales.aportes, "neto");
  assert.equal(r.avisos.length, 0);
});

test("despido con preaviso otorgado y egreso a fin de mes", () => {
  const r = L.liquidacionFinal({ ingreso: "2022-01-10", egreso: "2024-11-30", sueldo: 900000, motivo: "despido", preavisoOtorgado: true });
  const ids = r.conceptos.map((x) => x.id);
  assert.ok(!ids.includes("preaviso") && !ids.includes("integracion"));
  assert.equal(r.conceptos.find((x) => x.id === "dias").monto, 900000); // mes completo
  assert.equal(r.aniosIndemnizables, 3); // 2 años, 10 meses, 21 días
  assert.equal(r.conceptos.find((x) => x.id === "antiguedad").monto, 2700000);
  assert.equal(r.avisos.length, 1);
});

test("despido sin preaviso con egreso el último día: no hay integración", () => {
  const r = L.liquidacionFinal({ ingreso: "2020-02-01", egreso: "2024-02-29", sueldo: 500000, motivo: "despido" });
  const ids = r.conceptos.map((x) => x.id);
  assert.ok(ids.includes("preaviso"));
  assert.ok(!ids.includes("integracion"));
  assert.equal(r.conceptos.find((x) => x.id === "dias").monto, 500000); // febrero entero vale 30/30
});

test("despido en período de prueba: 15 días de preaviso y nada más", () => {
  const r = L.liquidacionFinal({ ingreso: "2024-08-01", egreso: "2024-10-15", sueldo: 1000000, motivo: "despido" });
  const c = Object.fromEntries(r.conceptos.map((x) => [x.id, x.monto]));
  assert.ok(r.prueba);
  assert.equal(r.aniosIndemnizables, 0);
  assert.equal(c.antiguedad, undefined);
  assert.equal(c.integracion, undefined);
  assert.equal(c.preaviso, 500000);
  cerca(c["sac-preaviso"], 500000 / 12, "SAC sobre 15 días");
  assert.ok(r.avisos[0].includes("período de prueba"));
  // Con período de prueba de 3 meses ya quedó afuera: hay antigüedad (mínimo un mes).
  const r3 = L.liquidacionFinal({ ingreso: "2024-08-01", egreso: "2024-11-15", sueldo: 1000000, motivo: "despido", mesesPrueba: 3 });
  assert.ok(!r3.prueba);
  assert.equal(r3.aniosIndemnizables, 1);
  assert.equal(r3.conceptos.find((x) => x.id === "antiguedad").monto, 1000000);
  assert.equal(r3.mesesPreaviso, 1);
});

test("tope del art. 245 y piso Vizzoti", () => {
  const base = { ingreso: "2014-01-01", egreso: "2024-06-30", sueldo: 3000000, motivo: "despido", preavisoOtorgado: true };
  const sinTope = L.liquidacionFinal(base);
  assert.equal(sinTope.conceptos.find((x) => x.id === "antiguedad").monto, 3000000 * 11); // 10 años y 6 meses → 11
  const conTope = L.liquidacionFinal({ ...base, tope: 2500000 });
  assert.equal(conTope.conceptos.find((x) => x.id === "antiguedad").monto, 2500000 * 11);
  const topeBajo = L.liquidacionFinal({ ...base, tope: 1000000 });
  cerca(topeBajo.conceptos.find((x) => x.id === "antiguedad").monto, 3000000 * 0.67 * 11, "piso del 67 %");
  assert.ok(topeBajo.conceptos.find((x) => x.id === "antiguedad").calculo.includes("Vizzoti"));
  const topeAlto = L.liquidacionFinal({ ...base, tope: 9000000 });
  assert.equal(topeAlto.conceptos.find((x) => x.id === "antiguedad").monto, 3000000 * 11);
});

test("mejor sueldo del último año para la antigüedad, sueldo actual para el resto", () => {
  const r = L.liquidacionFinal({ ingreso: "2020-01-01", egreso: "2024-10-31", sueldo: 1000000, mejorSueldo: 1200000, motivo: "despido" });
  assert.equal(r.conceptos.find((x) => x.id === "antiguedad").monto, 1200000 * 5); // 4 años 10 meses → 5
  assert.equal(r.conceptos.find((x) => x.id === "preaviso").monto, 1000000);
});

test("renuncia y despido con causa: solo lo proporcional", () => {
  for (const motivo of ["renuncia", "con-causa"]) {
    const r = L.liquidacionFinal({ ingreso: "2021-03-01", egreso: "2024-10-13", sueldo: 1000000, motivo });
    const ids = r.conceptos.map((x) => x.id);
    assert.deepEqual(ids, ["dias", "sac", "vacaciones", "sac-vacaciones"]);
    assert.equal(r.aniosIndemnizables, 0);
    assert.equal(r.mesesPreaviso, 0);
    assert.equal(r.avisos.length, 1);
  }
});

test("formato de pesos", () => {
  assert.equal(L.fmt(0), "$ 0,00");
  assert.equal(L.fmt(999.999), "$ 1.000,00");
  assert.equal(L.fmt(1234567.891), "$ 1.234.567,89");
  assert.equal(L.redondear(0.125), 0.13);
});

test("lectura de importes escritos a la argentina", () => {
  assert.equal(L.parsearPesos("1.250.000"), 1250000);
  assert.equal(L.parsearPesos("1250000,50"), 1250000.5);
  assert.equal(L.parsearPesos("$ 1.250.000,50"), 1250000.5);
  assert.equal(L.parsearPesos("1250000.50"), 1250000.5);
  assert.equal(L.parsearPesos("1250000"), 1250000);
  assert.equal(L.parsearPesos(" 900 000 "), 900000);
  assert.ok(Number.isNaN(L.parsearPesos("")));
  assert.ok(Number.isNaN(L.parsearPesos("un millón")));
  assert.ok(Number.isNaN(L.parsearPesos("-5")));
  assert.equal(L.parsearPesos(12.5), 12.5);
});
