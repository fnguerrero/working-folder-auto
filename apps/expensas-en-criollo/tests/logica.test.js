"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const mes = (m, filas) => ({ mes: m, rubros: filas.map(([nombre, monto]) => ({ nombre, monto, categoria: L.categorizar(nombre) })) });
const plano = (s) => s.replace(/ /g, " ");
const datos = (meses, extra) => Object.assign(L.vacio(), { meses }, extra);

test("lee montos en formato argentino y en otros", () => {
  const casos = [
    ["1.234.567,89", 1234567.89], ["$ 1.000", 1000], ["1000", 1000], ["1234,5", 1234.5], ["1234.56", 1234.56],
    ["1,234,567.89", 1234567.89], ["12,345.60", 12345.6], ["-1.500,00", -1500], ["(500)", -500],
    ["500,00-", -500], ["$-20", -20], [1500.004, 1500],
  ];
  for (const [t, v] of casos) assert.equal(L.parsearMonto(t), v, String(t));
});

test("rechaza lo que no es un monto", () => {
  for (const t of ["", "abc", "10/2026", "1.23.4", "12.3456", "1..2", null, undefined, NaN, "99999999999999999"]) {
    assert.equal(L.parsearMonto(t), null, String(t));
  }
});

test("lee el texto pegado de una liquidación", () => {
  const r = L.leerTexto([
    "LIQUIDACIÓN DE EXPENSAS - OCTUBRE 2026",
    "Período 10/2026",
    "",
    "1. SUELDOS Y CARGAS",
    "Sueldo encargado ........ $ 1.233.000,00",
    "Cargas sociales\t616.000,00",
    "\"Luz espacios comunes\";\"306.000,50\"",
    "- Abono ascensor  243.000,00  8,4%",
    "Reparación bomba, factura 0001-00012345 $385.000",
    "Pintura cuota 2/6: 90.000",
    "Bonificación seguro  -1.000,00",
    "Expensa extraordinaria 0,00",
    "Subtotal sueldos 1.849.000,00",
    "TOTAL GASTOS $ 2.872.000,50",
    "Saldo anterior 50.000,00",
  ].join("\r\n"));
  assert.deepEqual(r.rubros.map((x) => [x.nombre, x.monto]), [
    ["Sueldo encargado", 1233000],
    ["Cargas sociales", 616000],
    ["Luz espacios comunes", 306000.5],
    ["Abono ascensor", 243000],
    ["Reparación bomba, factura 0001-00012345", 385000],
    ["Pintura cuota 2/6", 90000],
    ["Bonificación seguro", -1000],
  ]);
  assert.equal(r.total, 2872000.5);
  assert.equal(r.suma, 2872000.5);
  assert.equal(r.ignorados.length, 7);
});

test("con varias columnas de importes toma la última y limpia el nombre", () => {
  const r = L.leerTexto("Agua   100.000,00   20.000,00   120.000,00\nGas  -  5.000,00\nLuz\t$ 1.000,00\t$ 2.000,00");
  assert.deepEqual(r.rubros.map((x) => [x.nombre, x.monto]), [["Agua", 120000], ["Gas", 5000], ["Luz", 2000]]);
});

test("un año suelto no es un importe, pero con $ sí", () => {
  assert.equal(L.leerTexto("Liquidación octubre 2026").rubros.length, 0);
  assert.equal(L.leerTexto("Fotocopias $ 2000").rubros[0].monto, 2000);
});

test("clasifica los rubros habituales", () => {
  const casos = {
    sueldos: ["Sueldo encargado", "Cargas sociales", "SUTERH", "ART", "Aguinaldo", "Seguro ART encargado"],
    servicios: ["Edesur", "Luz de espacios comunes", "AySA", "Agua", "Metrogas", "Gas"],
    abonos: ["Abono ascensores", "Abono de mantenimiento de bombas", "Fumigación", "Servicio de vigilancia", "Limpieza de tanques"],
    mantenimiento: ["Reparación de la bomba de agua", "Pintura de palier", "Artículos de limpieza", "Art. de limpieza", "Destapación pluvial", "Cambio de luz de emergencia"],
    administracion: ["Honorarios de administración", "Gastos bancarios", "Comisión banco"],
    seguros: ["Seguro integral del edificio", "Póliza incendio"],
    reserva: ["Fondo de reserva", "Fondo de obras"],
    otros: ["Gastos varios", "Refrigerio asamblea"],
  };
  for (const [id, nombres] of Object.entries(casos)) for (const n of nombres) assert.equal(L.categorizar(n), id, n);
});

test("reconoce el mismo rubro entre meses", () => {
  assert.equal(L.clave("Sueldo encargado - Septiembre 2026"), L.clave("SUELDO ENCARGADO octubre 2026"));
  assert.equal(L.clave("Luz, factura 0001-123"), L.clave("Luz factura Nº 0001-999"));
  assert.notEqual(L.clave("Luz"), L.clave("Gas"));
  assert.equal(L.clave("2026"), "2026");
});

test("meses: siguiente, rango y nombre", () => {
  assert.equal(L.mesSiguiente("2026-12"), "2027-01");
  assert.deepEqual(L.rangoMeses("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(L.nombreMes("2026-09"), "septiembre 2026");
  assert.ok(!L.esMes("2026-13"));
});

test("compone la inflación y exige todos los meses", () => {
  const i = { "2026-09": 10, "2026-10": 10 };
  assert.ok(Math.abs(L.inflacionEntre(i, "2026-08", "2026-10") - 21) < 1e-9);
  assert.ok(Math.abs(L.inflacionEntre(i, "2026-09", "2026-10") - 10) < 1e-9);
  assert.equal(L.inflacionEntre(i, "2026-07", "2026-10"), null);
  assert.equal(L.inflacionEntre(i, "2026-10", "2026-10"), null);
});

test("compara contra el mes anterior y la inflación", () => {
  const d = datos(
    [mes("2026-10", [["Luz", 150], ["Sueldo", 880], ["Reparación portón", 100]]), mes("2026-09", [["Luz", 100], ["Sueldo", 800], ["Pintura", 100]])],
    { inflacion: { "2026-10": 10 } }
  );
  const a = L.analizar(d, "2026-10");
  assert.equal(a.previo, "2026-09");
  assert.equal(a.total, 1130);
  assert.equal(a.diferencia, 130);
  assert.ok(Math.abs(a.variacion - 13) < 1e-9);
  assert.ok(Math.abs(a.real - (1.13 / 1.1 - 1) * 100) < 1e-9);
  assert.equal(a.exceso, 30);
  const r = Object.fromEntries(a.rubros.map((x) => [x.nombre, x]));
  assert.equal(r.Luz.salto, "suba");
  assert.equal(r.Luz.deMas, 40);
  assert.equal(r.Sueldo.salto, null);
  assert.equal(r["Reparación portón"].salto, "nuevo");
  assert.equal(r.Pintura.estado, "no-esta");
  assert.equal(r.Pintura.diferencia, -100);
  assert.equal(a.subas[0].nombre, "Reparación portón");
  assert.equal(L.sumar(a.categorias), 1130);
  assert.equal(L.sumar(a.rubros.map((x) => ({ monto: x.diferencia }))), 130);
});

test("sin inflación usa la mediana, solo con tres rubros comparables o más", () => {
  const d = datos([mes("2026-09", [["Luz", 100], ["Gas", 100], ["Agua", 100]]), mes("2026-10", [["Luz", 105], ["Gas", 106], ["Agua", 150]])]);
  const a = L.analizar(d, "2026-10");
  assert.equal(a.tipoReferencia, "mediana");
  assert.ok(Math.abs(a.referencia - 6) < 1e-9);
  assert.equal(a.real, null);
  assert.deepEqual(a.saltos.map((x) => x.nombre), ["Agua"]);
  const pocos = L.analizar(datos([mes("2026-09", [["Luz", 100]]), mes("2026-10", [["Luz", 300]])]), "2026-10");
  assert.equal(pocos.tipoReferencia, null);
  assert.equal(pocos.saltos.length, 0);
});

test("los ajustes filtran el ruido", () => {
  const meses = [mes("2026-09", [["Sueldo", 100000], ["Sellos", 10]]), mes("2026-10", [["Sueldo", 100000], ["Sellos", 30]])];
  assert.equal(L.analizar(datos(meses, { inflacion: { "2026-10": 0 } }), "2026-10").saltos.length, 0);
  assert.equal(L.analizar(datos(meses, { inflacion: { "2026-10": 0 }, ajustes: { puntos: 10, peso: 0 } }), "2026-10").saltos.length, 1);
});

test("primer mes, meses salteados, repetidos y rubro habitual", () => {
  const meses = [mes("2026-06", [["Luz", 100]]), mes("2026-07", [["Luz", 110]]), mes("2026-09", [["Luz", 100], ["Luz", 50]])];
  const d = datos(meses);
  const primero = L.analizar(d, "2026-06");
  assert.equal(primero.previo, null);
  assert.equal(primero.diferencia, null);
  assert.equal(primero.saltos.length, 0);
  assert.match(L.enCriollo(primero)[0], /Cargá un mes anterior/);
  const ultimo = L.analizar(d, "2026-09");
  assert.ok(ultimo.saltea);
  assert.equal(ultimo.rubros[0].monto, 150);
  assert.ok(Math.abs(ultimo.rubros[0].habitual - 10) < 1e-9);
  assert.equal(L.analizar(d, "2030-01"), null);
});

test("cuenta en criollo la suba, la baja y el empate", () => {
  const frases = (a, b, inflacion) => plano(L.enCriollo(L.analizar(datos([mes("2026-09", a), mes("2026-10", b)], { inflacion }), "2026-10")).join(" "));
  assert.match(frases([["Luz", 1000]], [["Luz", 1200]], { "2026-10": 2 }), /subieron 20 % \(\$ 200\).*inflación fue 2 %.*de más.*Luz \(\+\$ 200\)/);
  assert.match(frases([["Luz", 1000]], [["Luz", 900]], { "2026-10": 2 }), /bajaron 10 %.*de menos.*Lo que más bajó: Luz \(-\$ 100\)/);
  assert.match(frases([["Luz", 1000]], [["Luz", 1000]], {}), /quedaron igual.*Falta cargar la inflación/);
  assert.match(frases([["Luz", 1000]], [["Luz", 1020]], { "2026-10": 2 }), /parejos con la inflación/);
});

test("el ejemplo es coherente y marca lo que se plantó", () => {
  const d = L.ejemplo();
  assert.deepEqual(L.validar(JSON.parse(JSON.stringify(d))), d);
  const a = L.analizar(d, "2026-10");
  assert.deepEqual(a.saltos.map((x) => x.nombre).sort(), ["Honorarios de administración", "Luz de espacios comunes", "Reparación de la bomba de agua"]);
  assert.equal(L.preguntas(a).length, 3);
  assert.match(L.preguntas(a).join("\n"), /No figuraba en septiembre 2026/);
});

test("valida lo importado", () => {
  assert.throws(() => L.validar(null), /no es de Expensas/);
  assert.throws(() => L.validar({ app: "otra" }), /no es de Expensas/);
  assert.throws(() => L.validar({ app: L.APP, version: 2, meses: [] }), /versión/);
  assert.throws(() => L.validar({ app: L.APP, version: 1 }), /lista de meses/);
  const base = (meses) => ({ app: L.APP, version: 1, meses });
  assert.throws(() => L.validar(base([{ mes: "x", rubros: [] }])), /mal armado/);
  assert.throws(() => L.validar(base([{ mes: "2026-01", rubros: [] }, { mes: "2026-01", rubros: [] }])), /repetido/);
  assert.throws(() => L.validar(base([{ mes: "2026-01", rubros: [{ nombre: "Luz", monto: "5" }] }])), /sin nombre o sin importe/);
  const d = L.validar(Object.assign(base([{ mes: "2026-02", rubros: [{ nombre: " Luz ", monto: 5, categoria: "<x>" }] }, { mes: "2026-01", rubros: [] }]),
    { coeficiente: 500, inflacion: { "2026-02": 2, basura: 1, "2026-01": "3" }, ajustes: { puntos: -1, peso: 2 }, extra: 1 }));
  assert.deepEqual(d.meses.map((m) => m.mes), ["2026-01", "2026-02"]);
  assert.deepEqual(d.meses[1].rubros[0], { nombre: "Luz", categoria: "servicios", monto: 5 });
  assert.equal(d.coeficiente, null);
  assert.deepEqual(d.inflacion, { "2026-02": 2 });
  assert.deepEqual(d.ajustes, { puntos: 10, peso: 2 });
  assert.equal(d.extra, undefined);
});

test("formatea pesos y porcentajes", () => {
  assert.equal(plano(L.pesos(1234567.8)), "$ 1.234.568");
  assert.equal(plano(L.pesos(-0.2)), "$ 0");
  assert.equal(plano(L.pesos(-1500)), "-$ 1.500");
  assert.equal(plano(L.porcentaje(-0.01)), "0 %");
  assert.equal(plano(L.conSigno(5.25, L.porcentaje)), "+5,3 %");
});
