// Tests de la lógica pura. Se corren con: node --test apps/cuotas-en-curso/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const compra = (extra) => Object.assign({
  id: "a", desc: "Heladera", tienda: "Cetrogar", fecha: "2026-10-05", total: 120000_00,
  cuotas: 6, primeraCuota: "2026-11", tarjeta: "Visa", nota: "",
}, extra);

test("meses: índice, suma y diferencia sin pasar por Date", () => {
  assert.equal(L.indiceMes("2026-01"), 2026 * 12);
  assert.equal(L.mesDeIndice(L.indiceMes("2026-12")), "2026-12");
  assert.equal(L.sumarMeses("2026-11", 2), "2027-01");
  assert.equal(L.sumarMeses("2026-01", -1), "2025-12");
  assert.equal(L.diferenciaMeses("2026-10", "2027-03"), 5);
  assert.equal(L.mesDeFecha("2026-10-05"), "2026-10");
  assert.equal(L.mesActual(new Date(2026, 0, 31)), "2026-01");
  assert.equal(L.fechaActual(new Date(2026, 9, 8)), "2026-10-08");
  assert.equal(L.nombreMes("2026-03"), "marzo 2026");
  assert.equal(L.nombreMes("2026-03", true), "mar 26");
  assert.ok(L.esMes("2026-12"));
  assert.ok(!L.esMes("2026-13"));
  assert.ok(!L.esMes("2026-1"));
  assert.ok(L.esFecha("2026-02-28"));
  assert.ok(!L.esFecha("28/02/2026"));
});

test("importes: parseo argentino y formato", () => {
  assert.equal(L.aCentavos("120.000"), 120000_00);
  assert.equal(L.aCentavos("120.000,50"), 120000_50);
  assert.equal(L.aCentavos("120000.50"), 120000_50);
  assert.equal(L.aCentavos("$ 1.234.567,89"), 123456789);
  assert.equal(L.aCentavos("99,9"), 9990);
  assert.equal(L.aCentavos(1500.5), 150050);
  assert.ok(Number.isNaN(L.aCentavos("abc")));
  assert.ok(Number.isNaN(L.aCentavos("")));
  assert.ok(Number.isNaN(L.aCentavos(null)));
  assert.equal(L.formatoPesos(120000_00), "$ 120.000");
  assert.equal(L.formatoPesos(1234567_89), "$ 1.234.567,89");
  assert.equal(L.formatoPesos(-5000_00), "-$ 5.000");
  assert.equal(L.formatoPesos(0, true), "$ 0,00");
  assert.equal(L.porcentaje(3), "3 %");
  assert.equal(L.porcentaje(2.55), "2,6 %");
});

test("normalizarCompra: defaults, limpieza y errores por campo", () => {
  const r = L.normalizarCompra({ desc: "  Tele   LG ", fecha: "2026-10-05", total: "300.000",
    cuotas: "12", tarjeta: " Master " });
  assert.ok(r.ok);
  assert.equal(r.compra.desc, "Tele LG");
  assert.equal(r.compra.total, 300000_00);
  assert.equal(r.compra.cuotas, 12);
  assert.equal(r.compra.primeraCuota, "2026-11", "la primera cuota por defecto es el mes siguiente");
  assert.equal(r.compra.tarjeta, "Master");
  assert.ok(r.compra.id.startsWith("c"));

  const malo = L.normalizarCompra({ desc: "", fecha: "ayer", total: "0", cuotas: 100,
    primeraCuota: "2026-15" });
  assert.ok(!malo.ok);
  assert.deepEqual(Object.keys(malo.errores).sort(),
    ["cuotas", "desc", "fecha", "primeraCuota", "total"]);

  const sin = L.normalizarCompra({ desc: "Zapatillas", fecha: "2026-01-20", total: 50000_00, cuotas: 1 });
  assert.equal(sin.compra.tarjeta, L.SIN_TARJETA);
  assert.equal(sin.compra.primeraCuota, "2026-02");
  assert.equal(L.normalizarCompra({ id: "x", desc: "a", fecha: "2026-01-01", total: 1, cuotas: 1 }).compra.id, "x");
});

test("cuotasDe: iguales, el redondeo va a la última", () => {
  const cs = L.cuotasDe(compra({ total: 100000_00, cuotas: 3 }));
  assert.equal(cs.length, 3);
  assert.deepEqual(cs.map((c) => c.mes), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(cs.map((c) => c.importe), [3333333, 3333333, 3333334]);
  assert.equal(cs.reduce((s, c) => s + c.importe, 0), 100000_00);
  assert.deepEqual(cs[0], { n: 1, de: 3, mes: "2026-11", importe: 3333333 });
  assert.equal(L.ultimaCuota(compra()), "2027-04");
});

test("estadoCompra: la cuota del mes en curso cuenta como pendiente", () => {
  const c = compra();
  const antes = L.estadoCompra(c, "2026-10");
  assert.deepEqual([antes.pagadas, antes.restantes, antes.saldo], [0, 6, 120000_00]);
  assert.equal(antes.empezada, false);
  assert.equal(antes.cuotaDelMes, null);

  const medio = L.estadoCompra(c, "2027-01");
  assert.deepEqual([medio.pagadas, medio.restantes], [2, 4]);
  assert.equal(medio.pagado, 40000_00);
  assert.equal(medio.saldo, 80000_00);
  assert.equal(medio.cuotaDelMes.n, 3);
  assert.equal(medio.terminada, false);

  const fin = L.estadoCompra(c, "2027-05");
  assert.equal(fin.terminada, true);
  assert.equal(fin.saldo, 0);
  assert.equal(fin.ultimaCuota, "2027-04");
});

test("tarjetas: orden de aparición y color fijo", () => {
  const t = L.tarjetas([compra({ tarjeta: "Visa" }), compra({ id: "b", tarjeta: "Master" }),
    compra({ id: "c", tarjeta: "Visa" })]);
  assert.deepEqual(t.map((x) => x.nombre), ["Visa", "Master"]);
  assert.equal(t[0].color, L.PALETA[0]);
  assert.equal(L.colorTarjeta(t, "Master"), L.PALETA[1]);
  assert.equal(L.colorTarjeta(t, "Nueva"), L.PALETA[2]);
});

test("cuotasPorMes y resumenMes: apilado por tarjeta y tope", () => {
  const compras = [
    compra({ id: "a", total: 120000_00, cuotas: 6, primeraCuota: "2026-10", tarjeta: "Visa" }),
    compra({ id: "b", desc: "Celular", total: 60000_00, cuotas: 3, primeraCuota: "2026-11", tarjeta: "Master" }),
  ];
  const meses = L.cuotasPorMes(compras, "2026-10", 12);
  assert.equal(meses.length, 12);
  assert.equal(meses[0].mes, "2026-10");
  assert.equal(meses[0].total, 20000_00);
  assert.equal(meses[1].total, 40000_00);
  assert.deepEqual(meses[1].porTarjeta, { Visa: 20000_00, Master: 20000_00 });
  assert.equal(meses[3].items.find((i) => i.compraId === "b").ultima, true, "la 3 de 3 cae en enero");
  assert.equal(meses[5].total, 20000_00, "marzo 2027: sexta y última de la heladera");
  assert.equal(meses[6].total, 0);
  assert.equal(meses[11].mes, "2027-09");

  const r = L.resumenMes(compras, "2026-11", 30000_00);
  assert.equal(r.total, 40000_00);
  assert.deepEqual(r.porTarjeta, [{ tarjeta: "Visa", total: 20000_00 }, { tarjeta: "Master", total: 20000_00 }]);
  assert.equal(r.excedido, true);
  assert.equal(r.margen, -10000_00);
  assert.ok(Math.abs(r.proporcion - 4 / 3) < 1e-9);

  const sinTope = L.resumenMes(compras, "2026-11", null);
  assert.equal(sinTope.tope, null);
  assert.equal(sinTope.excedido, false);
  assert.equal(L.resumenMes(compras, "2027-01", null).terminanEsteMes, 1);
});

test("valorPresente y saldos: con 0 % coincide con el nominal", () => {
  assert.equal(L.valorPresente(10000_00, 12, 0), 10000_00);
  assert.equal(L.valorPresente(10000_00, 0, 3), 10000_00);
  assert.equal(L.valorPresente(10000_00, 12, 3), Math.round(10000_00 / Math.pow(1.03, 12)));
  const compras = [compra({ total: 120000_00, cuotas: 12, primeraCuota: "2026-10" })];
  const sin = L.saldos(compras, "2026-10", 0);
  assert.equal(sin.nominal, 120000_00);
  assert.equal(sin.presente, 120000_00);
  const con = L.saldos(compras, "2026-10", 3);
  assert.equal(con.nominal, 120000_00);
  assert.ok(con.presente < con.nominal);
  let esperado = 0;
  for (let k = 0; k < 12; k++) esperado += Math.round(10000_00 / Math.pow(1.03, k));
  assert.equal(con.presente, esperado);
  assert.equal(con.porCompra[0].restantes, 12);
  assert.equal(L.saldos(compras, "2027-12", 3).porCompra.length, 0, "terminada: no aparece");
});

test("simular: no toca las compras reales y marca los meses nuevos excedidos", () => {
  const compras = [compra({ total: 120000_00, cuotas: 12, primeraCuota: "2026-10" })];
  const copia = JSON.stringify(compras);
  const hip = L.normalizarCompra({ desc: "Notebook", fecha: "2026-10-08", total: 600000_00, cuotas: 6 }).compra;
  const s = L.simular(compras, hip, "2026-10", 12, 50000_00);
  assert.equal(JSON.stringify(compras), copia);
  assert.equal(s.cuota, 100000_00);
  assert.deepEqual(s.excedidos, ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
  assert.deepEqual(s.nuevosExcedidos, s.excedidos);
  assert.equal(s.picoSin, 10000_00);
  assert.equal(s.picoCon, 110000_00);
  assert.equal(s.ultimaCuota, "2027-04");
  assert.ok(s.meses[1].items.some((i) => i.simulada));
  assert.deepEqual(L.simular(compras, hip, "2026-10", 12, null).excedidos, []);
});

test("estado: inicial, migración tolerante e ida y vuelta JSON", () => {
  const ini = L.estadoInicial();
  assert.deepEqual(ini, { v: 1, ajustes: { tope: null, inflacion: 3 }, compras: [] });

  const roto = L.migrar({ ajustes: { tope: "150.000", inflacion: "4,5" }, compras: [
    compra(), { desc: "sin fecha" }, compra({ id: "a" }), compra({ id: "b" }),
  ] });
  assert.equal(roto.estado.ajustes.tope, 150000_00);
  assert.equal(roto.estado.ajustes.inflacion, 3, "una inflación ilegible vuelve al default");
  assert.deepEqual(roto.estado.compras.map((c) => c.id), ["a", "b"]);
  assert.deepEqual(roto.descartadas, [1, 2], "la rota y la de id repetido");
  assert.deepEqual(L.migrar(null).estado, ini);
  assert.deepEqual(L.migrar("basura").estado, ini);
  assert.equal(L.migrar({ ajustes: { inflacion: 4.5 } }).estado.ajustes.inflacion, 4.5);

  const estado = { v: 1, ajustes: { tope: 100000_00, inflacion: 2 }, compras: [compra()] };
  const texto = L.aJSON(estado, "2026-10-08");
  const parsed = JSON.parse(texto);
  assert.equal(parsed.app, "cuotas-en-curso");
  assert.equal(parsed.exportado, "2026-10-08");
  const vuelta = L.deJSON(texto);
  assert.equal(vuelta.error, undefined);
  assert.deepEqual(vuelta.estado, estado);
  assert.ok(L.deJSON("{").error);
  assert.ok(L.deJSON('{"hola":1}').error);
});

test("aCSV: una fila por cuota, ordenada por mes, con coma decimal", () => {
  const csv = L.aCSV([compra({ total: 100000_00, cuotas: 2, desc: 'Silla "gamer"' }),
    compra({ id: "b", desc: "Mesa", total: 3000_00, cuotas: 1, primeraCuota: "2026-10", tienda: "" })]);
  const lineas = csv.trim().split("\r\n");
  assert.equal(lineas[0], "mes;compra;tienda;tarjeta;cuota;de;importe");
  assert.equal(lineas[1], '2026-10;"Mesa";"";"Visa";1;1;3000,00');
  assert.equal(lineas[2], '2026-11;"Silla ""gamer""";"Cetrogar";"Visa";1;2;50000,00');
  assert.equal(lineas.length, 4);
  assert.equal(L.aCSV([]).trim(), "mes;compra;tienda;tarjeta;cuota;de;importe");
});
