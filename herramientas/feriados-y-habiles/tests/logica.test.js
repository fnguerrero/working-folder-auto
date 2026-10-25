// Tests de la lógica pura. Se corren con: node --test herramientas/feriados-y-habiles/tests/*.test.js
// Los plazos están calculados a mano con el almanaque; los mismos casos están en csharp/Prueba/Program.cs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../logica.js");

const suma = (d, n, o) => F.sumarHabiles(d, n, o).fecha;
const entre = (a, b, o) => F.habilesEntre(a, b, o).habiles;
const SIN_PUENTES = { puentesNoHabiles: false };
const CON_JUEVES = { juevesSantoNoHabil: true };

test("fechas: día de la semana, Pascua y formato", () => {
  assert.equal(F.diaSemana("2026-10-25"), 0);
  assert.equal(F.diaSemana("2024-02-29"), 4);
  assert.deepEqual([2024, 2025, 2026, 2027, 2028].map(F.pascua), ["2024-03-31", "2025-04-20", "2026-04-05", "2027-03-28", "2028-04-16"]);
  assert.equal(F.pascua(2019), "2019-04-21");
  assert.equal(F.corta("2026-11-23"), "lun 23/11/2026");
  assert.equal(F.larga("2026-11-23"), "lunes 23 de noviembre de 2026");
  assert.throws(() => F.aDia("2026-02-30"), /no existe/);
  assert.throws(() => F.aDia("23/11/2026"), /AAAA-MM-DD/);
});

test("regla del art. 6: martes y miércoles al lunes anterior, jueves y viernes al siguiente", () => {
  assert.equal(F.trasladar("2025-06-17"), "2025-06-16"); // martes
  assert.equal(F.trasladar("2026-06-17"), "2026-06-15"); // miércoles
  assert.equal(F.trasladar("2025-11-20"), "2025-11-24"); // jueves
  assert.equal(F.trasladar("2026-11-20"), "2026-11-23"); // viernes
  assert.equal(F.trasladar("2026-08-17"), "2026-08-17"); // lunes
  assert.equal(F.trasladar("2024-08-17"), "2024-08-17"); // sábado
  assert.equal(F.trasladar("2025-08-17"), "2025-08-17"); // domingo
});

test("la lista coincide con lo que da la ley, salvo lo que movió un decreto", () => {
  for (let a = F.PRIMER_ANIO; a <= F.ULTIMO_ANIO; a++) {
    const ley = F.segunLey(a).map((f) => `${f.fecha} ${f.concepto} ${f.original || ""}`.trim());
    const lista = F.feriadosDe(a).filter((f) => !["turistico", "puente"].includes(f.tipo)).map((f) => `${f.fecha} ${f.concepto} ${f.original || ""}`.trim());
    const excepciones = { 2025: { ley: ["2025-10-12 diversidad"], lista: ["2025-10-10 diversidad 2025-10-12"] } }[a] || { ley: [], lista: [] };
    assert.deepEqual(ley.filter((x) => !lista.includes(x)), excepciones.ley, `${a}: en la ley y no en la lista`);
    assert.deepEqual(lista.filter((x) => !ley.includes(x)), excepciones.lista, `${a}: en la lista y no en la ley`);
  }
});

test("cada año tiene 12 inamovibles, 4 trasladables, Jueves Santo y sus puentes, todos con fuente", () => {
  const puentes = { 2024: 3, 2025: 3, 2026: 3, 2027: 0 };
  for (let a = F.PRIMER_ANIO; a <= F.ULTIMO_ANIO; a++) {
    const l = F.feriadosDe(a);
    const cuantos = (t) => l.filter((f) => f.tipo === t).length;
    assert.equal(cuantos("inamovible"), 12, `${a} inamovibles`);
    assert.equal(cuantos("trasladable"), 4, `${a} trasladables`);
    assert.equal(cuantos("no laborable"), 1, `${a} Jueves Santo`);
    assert.equal(cuantos("turistico") + cuantos("puente"), puentes[a], `${a} puentes`);
    for (const f of l) {
      assert.ok(f.fuente, `${f.fecha} sin fuente`);
      if (f.tipo === "turistico" || f.tipo === "puente") {
        assert.ok([1, 5].includes(F.diaSemana(f.fecha)), `${f.fecha}: los puentes caen lunes o viernes`);
        assert.match(f.fuente, /Decreto|Resolución/);
      }
    }
  }
  assert.equal(F.FERIADOS.length, 77);
  assert.deepEqual(F.feriadosDe(2024).filter((f) => f.tipo === "turistico").map((f) => f.fecha), ["2024-04-01", "2024-06-21", "2024-10-11"]);
  assert.deepEqual(F.feriadosDe(2025).filter((f) => f.tipo === "puente").map((f) => f.fecha), ["2025-05-02", "2025-08-15", "2025-11-21"]);
  assert.deepEqual(F.feriadosDe(2026).filter((f) => f.tipo === "puente").map((f) => f.fecha), ["2026-03-23", "2026-07-10", "2026-12-07"]);
  assert.match(F.feriadosDe(2025).find((f) => f.fecha === "2025-10-10").fuente, /Resolución 139\/2025/);
  assert.ok(F.feriadosDe(2027).find((f) => f.fecha === "2027-11-20").aConfirmar);
  assert.equal(F.ANIOS[2026].completo, true);
  assert.equal(F.ANIOS[2027].completo, false);
  assert.throws(() => F.feriadosDe(2028), /No hay feriados cargados para 2028/);
});

test("sumar hábiles: casos a mano", () => {
  assert.equal(suma("2026-10-15", 10), "2026-10-29", "10 hábiles después del jueves 15/10/2026");
  assert.equal(suma("2026-11-19", 3), "2026-11-25", "el viernes 20/11/2026 es hábil: Soberanía pasa al lunes 23");
  assert.equal(suma("2026-03-20", 1), "2026-03-25", "puente del 23/3 y Memoria del 24/3");
  assert.equal(suma("2026-03-20", 1, SIN_PUENTES), "2026-03-23", "si el puente es hábil");
  assert.equal(suma("2026-03-31", 2), "2026-04-06", "Malvinas y Viernes Santo 2026");
  assert.equal(suma("2027-02-05", 1), "2027-02-10", "Carnaval 2027");
  assert.equal(suma("2025-10-09", 1), "2025-10-13", "el 12/10/2025 se adelantó al viernes 10");
  assert.equal(suma("2025-04-16", 1), "2025-04-17", "Jueves Santo hábil por defecto");
  assert.equal(suma("2025-04-16", 1, CON_JUEVES), "2025-04-21", "Jueves Santo y Viernes Santo");
  assert.equal(suma("2026-12-30", 2), "2027-01-04", "cambio de año con Año Nuevo viernes");
  assert.equal(suma("2026-07-13", -1), "2026-07-08", "para atrás: puente del 10/7 e Independencia");
  assert.equal(suma("2026-11-21", 0), "2026-11-24", "0 desde el sábado: el próximo hábil");
  assert.equal(suma("2026-11-24", 0), "2026-11-24", "0 desde un hábil: el mismo día");
  assert.equal(suma("2024-06-14", 3), "2024-06-24", "2024: Güemes 17, Belgrano 20 y feriado puente 21");
  assert.equal(suma("2024-06-14", 3, SIN_PUENTES), "2024-06-24", "en 2024 el puente fue feriado, no depende de la opción");
  assert.equal(suma("2025-06-13", 1), "2025-06-17", "Güemes 2025 pasó al lunes 16; el martes 17 es hábil");
  assert.equal(suma("2027-08-13", 1), "2027-08-17", "San Martín 2027 pasa al lunes 16");
  assert.equal(suma("2027-03-23", 1), "2027-03-25", "Memoria 2027 cae miércoles; el Jueves Santo es hábil por defecto");
  assert.equal(suma("2027-03-23", 1, CON_JUEVES), "2027-03-29", "con Jueves Santo: miércoles, jueves, viernes y finde");
});

test("sumar hábiles: lo que se salteó", () => {
  const r = F.sumarHabiles("2026-11-19", 3);
  assert.deepEqual(r.salteados.map((s) => s.fecha), ["2026-11-23"]);
  assert.equal(r.finesDeSemana, 2);
  assert.equal(r.corridos, 6);
  const p = F.sumarHabiles("2026-07-13", -1);
  assert.deepEqual(p.salteados.map((s) => s.fecha), ["2026-07-10", "2026-07-09"]);
  assert.equal(p.corridos, -5);
});

test("hábiles entre dos fechas: casos a mano", () => {
  assert.equal(entre("2025-12-31", "2026-12-31"), 243, "2026: 261 días de semana, 15 feriados y 3 puentes");
  assert.equal(entre("2025-12-31", "2026-12-31", SIN_PUENTES), 246);
  assert.equal(entre("2026-09-30", "2026-10-31"), 21, "octubre 2026: 22 días de semana menos el 12");
  assert.equal(entre("2026-10-31", "2026-09-30"), -21);
  assert.equal(entre("2026-07-08", "2026-07-12"), 0);
  assert.equal(entre("2026-10-15", "2026-10-15"), 0);
  const r = F.habilesEntre("2026-11-15", "2026-11-30");
  assert.equal(r.habiles, 10);
  assert.equal(r.corridos, 15);
  assert.deepEqual(r.noHabiles.map((x) => x.fecha), ["2026-11-23"]);
  assert.equal(r.finesDeSemana, 4);
  for (const [a, n] of [["2026-10-15", 10], ["2026-11-19", 3], ["2026-03-20", 1], ["2026-12-30", 2], ["2024-06-14", 3]]) {
    assert.equal(entre(a, suma(a, n)), n, `ida y vuelta desde ${a}`);
  }
  for (const [a, n] of [["2026-07-13", -1], ["2026-04-06", -3]]) assert.equal(entre(a, suma(a, n)), n, `ida y vuelta para atrás desde ${a}`);
});

test("qué es un día", () => {
  const v = F.infoDia("2026-11-20");
  assert.equal(v.habil, true);
  assert.equal(v.resumen, "Es día hábil.");
  assert.equal(v.movido.fecha, "2026-11-23");
  assert.equal(v.siguienteHabil, "2026-11-24", "el lunes 23 es feriado");
  assert.equal(F.infoDia("2026-11-23").resumen, "Es feriado: Día de la Soberanía Nacional.");
  assert.equal(F.infoDia("2026-03-23").resumen, "Es día no laborable con fines turísticos: acá cuenta como no hábil.");
  assert.equal(F.infoDia("2026-03-23", SIN_PUENTES).resumen, "Es día no laborable con fines turísticos: acá cuenta como hábil.");
  assert.equal(F.infoDia("2025-04-17").resumen, "Es día no laborable (Jueves Santo): acá cuenta como hábil.");
  assert.equal(F.infoDia("2026-04-02").motivos.length, 2);
  assert.equal(F.infoDia("2026-06-20").resumen, "Es feriado (Paso a la Inmortalidad del General Manuel Belgrano (Día de la Bandera)) y además sábado.");
  assert.equal(F.infoDia("2026-10-25").resumen, "Es domingo.");
  assert.equal(F.infoDia("2026-10-25").siguienteHabil, "2026-10-26");
  assert.equal(F.infoDia("2027-12-31").siguienteHabil, null, "después de 2027 no se sabe");
  assert.equal(F.esHabil("2026-11-20"), true);
  assert.equal(F.esHabil("2026-11-23"), false);
  assert.equal(F.esHabil("2026-10-24"), false);
  assert.equal(F.proximoFeriado("2026-10-25").fecha, "2026-11-23");
  assert.equal(F.proximoFeriado("2026-12-26").fecha, "2027-01-01");
});

test("errores: fuera de rango y cantidades raras", () => {
  assert.throws(() => F.esHabil("2028-01-03"), /No hay feriados cargados para 2028/);
  assert.throws(() => F.esHabil("2023-12-29"), /2023/);
  assert.throws(() => F.sumarHabiles("2027-12-30", 3), /se pasa de 31\/12\/2027/);
  assert.throws(() => F.sumarHabiles("2024-01-03", -3), /se pasa de 1\/1\/2024/);
  assert.throws(() => F.sumarHabiles("2026-01-05", 2.5), /entero/);
  assert.throws(() => F.habilesEntre("2026-01-01", "2028-01-01"), /2028/);
});

test("JSON y C# salen de la misma lista, y los archivos del repo están al día", () => {
  const j = JSON.parse(F.json());
  assert.equal(j.feriados.length, 77);
  assert.equal(j.completoHasta, 2026);
  assert.equal(j.consultado, "2026-10-25");
  assert.equal(j.pendiente.length, 2);
  assert.deepEqual(j.feriados.find((f) => f.fecha === "2026-11-23"), {
    fecha: "2026-11-23", nombre: "Día de la Soberanía Nacional", tipo: "trasladable", feriado: true, original: "2026-11-20",
    fuente: "Ley 27.399, art. 6", nota: "Caía viernes 20/11 y pasa al lunes siguiente.",
  });
  const cs = F.csharp();
  assert.match(cs, /public sealed class CalendarioArgentino/);
  assert.match(cs, /public DateOnly SumarHabiles\(DateOnly desde, int dias\)/);
  assert.match(cs, /public int HabilesEntre\(DateOnly desde, DateOnly hasta\)/);
  assert.match(cs, /public bool EsHabil\(DateOnly fecha\)/);
  assert.match(cs, /F\(2026, 11, 23, "Día de la Soberanía Nacional", TipoFeriado\.Trasladable, "Ley 27\.399, art\. 6", original: new DateOnly\(2026, 11, 20\)\),/);
  assert.match(cs, /F\(2027, 11, 20, .* \/\/ a confirmar: cae sábado/);
  assert.equal((cs.match(/^ {8}F\(/gm) || []).length, 77);
  const raiz = path.join(__dirname, "..");
  assert.equal(fs.readFileSync(path.join(raiz, "csharp", "CalendarioArgentino.cs"), "utf8"), cs, "correr node herramientas/feriados-y-habiles/generar.js");
  assert.equal(fs.readFileSync(path.join(raiz, "feriados.json"), "utf8"), F.json(), "correr node herramientas/feriados-y-habiles/generar.js");
});
