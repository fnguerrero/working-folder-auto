// Tests de la lógica pura. Se corren con: node --test apps/dividir-gastos/tests
// Los casos con números están hechos a mano; el comentario de cada uno muestra la cuenta.
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../logica.js");

const evento = (personas, gastos, extra) => Object.assign({
  id: "e1", nombre: "Prueba", fecha: "2026-10-25", redondear: true, pagos: [],
  personas: personas.map((n) => ({ id: n, nombre: n, alias: "" })), gastos,
}, extra);
const iguales = (...ids) => Object.fromEntries(ids.map((id) => [id, true]));
const gasto = (id, monto, pagador, reparto, modo) => ({ id, desc: id, monto, fecha: "2026-10-25", pagador, modo: modo || "iguales", reparto });
const porId = (lista, campo) => Object.fromEntries(lista.map((f) => [f.id, f[campo || "saldo"]]));

// Aplica las transferencias a los saldos y verifica que todos queden en cero.
function quedanAMano(saldos, transf) {
  const s = porId(saldos);
  transf.forEach((t) => { s[t.de] += t.monto; s[t.a] -= t.monto; });
  return Object.values(s).every((v) => v === 0);
}

test("importes: parseo argentino y formato es-AR", () => {
  assert.equal(D.aCentavos("12.345"), 12345_00);
  assert.equal(D.aCentavos("12.345,50"), 12345_50);
  assert.equal(D.aCentavos("12345.5"), 12345_50);
  assert.equal(D.aCentavos("$ 1.234.567,89"), 123456789);
  assert.equal(D.aCentavos("1500"), 1500_00);
  assert.equal(D.aCentavos(99.99), 9999);
  assert.ok(Number.isNaN(D.aCentavos("doce")));
  assert.ok(Number.isNaN(D.aCentavos("")));
  assert.ok(Number.isNaN(D.aCentavos("1,234")));
  assert.equal(D.formatoPesos(48000_00), "$ 48.000");
  assert.equal(D.formatoPesos(333_33), "$ 333,33");
  assert.equal(D.formatoPesos(1234567_05), "$ 1.234.567,05");
  assert.equal(D.formatoPesos(-2400_00), "-$ 2.400");
  assert.equal(D.formatoPesos(0, true), "$ 0,00");
  assert.equal(D.aCentesimas("33,33"), 3333);
  assert.equal(D.aCentesimas("50 %"), 5000);
  assert.equal(D.formatoPorcentaje(3334), "33,34 %");
  assert.equal(D.fechaCorta("2026-10-25"), "25/10/2026");
});

test("repartir: resto mayor, siempre suma exacto y el centavo de más va al primero", () => {
  // $1.000 entre 3 = 333,333...: 333,34 + 333,33 + 333,33.
  assert.deepEqual(D.repartir(1000_00, [1, 1, 1]), [33334, 33333, 33333]);
  // $1 entre 3: 34 + 33 + 33 centavos.
  assert.deepEqual(D.repartir(100, [1, 1, 1]), [34, 33, 33]);
  // $10 en 2 a 1: 6,666... y 3,333...: el resto mayor es el del primero.
  assert.deepEqual(D.repartir(1000, [2, 1]), [667, 333]);
  // Un centavo entre tres: lo pone el primero.
  assert.deepEqual(D.repartir(1, [1, 1, 1]), [1, 0, 0]);
  // $100 entre 7: 14,2857...: 7 × 14,28 = 99,96, así que los 4 centavos que faltan los ponen
  // los cuatro primeros (todos tienen el mismo resto).
  assert.deepEqual(D.repartir(100_00, [1, 1, 1, 1, 1, 1, 1]), [1429, 1429, 1429, 1429, 1428, 1428, 1428]);
  for (const [total, pesos] of [[99_99, [3, 3, 1]], [1, [5, 5]], [12345_67, [1, 2, 3, 4, 5, 6]]])
    assert.equal(D.repartir(total, pesos).reduce((a, b) => a + b, 0), total);
});

test("partesDeGasto: iguales, partes, porcentaje y montos", () => {
  const orden = ["A", "B", "C"];
  // Iguales sin C: $9.000 / 2.
  assert.deepEqual(D.partesDeGasto(gasto("g", 9000_00, "A", iguales("A", "B")), orden).partes, { A: 4500_00, B: 4500_00 });
  // Partes: pareja (2), uno (1) y un chico (0,5) sobre $7.000: 3,5 partes de $2.000.
  assert.deepEqual(D.partesDeGasto(gasto("g", 7000_00, "A", { A: 2, B: 1, C: 0.5 }, "partes"), orden).partes,
    { A: 4000_00, B: 2000_00, C: 1000_00 });
  // Porcentaje 33,33 / 33,33 / 33,34 de $1.000: 333,30 + 333,30 + 333,40.
  assert.deepEqual(D.partesDeGasto(gasto("g", 1000_00, "A", { A: 3333, B: 3333, C: 3334 }, "porcentaje"), orden).partes,
    { A: 333_30, B: 333_30, C: 333_40 });
  // Montos fijos.
  assert.deepEqual(D.partesDeGasto(gasto("g", 1000_00, "A", { A: 700_00, C: 300_00 }, "montos"), orden).partes, { A: 700_00, C: 300_00 });
  // Errores con cuánto falta o sobra.
  assert.equal(D.partesDeGasto(gasto("g", 1000_00, "A", { A: 5000, B: 4000 }, "porcentaje"), orden).error,
    "Los porcentajes suman 90 %: falta 10 %.");
  assert.equal(D.partesDeGasto(gasto("g", 1000_00, "A", { A: 6000, B: 6000 }, "porcentaje"), orden).error,
    "Los porcentajes suman 120 %: sobra 20 %.");
  assert.equal(D.partesDeGasto(gasto("g", 1000_00, "A", { A: 600_00, B: 300_00 }, "montos"), orden).error,
    "Los montos suman $ 900: faltan $ 100.");
  assert.equal(D.partesDeGasto(gasto("g", 1000_00, "A", {}), orden).ok, false);
  assert.equal(D.partesDeGasto(gasto("g", 0, "A", iguales("A")), orden).ok, false);
});

test("asado de 6: saldos y las 5 transferencias", () => {
  /* Nico pagó la carne, $30.000 entre los 6 ($5.000 c/u); Juan las bebidas, $12.000 entre
     5 porque Sofi no toma ($2.400 c/u); Ana el carbón y el pan, $6.000 entre 6 ($1.000 c/u).
     Les toca: $8.400 a cada uno y $6.000 a Sofi. Total $48.000.
     Saldos: Nico 30.000 - 8.400 = +21.600, Juan 12.000 - 8.400 = +3.600,
     Ana 6.000 - 8.400 = -2.400, Pedro y Lu -8.400, Sofi -6.000.
     Ningún subgrupo suma cero (3.600 no se arma con 2.400, 6.000 ni 8.400), así que
     el mínimo es 6 - 1 = 5 transferencias. */
  const ev = D.ejemplo();
  const L = D.liquidar(ev);
  assert.equal(L.total, 48000_00);
  assert.deepEqual(L.saldos.map((s) => [s.nombre, s.pagado, s.consumido, s.saldo]), [
    ["Nico", 30000_00, 8400_00, 21600_00], ["Juan", 12000_00, 8400_00, 3600_00], ["Ana", 6000_00, 8400_00, -2400_00],
    ["Pedro", 0, 8400_00, -8400_00], ["Lu", 0, 8400_00, -8400_00], ["Sofi", 0, 6000_00, -6000_00]]);
  assert.deepEqual(L.transferencias, [
    { de: "p3", a: "p2", monto: 2400_00 },  // Ana → Juan
    { de: "p4", a: "p1", monto: 8400_00 },  // Pedro → Nico
    { de: "p5", a: "p1", monto: 8400_00 },  // Lu → Nico
    { de: "p6", a: "p1", monto: 4800_00 },  // Sofi → Nico
    { de: "p6", a: "p2", monto: 1200_00 },  // Sofi → Juan
  ]);
  assert.deepEqual(L.redondeo, []);
  assert.ok(quedanAMano(L.saldos, L.transferencias));
});

test("mínimo exacto: encuentra los subgrupos que el goloso no ve", () => {
  /* A +7.000, B +5.000, C -4.000, D -3.000, E -5.000.
     El goloso empieza por los más grandes (E le paga 5.000 a A) y termina en 4.
     Pero {A, C, D} y {B, E} suman cero cada uno: 5 - 2 = 3 transferencias. */
  const saldos = [{ id: "A", saldo: 7000_00 }, { id: "B", saldo: 5000_00 }, { id: "C", saldo: -4000_00 },
    { id: "D", saldo: -3000_00 }, { id: "E", saldo: -5000_00 }];
  assert.equal(D.goloso(saldos.map((s, i) => Object.assign({ i }, s))).length, 4);
  assert.deepEqual(D.transferencias(saldos), [
    { de: "C", a: "A", monto: 4000_00 }, { de: "D", a: "A", monto: 3000_00 }, { de: "E", a: "B", monto: 5000_00 }]);
  // Dos parejas que se cancelan y nadie más: 2 transferencias, no 3.
  assert.equal(D.transferencias([{ id: "a", saldo: 100 }, { id: "b", saldo: 250 }, { id: "c", saldo: -250 }, { id: "d", saldo: -100 }]).length, 2);
  // Todos a mano: ninguna. Saldos que no suman cero: error.
  assert.deepEqual(D.transferencias([{ id: "a", saldo: 0 }, { id: "b", saldo: 0 }]), []);
  assert.throws(() => D.transferencias([{ id: "a", saldo: 100 }, { id: "b", saldo: -99 }]));
});

test("redondeo en pesos: $1.000 entre 3", () => {
  /* A pagó $1.000 entre A, B y C: partes 333,34 (A, el primero), 333,33 y 333,33.
     Saldos exactos: A +666,66, B -333,33, C -333,33.
     A pesos: se baja cada uno al peso (666, -334, -334, suman -2) y los 2 pesos que faltan
     van a los de mayor resto: B y C (0,67) antes que A (0,66). Quedan 666, -333, -333.
     B y C transfieren $333 cada uno y A se come 66 centavos. */
  const ev = evento(["A", "B", "C"], [gasto("g", 1000_00, "A", iguales("A", "B", "C"))]);
  const L = D.liquidar(ev);
  assert.deepEqual(L.saldos.map((s) => s.saldo), [666_66, -333_33, -333_33]);
  assert.deepEqual(L.transferencias, [{ de: "B", a: "A", monto: 333_00 }, { de: "C", a: "A", monto: 333_00 }]);
  assert.deepEqual(L.redondeo, [{ id: "A", diferencia: 66 }, { id: "B", diferencia: -33 }, { id: "C", diferencia: -33 }]);
  // Sin redondear: transferencias al centavo.
  const exacto = D.liquidar(Object.assign({}, ev, { redondear: false }));
  assert.deepEqual(exacto.transferencias, [{ de: "B", a: "A", monto: 333_33 }, { de: "C", a: "A", monto: 333_33 }]);
  assert.deepEqual(exacto.redondeo, []);
});

test("redondeo en pesos: viaje con dos gastos", () => {
  /* A pagó $10.000 de nafta entre A, B y C: 3.333,34 (A), 3.333,33 y 3.333,33.
     B pagó $5.000 de peajes entre B y C: 2.500 cada uno.
     Les toca: A 3.333,34, B 5.833,33, C 5.833,33.
     Saldos: A 10.000 - 3.333,34 = +6.666,66; B 5.000 - 5.833,33 = -833,33; C -5.833,33.
     Al peso: 6.666, -834, -5.834 (suman -2); los 2 pesos van a B y C (resto 0,67).
     Quedan B → A $833 y C → A $5.833. */
  const ev = evento(["A", "B", "C"], [gasto("nafta", 10000_00, "A", iguales("A", "B", "C")), gasto("peajes", 5000_00, "B", iguales("B", "C"))]);
  const L = D.liquidar(ev);
  assert.deepEqual(L.saldos.map((s) => s.consumido), [3333_34, 5833_33, 5833_33]);
  assert.deepEqual(L.saldos.map((s) => s.saldo), [6666_66, -833_33, -5833_33]);
  assert.deepEqual(L.transferencias, [{ de: "B", a: "A", monto: 833_00 }, { de: "C", a: "A", monto: 5833_00 }]);
  L.redondeo.forEach((r) => assert.ok(Math.abs(r.diferencia) < 100, "nadie se mueve un peso o más"));
});

test("redondearAPesos: suma cero, todo múltiplo de 100 y menos de un peso de diferencia", () => {
  // $100 entre 7 pagado por el primero: seis deben 14,28 o 14,29.
  const ev = evento(["a", "b", "c", "d", "e", "f", "g"], [gasto("g", 100_00, "a", iguales("a", "b", "c", "d", "e", "f", "g"))]);
  const r = D.redondearAPesos(D.saldos(ev).lista);
  assert.equal(r.reduce((a, f) => a + f.saldo, 0), 0);
  r.forEach((f) => { assert.equal(Math.abs(f.saldo % 100), 0); assert.ok(Math.abs(f.exacto - f.saldo) < 100); });
  // a pone 14,29 y le deben 85,71; b, c y d deben 14,29; e, f y g, 14,28.
  // Bajados al peso: 85 y seis veces -15 (suman -5). Los 5 pesos van a los de mayor resto:
  // e, f y g (0,72), y después a y b (0,71, por orden). Quedan 86, -14, -15, -15, -14, -14, -14.
  assert.deepEqual(r.map((f) => f.saldo), [86_00, -14_00, -15_00, -15_00, -14_00, -14_00, -14_00]);
});

test("pagos ya hechos: cuentan en el saldo", () => {
  const ev = D.ejemplo();
  ev.pagos = [{ id: "t1", de: "p4", a: "p1", monto: 8400_00, fecha: "2026-10-25" }];
  const L = D.liquidar(ev);
  assert.equal(porId(L.saldos).p4, 0);
  assert.equal(porId(L.saldos).p1, 13200_00);
  assert.equal(L.transferencias.length, 4);
  // Pagó de más: le devuelven la diferencia.
  ev.pagos.push({ id: "t2", de: "p5", a: "p1", monto: 9000_00 });
  assert.equal(porId(D.saldos(ev).lista).p5, 600_00);
});

test("mínimo exacto contra fuerza bruta en 300 casos al azar", () => {
  let semilla = 42;
  const azar = () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) / 2147483648;
  // Máxima cantidad de grupos que suman cero, por búsqueda directa (otra implementación).
  function maxGrupos(vals) {
    if (!vals.length) return 0;
    const [primero, ...resto] = vals;
    let mejor = 0;
    for (let m = 0; m < 1 << resto.length; m++) {
      let s = primero; const quedan = [];
      resto.forEach((v, i) => { if (m & (1 << i)) s += v; else quedan.push(v); });
      if (s === 0) mejor = Math.max(mejor, 1 + maxGrupos(quedan));
    }
    return mejor;
  }
  for (let caso = 0; caso < 300; caso++) {
    const n = 2 + Math.floor(azar() * 7);
    // Montos chicos para que haya subgrupos que suman cero.
    const vals = Array.from({ length: n - 1 }, () => (Math.floor(azar() * 9) - 4) * 1000);
    vals.push(-vals.reduce((a, b) => a + b, 0));
    const saldos = vals.map((v, i) => ({ id: "p" + i, saldo: v }));
    const t = D.transferencias(saldos);
    const noCero = vals.filter((v) => v !== 0);
    assert.equal(t.length, noCero.length - maxGrupos(noCero), "caso " + caso + ": " + vals);
    assert.ok(quedanAMano(saldos, t));
    t.forEach((x) => assert.ok(x.monto > 0 && x.de !== x.a));
    // Nadie paga y cobra a la vez.
    const pagan = new Set(t.map((x) => x.de));
    t.forEach((x) => assert.ok(!pagan.has(x.a)));
  }
});

test("muchas personas: 20 con el exacto en poco tiempo, 40 con el goloso", () => {
  const veinte = Array.from({ length: 20 }, (_, i) => ({ id: "p" + i, saldo: (i % 2 ? -1 : 1) * (1000 + i * 137) * 100 }));
  veinte[19].saldo -= veinte.reduce((a, f) => a + f.saldo, 0);
  const t0 = Date.now();
  const t = D.transferencias(veinte);
  assert.ok(Date.now() - t0 < 3000, "tardó " + (Date.now() - t0) + " ms");
  assert.ok(quedanAMano(veinte, t) && t.length <= 19);
  const cuarenta = Array.from({ length: 40 }, (_, i) => ({ id: "p" + i, saldo: i < 39 ? (i * 7919 % 5000 - 2500) * 100 : 0 }));
  cuarenta[39].saldo = -cuarenta.reduce((a, f) => a + f.saldo, 0);
  const t2 = D.transferencias(cuarenta);
  assert.ok(quedanAMano(cuarenta, t2) && t2.length <= 39);
});

test("normalizarGasto: desde el formulario y con errores por campo", () => {
  const ev = evento(["A", "B", "C"], []);
  let r = D.normalizarGasto({ desc: "  Hielo  ", monto: "1.500", pagador: "B", modo: "iguales", reparto: { A: true, B: true, C: false } }, ev);
  assert.ok(r.ok);
  assert.equal(r.gasto.desc, "Hielo");
  assert.equal(r.gasto.monto, 1500_00);
  assert.deepEqual(r.gasto.reparto, { A: true, B: true });
  assert.deepEqual(r.partes, { A: 750_00, B: 750_00 });
  assert.equal(r.gasto.fecha, "2026-10-25", "sin fecha, la del evento");
  r = D.normalizarGasto({ desc: "Regalo", monto: "10000", pagador: "A", modo: "porcentaje", reparto: { A: "50", B: "25,5", C: "24,5" } }, ev);
  assert.ok(r.ok);
  assert.deepEqual(r.partes, { A: 5000_00, B: 2550_00, C: 2450_00 });
  r = D.normalizarGasto({ desc: "Cena", monto: "9000", pagador: "A", modo: "montos", reparto: { A: "4.000", B: "5000" } }, ev);
  assert.deepEqual(r.partes, { A: 4000_00, B: 5000_00 });
  r = D.normalizarGasto({ desc: "Cabaña", monto: "100000", pagador: "C", modo: "partes", reparto: { A: "2", B: "1,5", C: "0,5" } }, ev);
  assert.deepEqual(r.partes, { A: 50000_00, B: 37500_00, C: 12500_00 });
  r = D.normalizarGasto({ desc: "", monto: "abc", pagador: "Z", modo: "iguales", reparto: {} }, ev);
  assert.ok(!r.ok);
  assert.deepEqual(Object.keys(r.errores).sort(), ["desc", "monto", "pagador"]);
  r = D.normalizarGasto({ desc: "x", monto: "100", pagador: "A", modo: "iguales", reparto: {} }, ev);
  assert.match(r.errores.reparto, /al menos una persona/);
  r = D.normalizarGasto({ desc: "x", monto: "100", pagador: "A", modo: "partes", reparto: { A: "dos" } }, ev);
  assert.match(r.errores.reparto, /no son números/);
});

test("personas: nombres repetidos y usos", () => {
  const ev = D.ejemplo();
  assert.equal(D.normalizarPersona({ nombre: "  nico " }, ev).ok, false);
  assert.equal(D.normalizarPersona({ nombre: "Nico" }, ev, "p1").ok, true, "renombrarse a sí mismo vale");
  assert.equal(D.normalizarPersona({ nombre: "" }, ev).ok, false);
  const r = D.normalizarPersona({ nombre: "Caro", alias: " caro.mp " }, ev);
  assert.equal(r.persona.alias, "caro.mp");
  assert.deepEqual(D.usosDePersona(ev, "p6"), { gastos: 2, pagos: 0, total: 2 });
  assert.equal(D.usosDePersona(ev, "nadie").total, 0);
});

test("resumen para WhatsApp", () => {
  const texto = D.resumenTexto(D.ejemplo());
  assert.match(texto, /^\*Asado del sábado \(ejemplo\)\* \(\d\d\/\d\d\/\d{4}\)/);
  assert.match(texto, /Total: \$ 48\.000 entre 6 personas/);
  assert.match(texto, /• Bebidas: \$ 12\.000, pagó Juan \(todos menos Sofi\)/);
  assert.match(texto, /• Nico: puso \$ 30\.000, le tocaba \$ 8\.400 → le deben \$ 21\.600/);
  assert.match(texto, /• Sofi: puso \$ 0, le tocaba \$ 6\.000 → debe \$ 6\.000/);
  assert.match(texto, /\*Para quedar a mano\* \(5 transferencias\)/);
  assert.match(texto, /• Pedro → Nico: \$ 8\.400 \(alias nico\.asado\.mp\)/);
  assert.doesNotMatch(texto, /Redondeado/);
  const redondeado = D.resumenTexto(evento(["A", "B", "C"], [gasto("Pizza", 1000_00, "A", iguales("A", "B", "C"))]));
  assert.match(redondeado, /• B → A: \$ 333\n/);
  assert.match(redondeado, /Redondeado a pesos enteros/);
  const aMano = D.resumenTexto(evento(["A", "B"], [gasto("x", 100_00, "A", iguales("A"))]));
  assert.match(aMano, /Están todos a mano/);
});

test("export e import de un evento", () => {
  const ev = D.ejemplo();
  const json = D.eventoAJSON(ev);
  let r = D.eventoDeJSON(json, []);
  assert.ok(r.ok && !r.copia);
  assert.deepEqual(D.liquidar(r.evento).transferencias, D.liquidar(ev).transferencias);
  r = D.eventoDeJSON(json, [ev]);
  assert.ok(r.ok && r.copia && r.evento.id !== ev.id, "si ya está, entra como copia");
  assert.equal(D.eventoDeJSON("{no es json", []).ok, false);
  assert.equal(D.eventoDeJSON('{"hola": 1}', []).ok, false);
  // Datos rotos: se descartan los gastos con pagador inexistente y los pagos inválidos.
  const roto = JSON.parse(json);
  roto.evento.gastos.push({ id: "gx", desc: "x", monto: 100, pagador: "fantasma", modo: "iguales", reparto: {} });
  roto.evento.pagos = [{ de: "p1", a: "p1", monto: 100 }, { de: "p1", a: "p2", monto: -5 }];
  r = D.eventoDeJSON(JSON.stringify(roto), []);
  assert.equal(r.evento.gastos.length, 3);
  assert.equal(r.evento.pagos.length, 0);
  assert.equal(D.nombreArchivo({ nombre: "Viaje a Córdoba 2026!" }), "dividir-viaje-a-cordoba-2026.json");
});

test("migrar: tolera basura y conserva los eventos válidos", () => {
  assert.deepEqual(D.migrar(null), D.estadoInicial());
  assert.deepEqual(D.migrar({ eventos: "x" }), D.estadoInicial());
  const est = D.migrar({ version: 1, eventos: [D.ejemplo(), { nombre: "sin listas" }, null] });
  assert.equal(est.eventos.length, 1);
  assert.equal(est.eventos[0].gastos.length, 3);
});

test("entreQuienes: cómo se nombra a los que entran en un gasto", () => {
  const ev = evento(["Ana", "Beto", "Caro", "Dani"], []);
  const de = (reparto, modo) => D.entreQuienes(ev, gasto("g", 1000_00, "Ana", reparto, modo));
  assert.equal(de(iguales("Ana", "Beto", "Caro", "Dani")), "entre todos");
  assert.equal(de(iguales("Ana", "Beto", "Caro")), "todos menos Dani");
  assert.equal(de(iguales("Ana", "Beto")), "entre Ana y Beto");
  assert.equal(de(iguales("Caro")), "solo Caro");
  assert.equal(de({ Ana: 2, Beto: 1, Caro: 1 }, "partes"), "todos menos Dani");
  assert.equal(de({}), "sin repartir");
});
