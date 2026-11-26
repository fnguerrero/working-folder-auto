"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const HOY = "2026-11-25";
const cerca = (real, esperado, msg) => assert.ok(Math.abs(real - esperado) < 1e-9, `${msg || ""} ${real} != ${esperado}`);

// armar([["Leche", 10, [["2026-10-05", 100], ["2026-11-05", 110]]]])
function armar(lista) {
  let e = L.estadoVacio();
  for (const [nombre, cantidad, precios] of lista) {
    const r = L.agregarProducto(e, { nombre, unidad: "u", cantidad });
    e = r.estado;
    for (const [fecha, precio] of precios) e = L.anotarPrecio(e, r.producto.id, precio, fecha, HOY);
  }
  return e;
}

test("parsearNumero entiende el formato argentino y rechaza basura", () => {
  const casos = [["1.234,50", 1234.5], ["1234,5", 1234.5], ["1234.50", 1234.5], ["$ 1.234", 1234], ["1.234.567", 1234567],
    ["-0,4", -0.4], ["2,5 %", 2.5], ["0.125", 0.125], [",5", 0.5], [12, 12]];
  for (const [entrada, salida] of casos) assert.equal(L.parsearNumero(entrada), salida, String(entrada));
  for (const mala of ["", "abc", "1,2,3", "12abc", "1.2.3", "1,234.50", null, undefined, NaN, Infinity]) {
    assert.equal(L.parsearNumero(mala), null, String(mala));
  }
});

test("fechas y meses", () => {
  assert.equal(L.esFecha("2026-02-28"), true);
  assert.equal(L.esFecha("2026-02-29"), false);
  assert.equal(L.esFecha("2028-02-29"), true);
  assert.equal(L.esFecha("2026-13-01"), false);
  assert.equal(L.sumarMeses("2026-01", -1), "2025-12");
  assert.equal(L.sumarMeses("2026-11", -12), "2025-11");
  assert.equal(L.sumarMeses("2026-11", 2), "2027-01");
  assert.equal(L.finDeMes("2026-02"), "2026-02-28");
  assert.equal(L.finDeMes("2026-12"), "2026-12-31");
  assert.equal(L.diasEntre("2026-10-31", "2026-11-02"), 2);
  assert.equal(L.nombreMes("2026-11"), "noviembre 2026");
  assert.equal(L.fechaLocal(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("alta de producto: valida y no repite nombre con la misma unidad", () => {
  const r = L.agregarProducto(L.estadoVacio(), { nombre: "  Yerba  ", unidad: "kg", cantidad: "1,5" });
  assert.deepEqual(r.producto, { id: "p1", nombre: "Yerba", unidad: "kg", cantidad: 1.5 });
  assert.throws(() => L.agregarProducto(r.estado, { nombre: "yerba", unidad: "KG" }), /Ya tenés/);
  assert.equal(L.agregarProducto(r.estado, { nombre: "Yerba", unidad: "paquete 500 g" }).producto.id, "p2");
  assert.throws(() => L.agregarProducto(r.estado, { nombre: " " }), /nombre/);
  assert.throws(() => L.agregarProducto(r.estado, { nombre: "x", cantidad: "-1" }), /cantidad/);
  assert.throws(() => L.agregarProducto(r.estado, { nombre: "x", cantidad: "mucha" }), /cantidad/);
});

test("anotar precio: un valor por día, sin futuro ni ceros, sin mutar el estado anterior", () => {
  const e = armar([["Leche", 1, [["2026-11-01", 100]]]]);
  const corregido = L.anotarPrecio(e, "p1", "1.200,456", "2026-11-01", HOY);
  assert.equal(corregido.precios.length, 1);
  assert.equal(corregido.precios[0].precio, 1200.46);
  assert.equal(e.precios[0].precio, 100);
  assert.throws(() => L.anotarPrecio(e, "p1", 0, "2026-11-01", HOY), /mayor que cero/);
  assert.throws(() => L.anotarPrecio(e, "p1", "0,001", "2026-11-01", HOY), /mayor que cero/);
  assert.throws(() => L.anotarPrecio(e, "p1", 10, "2026-11-26", HOY), /futura/);
  assert.throws(() => L.anotarPrecio(e, "p9", 10, "2026-11-01", HOY), /no existe/);
});

test("editar y borrar producto arrastra sus precios", () => {
  const e = armar([["A", 1, [["2026-11-01", 100]]], ["B", 1, [["2026-11-01", 200]]]]);
  assert.equal(L.editarProducto(e, "p1", { nombre: "A", unidad: "u", cantidad: 3 }).productos[0].cantidad, 3);
  assert.throws(() => L.editarProducto(e, "p1", { nombre: "B", unidad: "u" }), /Ya tenés/);
  const sin = L.borrarProducto(e, "p1");
  assert.deepEqual([sin.productos.length, sin.precios.length], [1, 1]);
  assert.equal(L.borrarPrecio(e, "p2", "2026-11-01").precios.length, 1);
});

test("comparar: contra el mes pasado y contra hace un año usa el último precio de cada mes", () => {
  const e = armar([["Leche", 1, [["2025-11-10", 50], ["2026-10-02", 90], ["2026-10-28", 100], ["2026-11-03", 105], ["2026-11-20", 120]]]]);
  const mensual = L.comparar(e, "p1", "2026-11", 1, HOY);
  cerca(mensual.variacion, 20);
  assert.equal(mensual.base.fecha, "2026-10-28");
  // el cierre base es 30/11/2025
  cerca(L.comparar(e, "p1", "2026-11", 12, HOY).variacion, 140);
});

test("comparar: un mismo dato nunca hace de base y de actual", () => {
  const e = armar([["Leche", 1, [["2026-10-20", 100]]]]);
  const c = L.comparar(e, "p1", "2026-11", 1, HOY);
  assert.equal(c.variacion, null);
  assert.equal(c.motivo, "sin-actual");
});

test("comparar: la base vence a los 62 días", () => {
  const justo = armar([["A", 1, [["2026-08-30", 100], ["2026-11-02", 130]]]]); // 62 días antes del 31/10
  cerca(L.comparar(justo, "p1", "2026-11", 1, HOY).variacion, 30);
  const vencido = armar([["A", 1, [["2026-08-29", 100], ["2026-11-02", 130]]]]);
  assert.equal(L.comparar(vencido, "p1", "2026-11", 1, HOY).motivo, "sin-base");
});

test("comparar: ignora precios posteriores a hoy", () => {
  const e = armar([["A", 1, [["2026-10-05", 100], ["2026-11-05", 110]]]]);
  e.precios.push({ productoId: "p1", fecha: "2026-11-30", precio: 999 });
  cerca(L.comparar(e, "p1", "2026-11", 1, HOY).variacion, 10);
});

test("canasta: pondera por cantidad y los aportes suman la variación", () => {
  const e = armar([
    ["A", 10, [["2026-10-05", 100], ["2026-11-05", 110]]], // 1000 -> 1100
    ["B", 1, [["2026-10-05", 1000], ["2026-11-05", 1300]]] // 1000 -> 1300
  ]);
  const c = L.canasta(e, "2026-11", 1, HOY);
  cerca(c.variacion, 20);
  assert.deepEqual([c.costoBase, c.costoActual], [2000, 2400]);
  assert.deepEqual(c.incluidos.map((x) => x.producto.nombre), ["B", "A"]);
  cerca(c.incluidos.reduce((s, x) => s + x.aporte, 0), c.variacion);
  cerca(c.incluidos.reduce((s, x) => s + x.peso, 0), 100);
  cerca(c.cobertura, 100);
});

test("canasta: deja afuera lo incompleto, lo dice y no cuenta cantidad cero", () => {
  const e = armar([
    ["A", 1, [["2026-10-05", 100], ["2026-11-05", 110]]],
    ["Nuevo", 1, [["2026-11-05", 330]]],
    ["Viejo", 1, [["2026-10-05", 100]]],
    ["Vacio", 1, []],
    ["Fuera", 0, [["2026-10-05", 100], ["2026-11-05", 900]]]
  ]);
  const c = L.canasta(e, "2026-11", 1, HOY);
  cerca(c.variacion, 10);
  assert.deepEqual(c.excluidos.map((x) => [x.producto.nombre, x.motivo]),
    [["Nuevo", "sin-base"], ["Viejo", "sin-actual"], ["Vacio", "sin-precios"]]);
  cerca(c.cobertura, 110 / (110 + 330 + 100) * 100);
});

test("canasta sin datos comparables devuelve null, no cero", () => {
  assert.equal(L.canasta(L.estadoVacio(), "2026-11", 1, HOY).variacion, null);
  assert.equal(L.canasta(armar([["A", 1, [["2026-11-05", 1]]]]), "2026-11", 12, HOY).variacion, null);
});

test("oficial: carga, corrige y compone el interanual si están los 12 meses", () => {
  let e = L.estadoVacio();
  for (let i = 0; i < 11; i++) e = L.anotarOficial(e, L.sumarMeses("2026-10", -i), "2,0", "");
  assert.equal(L.oficialDe(e, "2026-10").interanual, null);
  e = L.anotarOficial(e, "2025-11", 2, null);
  const o = L.oficialDe(e, "2026-10");
  assert.equal(o.calculado, true);
  cerca(o.interanual, (Math.pow(1.02, 12) - 1) * 100);
  e = L.anotarOficial(e, "2026-10", "3", "31,5");
  assert.deepEqual(L.oficialDe(e, "2026-10"), { mensual: 3, interanual: 31.5, calculado: false });
  assert.equal(e.oficial.length, 12);
  assert.equal(L.borrarOficial(e, "2026-10").oficial.length, 11);
  assert.deepEqual(L.oficialDe(e, "2027-05"), { mensual: null, interanual: null, calculado: false });
  assert.throws(() => L.anotarOficial(e, "2026-10", ""), /mensual/);
  assert.throws(() => L.anotarOficial(e, "2026-10", 1, "x"), /interanual/);
  assert.throws(() => L.anotarOficial(e, "", 1), /mes/);
});

test("alertas: marca al que subió mucho más que el resto en dos meses", () => {
  const p = (final) => [["2026-09-10", 100], ["2026-11-10", final]];
  const e = armar([["Yerba", 1, p(140)], ["Pan", 1, p(104)], ["Leche", 1, p(106)]]);
  const a = L.alertas(e, "2026-11", HOY);
  assert.equal(a.length, 1);
  assert.equal(a[0].producto.nombre, "Yerba");
  cerca(a[0].variacion, 40);
  cerca(a[0].resto, 5);
});

test("alertas: nada si todo sube parejo, si no hay con qué comparar o si sube poco", () => {
  const p = (final) => [["2026-09-10", 100], ["2026-11-10", final]];
  assert.deepEqual(L.alertas(armar([["A", 1, p(140)], ["B", 1, p(135)], ["C", 1, p(130)]]), "2026-11", HOY), []);
  assert.deepEqual(L.alertas(armar([["A", 1, p(140)], ["B", 1, p(101)]]), "2026-11", HOY), []);
  assert.deepEqual(L.alertas(armar([["A", 1, p(109)], ["B", 1, p(100)], ["C", 1, p(100)]]), "2026-11", HOY), []);
});

test("meses disponibles y último mes con datos", () => {
  const e = armar([["A", 1, [["2026-08-31", 1], ["2026-10-01", 2]]]]);
  assert.deepEqual(L.mesesDisponibles(e, HOY), ["2026-11", "2026-10", "2026-09", "2026-08"]);
  assert.equal(L.ultimoMesConDatos(e, HOY), "2026-10");
  assert.deepEqual(L.mesesDisponibles(L.estadoVacio(), HOY), ["2026-11"]);
  assert.equal(L.ultimoMesConDatos(L.estadoVacio(), HOY), "2026-11");
});

test("gráfico: x proporcional al tiempo y puntos dentro del lienzo, aun con un solo dato", () => {
  const margen = { izq: 10, der: 10, sup: 10, inf: 10 };
  const g = L.puntosGrafico([{ fecha: "2026-01-01", precio: 100 }, { fecha: "2026-01-03", precio: 150 }, { fecha: "2026-01-11", precio: 200 }], 120, 60, margen);
  assert.deepEqual(g.puntos.map((p) => p.x), [10, 30, 110]);
  assert.ok(g.puntos[0].y > g.puntos[2].y);
  assert.ok(g.puntos.every((p) => p.y >= 10 && p.y <= 50));
  const uno = L.puntosGrafico([{ fecha: "2026-01-01", precio: 100 }], 120, 60, margen);
  assert.deepEqual([uno.puntos[0].x, uno.puntos[0].y], [60, 30]);
  assert.equal(L.puntosGrafico([], 120, 60, margen), null);
});

test("JSON: ida y vuelta sin pérdidas", () => {
  const e = L.ejemplo(HOY);
  const r = L.importarJSON("﻿" + L.exportarJSON(e));
  assert.equal(r.descartados, 0);
  assert.deepEqual(r.estado, e);
});

test("JSON: rechaza archivos ajenos y descarta entradas rotas", () => {
  assert.throws(() => L.importarJSON("no es json"), /JSON válido/);
  assert.throws(() => L.importarJSON("[]"), /no es una copia/);
  assert.throws(() => L.importarJSON('{"version":99,"productos":[],"precios":[]}'), /versión/);
  const r = L.normalizar({
    version: 1,
    productos: [{ id: "p1", nombre: "A", unidad: "u", cantidad: 1 }, { id: "<x>", nombre: "B" }, null, { id: "p1", nombre: "C" }],
    precios: [{ productoId: "p1", fecha: "2026-01-01", precio: 5 }, { productoId: "p1", fecha: "2026-01-01", precio: 6 },
      { productoId: "nadie", fecha: "2026-01-01", precio: 5 }, { productoId: "p1", fecha: "ayer", precio: 5 }, null],
    oficial: [{ mes: "2026-01", mensual: 2 }, { mes: "x", mensual: 2 }, null]
  });
  assert.equal(r.estado.productos.length, 1);
  assert.deepEqual(r.estado.precios, [{ productoId: "p1", fecha: "2026-01-01", precio: 6 }]);
  assert.equal(r.estado.oficial.length, 1);
  assert.equal(r.descartados, 9);
});

test("CSV: ida y vuelta con comillas, punto y coma, fórmulas y producto sin precios", () => {
  let e = armar([['Queso "duro"; barra', 0.5, [["2026-10-05", 1234.56]]], ["=SUMA(A1)", 2, [["2026-10-06", 10]]], ["Sin precio", 3, []]]);
  const csv = L.exportarCSV(e);
  assert.ok(csv.startsWith("producto;unidad;cantidad_mensual;fecha;precio\r\n"));
  assert.ok(csv.includes("'=SUMA(A1)"));
  assert.ok(csv.includes("1234,56"));
  const r = L.importarCSV(L.estadoVacio(), "﻿" + csv);
  assert.deepEqual(r.resumen, { productos: 3, precios: 2, descartados: 0 });
  assert.equal(L.exportarCSV(r.estado), csv);
});

test("CSV: se suma a lo existente, corrige el mismo día y acepta comas y fechas de planilla", () => {
  const e = armar([["Leche", 7, [["2026-10-05", 100]]]]);
  const r = L.importarCSV(e, "producto,unidad,cantidad_mensual,fecha,precio\nleche,u,99,5/10/2026,120\nPan,kg,2,2026-10-07,\"1.500,5\"\nRoto,u,1,2026-99-99,10\n,u,1,2026-10-07,10\n");
  assert.deepEqual(r.resumen, { productos: 1, precios: 2, descartados: 2 });
  assert.equal(r.estado.productos[0].cantidad, 7);
  assert.equal(L.preciosDe(r.estado, "p1")[0].precio, 120);
  assert.equal(L.preciosDe(r.estado, "p2")[0].precio, 1500.5);
  assert.equal(e.precios[0].precio, 100);
  assert.throws(() => L.importarCSV(e, "a;b\n1;2"), /columnas/);
  assert.throws(() => L.importarCSV(e, ""), /vacío/);
});

test("ejemplo: datos inventados que muestran comparaciones y una alerta, sin fechas futuras", () => {
  for (const hoy of [HOY, "2027-01-01", "2028-02-29"]) {
    const e = L.ejemplo(hoy);
    const mes = L.mesDe(hoy);
    assert.ok(e.precios.every((p) => p.fecha <= hoy), hoy);
    assert.equal(L.canasta(e, mes, 1, hoy).incluidos.length, 5, hoy);
    assert.equal(L.canasta(e, mes, 12, hoy).incluidos.length, 5, hoy);
    assert.deepEqual(L.alertas(e, mes, hoy).map((a) => a.producto.nombre), ["Yerba"], hoy);
  }
});
