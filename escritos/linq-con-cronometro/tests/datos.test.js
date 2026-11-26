/* El escrito tiene que decir lo que dicen las corridas crudas.
   Correr desde la raíz del repo: node --test escritos/linq-con-cronometro/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { juntar, armar } = require("../tablas.js");

const leer = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = leer("index.html").replace(/\r/g, "");
const R = juntar();
const m = (cap, id, rt) => { const f = R.mediciones[cap].find((x) => x.id === id); assert.ok(f && f.runtimes[rt], `${cap}/${id}/${rt}`); return f.runtimes[rt]; };
const veces = (cap, a, b, rt) => m(cap, a, rt).medianaNs / m(cap, b, rt).medianaNs;
const entre = (x, lo, hi, que) => assert.ok(x >= lo && x <= hi, `${que}: ${x} no está entre ${lo} y ${hi}`);

test("resultados.json sale de las corridas crudas", () => assert.deepEqual(JSON.parse(leer("resultados.json")), R));
test("tablas y bloques de código están al día", () => assert.equal(armar(html, R), html));
test("no se publica el nombre de la máquina ni rutas de usuario", () => {
  for (const f of fs.readdirSync(path.join(__dirname, "..", "resultados-crudos")))
    assert.doesNotMatch(leer(`resultados-crudos/${f}`), /Users|DESKTOP-|machine/i, f);
});

for (const rt of ["net8", "net9", "net10"]) {
  test(`${rt}: lo que afirma el texto`, () => {
    for (const [a, b] of [["a100_linq", "a100_for"], ["a10k_linq", "a10k_for"], ["l100_linq", "l100_for"], ["l10k_linq", "l10k_for"]])
      entre(veces("wheresum", a, b, rt), 1.5, 8.5, a);
    assert.equal(m("wheresum", "a10k_linq", rt).bytes, 104);
    assert.equal(m("wheresum", "l10k_linq", rt).bytes, 152);
    assert.ok(veces("any", "count_perezosa", "any_perezosa", rt) > 200);
    for (const id of ["cadena_con", "foreach_con", "contar_con"]) entre(m("tolist", id, rt).bytes / 1000, 19, 155, id);
    for (const id of ["cadena_sin", "foreach_sin", "contar_sin"]) assert.ok(m("tolist", id, rt).bytes < 200);
    assert.ok(veces("tolist", "foreach_con", "foreach_sin", rt) > 2);
    assert.ok(veces("minby", "min_minby", "min_for", rt) > 1.5);
    assert.ok(veces("minby", "top_tolist", "top_take", rt) > 10);
    assert.ok(veces("multiple", "multi_tres", "multi_tolist", rt) > 3);
    assert.equal(R.hechos[rt].proyeccionesTresRecorridas, 30000);
    assert.equal(R.hechos[rt].proyeccionesConToList, 10000);
    entre(veces("contains", "con_lista", "con_hash", rt), 2.3, 4.2, "HashSet");
    assert.ok(m("detalles", "lambda_captura", rt).bytes > m("detalles", "lambda_static", rt).bytes);
    assert.ok(veces("detalles", "det_count", "where_count", rt) > 1.2);
  });
}
test("diferencias entre versiones", () => {
  assert.ok(veces("first", "a_first", "a_for", "net8") > 8);
  assert.ok(m("first", "l_find", "net8").medianaNs < m("first", "l_first", "net8").medianaNs);
  for (const rt of ["net9", "net10"]) {
    assert.ok(m("first", "l_first", rt).medianaNs < m("first", "l_find", rt).medianaNs);
    assert.ok(veces("first", "a_first", "a_find", rt) > 3);
    assert.ok(m("iteradores", "it_reverse", rt).medianaNs < 20);
    assert.ok(m("iteradores", "it_distinct", "net8").medianaNs / m("iteradores", "it_distinct", rt).medianaNs > 3);
    assert.ok(m("iteradores", "it_toarray", rt).bytes < m("iteradores", "it_toarray", "net8").bytes / 2);
    entre(veces("contains", "cruce_first", "cruce_dic", rt), 2.5, 4.5, "diccionario");
    entre(veces("detalles", "grupos_countby", "grupos_groupby", rt), 0.5, 0.72, "CountBy");
    assert.ok(m("wheresum", "l10k_linq", rt).medianaNs > m("wheresum", "l10k_linq", "net8").medianaNs);
  }
  assert.ok(veces("contains", "cruce_first", "cruce_dic", "net8") > 10);
  assert.ok(veces("tolist", "cadena_con", "cadena_sin", "net8") < 0.8);
  assert.ok(veces("tolist", "cadena_con", "cadena_sin", "net9") < 0.9);
  for (const rt of ["net8", "net9"]) entre(veces("minby", "min_orderby", "min_minby", rt), 1.2, 1.8, "OrderBy contra MinBy");
  entre(veces("minby", "min_orderby", "min_minby", "net10"), 0.85, 1.2, "OrderBy contra MinBy net10");
  assert.ok(m("iteradores", "it_ordercontains", "net9").medianaNs > 100000);
  assert.ok(m("iteradores", "it_ordercontains", "net10").medianaNs < 100);
});
