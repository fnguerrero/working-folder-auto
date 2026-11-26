/* El escrito tiene que decir lo que dicen las corridas crudas.
   Correr desde la raíz del repo: node --test escritos/async-con-cronometro/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { juntar, armar } = require("../tablas.js");

const leer = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const html = leer("index.html").replace(/\r/g, "");
const R = juntar();
const m = (cap, id, rt) => { const f = R.mediciones[cap].find((x) => x.id === id); assert.ok(f, `${cap}/${id}`); return f.runtimes[rt]; };
const entre = (x, lo, hi, que) => assert.ok(x >= lo && x <= hi, `${que}: ${x} no está entre ${lo} y ${hi}`);
const hambre = (rt, modo, ritmo) => R.hambre[rt][modo].find((e) => e.ritmo === ritmo);

test("resultados.json sale de las corridas crudas", () => assert.deepEqual(JSON.parse(leer("resultados.json")), R));
test("tablas, código y datos del gráfico están al día", () => assert.equal(armar(html, R), html));
test("no se publica el nombre de la máquina ni rutas de usuario", () => {
  for (const f of fs.readdirSync(path.join(__dirname, "..", "resultados-crudos")))
    assert.doesNotMatch(leer(`resultados-crudos/${f}`), /Users|DESKTOP-|machine/i, f);
});

for (const rt of ["net8", "net10"]) {
  test(`${rt}: capítulos 1 a 3`, () => {
    entre(m("await", "completado", rt).medianaNs, 8, 22, "await completado");
    assert.equal(m("await", "completado", rt).bytes, 72);
    entre(m("await", "yield", rt).medianaNs, 300, 500, "yield");
    entre(m("await", "delay", rt).medianaNs / 1e6, 13, 18, "delay ms");
    assert.ok(m("valuetask", "valuetask100", rt).medianaNs < m("valuetask", "task100", rt).medianaNs);
    assert.ok(m("valuetask", "guardada100", rt).medianaNs < 2.5);
    assert.ok(m("valuetask", "valuetask0", rt).bytes > m("valuetask", "task0", rt).bytes);
    for (const c of ["100", "90", "0"]) assert.equal(m("valuetask", `pool${c}`, rt).bytes, 0);
    entre(m("configureawait", "sin_true", rt).medianaNs / m("configureawait", "sin_false", rt).medianaNs, 0.9, 1.1, "sin contexto");
    entre(m("configureawait", "ui_true", rt).medianaNs / m("configureawait", "ui_false", rt).medianaNs, 1.6, 2.4, "con contexto");
    assert.deepEqual(R.hechos[rt].postsPorLlamada, { conTrue: 10, conFalse: 1 });
    assert.deepEqual(R.hechos[rt].deadlock, { configureAwaitTrueTermina: false, configureAwaitFalseTermina: true });
  });
  test(`${rt}: thread pool`, () => {
    for (const r of [100, 200, 400, 800]) { const e = hambre(rt, "async", r); entre(e.latenciaP50Ms, 100, 120, "await p50"); assert.ok(e.hilosAlCorte < 20); }
    entre(hambre(rt, "result", 200).latenciaP99Ms, 100, 130, ".Result 200");
    const e = hambre(rt, "result", 400);
    entre(e.porSegundo, 120, 170, ".Result 400"); assert.ok(e.latenciaP99Ms > 40000); assert.ok(e.sondaMaxMs > 30000); assert.equal(e.hilosAlCorte, 132);
    const f = hambre(rt, "result", 800);
    assert.ok(f.enviados - f.terminadosAlFinal > 1000); assert.ok(f.drenajeSegundos >= 45);
    assert.ok(hambre(rt, "sleep", 200).porSegundo < hambre(rt, "result", 200).porSegundo);
    entre(hambre(rt, "sleep", 200).hilosAlCorte, 15, 25, "hilos con Sleep");
    for (const r of [100, 200, 400, 800]) assert.ok(hambre(rt, "result200", r).latenciaP99Ms < 130);
  });
  test(`${rt}: capítulos 5 a 8`, () => {
    const [v, t] = R.excepciones[rt];
    assert.ok(!v.atrapadaPorElCatch && !v.sigueVivo && v.errorSinAtrapar);
    assert.ok(!t.atrapadaPorElCatch && t.sigueVivo);
    entre(m("taskrun", "run_chico", rt).medianaNs / m("taskrun", "directo_chico", rt).medianaNs, 35, 55, "Task.Run chico");
    entre(m("taskrun", "run_grande", rt).medianaNs / m("taskrun", "directo_grande", rt).medianaNs, 1.03, 1.12, "Task.Run grande");
    entre(m("streaming", "stream_memoria", rt).bytes / m("streaming", "lista_memoria", rt).bytes, 0.4, 0.55, "bytes stream");
    assert.ok(m("streaming", "stream_memoria", rt).medianaNs < m("streaming", "lista_memoria", rt).medianaNs);
    const [l, s] = R.hechos[rt].streaming;
    assert.ok(l.primerElementoMs / s.primerElementoMs > 100); entre(l.bytesVivos / 1048576, 3, 3.6, "lista viva"); assert.ok(s.bytesVivos < 500);
    assert.equal(m("valuetaskmal", "astask", rt).bytes, 72);
    assert.equal(m("valuetaskmal", "boxing", rt).bytes, 32);
    assert.equal(m("valuetaskmal", "dosawait", rt).bytes, 0);
    assert.equal(m("valuetaskmal", "asyncvt", rt).bytes, 0);
  });
}
