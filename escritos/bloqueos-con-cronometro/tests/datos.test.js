/* Verifica que las cifras del escrito coincidan con resultados.json (lo que midió el servidor) y que el
   escrito tenga lo que promete (diez capítulos, grafo, chuleta).
   Correr desde la raíz del repo: node --test escritos/bloqueos-con-cronometro/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resultados.json"), "utf8")).experimentos;
const ar = (n) => Math.round(n).toLocaleString("es-AR");
const contiene = (n, que) => assert.ok(new RegExp(`(^|[^\\d.,])${ar(n).replace(/\./g, "\\.")}([^\\d.,]|$)`).test(html), `falta «${ar(n)}» (${que})`);
const bloqueos = (lista, tipo, modo) => (lista.find((b) => b.tipo === tipo && b.modo === modo) || { n: 0 }).n;

test("hay diez capítulos, intro, conclusión y chuleta", () => {
  const caps = [...html.matchAll(/<small>Capítulo (\d+)<\/small>/g)].map((m) => Number(m[1]));
  assert.deepEqual(caps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const id of ["intro", "bloqueo", "escalada", "nolock", "perdida", "serializable", "deadlock", "sinindice", "timeout", "versiones", "caliente", "conclusion", "chuleta"]) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok((html.match(/class="llevo"/g) || []).length === 10, "un «Qué me llevo» por capítulo");
});

test("capítulo 1: los tres bloqueos del update y los cuatro lectores", () => {
  const b = R.bloqueo;
  assert.equal(bloqueos(b.bloqueosDelUpdate, "KEY", "X"), 1); assert.equal(bloqueos(b.bloqueosDelUpdate, "PAGE", "IX"), 1); assert.equal(bloqueos(b.bloqueosDelUpdate, "OBJECT", "IX"), 1);
  assert.ok(b.lectorMismaFila.ms >= 1500 && b.lectorOtraFila.ms < 100 && b.countEstrella.ms < 200 && b.sumTotal.ms >= 1000);
  assert.equal(b.lectorMismaFila.mientrasEsperaba.wait_type, "LCK_M_S"); assert.ok(b.sumTotal.mientrasEsperaba.wait_resource.startsWith("PAGE"));
  contiene(b.lectorMismaFila.ms, "lector misma fila"); contiene(b.sumTotal.ms, "SUM(Total)"); contiene(b.countEstrella.ms, "COUNT(*)");
  assert.ok(html.includes(b.sumTotal.mientrasEsperaba.wait_resource.trim()), "la página que esperó el scan");
});

test("capítulo 2: escalada a los 5.000", () => {
  const e = R.escalada;
  assert.equal(bloqueos(e.filas4000.bloqueos, "KEY", "X"), 4000); assert.equal(bloqueos(e.filas7000.bloqueos, "OBJECT", "X"), 1); assert.equal(bloqueos(e.filas7000.bloqueos, "KEY", "X"), 0);
  assert.ok(e.filas7000.lectorFilaLejana.ms > 300 && e.filas4000.lectorFilaLejana.ms < 100 && e.filas7000SinEscalada.lectorFilaLejana.ms < 100);
  assert.equal(e.filas7000.lectorFilaLejana.mientrasEsperaba.wait_type, "LCK_M_IS");
  contiene(bloqueos(e.filas4000.bloqueos, "PAGE", "IX"), "páginas IX con 4000"); contiene(e.filas7000SinEscalada.totalBloqueos, "total sin escalada"); contiene(e.filas7000.lectorFilaLejana.ms, "lector lejano"); contiene(e.porTandas.ms, "tandas");
});

test("capítulo 3: lectura sucia y conteos distintos", () => {
  const n = R.nolock;
  assert.equal(n.leidoConNolock, 0); assert.equal(n.stockDespuesDelRollback, 100); assert.equal(n.lecturaNormal.error.numero, 1222);
  assert.ok(n.conteo.distintas > n.conteo.corridas / 2, "la mayoría de los conteos con NOLOCK salió mal");
  assert.equal(n.conteo.alFinalConLock.filas, n.conteo.real.filas); assert.equal(n.conteo.alFinalConLock.total, n.conteo.real.total);
  contiene(n.lecturaNormal.ms, "lectura normal"); contiene(n.conteo.distintas, "distintas"); contiene(n.conteo.real.total, "total real");
  for (const ej of n.conteo.ejemplos) { contiene(ej.filas, "ejemplo filas"); contiene(ej.total, "ejemplo total"); }
});

test("capítulo 4: la actualización perdida y sus remedios", () => {
  const p = R.perdida; assert.equal(p.concurrentes, 40);
  assert.ok(p.readCommitted.perdidas > 30 && p.rcsi.perdidas > 30, "se pierden con RC y con RCSI");
  for (const k of ["repeatableRead", "updlock", "atomico", "rowversion", "snapshot"]) assert.equal(p[k].stockFinal, 60, k);
  assert.ok(p.repeatableRead.errores["1205"] > 100 && p.snapshot.errores["3960"] > 0 && p.rowversion.reintentos > 0);
  assert.ok(p.atomico.ms < p.updlock.ms && p.atomico.ms < p.rowversion.ms, "lo atómico es lo más rápido");
  for (const k of ["readCommitted", "rcsi", "repeatableRead", "updlock", "atomico", "rowversion", "snapshot"]) contiene(p[k].ms, `tiempo ${k}`);
  contiene(p.repeatableRead.errores["1205"], "deadlocks RR"); contiene(p.rowversion.reintentos, "reintentos rowversion"); contiene(p.snapshot.errores["3960"], "conflictos snapshot");
  assert.ok(html.includes(`>${p.readCommitted.stockFinal}<`) && html.includes(`>${p.readCommitted.perdidas}<`));
});

test("capítulo 5: SERIALIZABLE, deadlocks y el índice único", () => {
  const s = R.serializable;
  assert.equal(s.readCommitted.filas, 20); assert.equal(s.serializable.filas, 10); assert.equal(s.serializable.deadlocks, 10);
  assert.equal(s.serializableUpdlock.deadlocks, 0); assert.equal(s.readCommittedUpdlockHoldlock.filas, 10); assert.equal(s.unicoYCatch.filas, 10); assert.equal(s.unicoYCatch.errores["2601"], 10);
  for (const k of Object.keys(s)) contiene(s[k].ms, `tiempo ${k}`);
  contiene(s.serializable.msHastaElDeadlock.min, "min hasta deadlock"); contiene(s.serializable.msHastaElDeadlock.max, "max hasta deadlock");
});

test("capítulo 6: el deadlock clásico, la prioridad, el orden y el grafo", () => {
  const d = R.deadlock;
  assert.ok(d.cruzado.victima && (d.cruzado.s1.error || d.cruzado.s2.error).numero === 1205);
  assert.equal(d.cruzadoPrioridad.victima, "s2", "muere la de prioridad LOW"); assert.equal(d.mismoOrden.victima, null);
  for (const r of ["cruzado", "cruzadoPrioridad", "mismoOrden"]) { contiene(d[r].s1.ms, `${r} s1`); contiene(d[r].s2.ms, `${r} s2`); }
  assert.ok(d.saldosAlFinal.every((c) => Number(c.Saldo) === 1000));
  assert.ok(d.cruzado.grafo.includes("<victim-list>") && d.cruzado.grafo.includes("<inputbuf>") && d.cruzado.grafo.includes("PK_Cuentas"));
  const victima = d.cruzado.grafo.match(/victimProcess id="([^"]+)"/)[1]; assert.ok(html.includes(`victimProcess id="${victima}"`), "el grafo del escrito es el medido");
  const spids = [...d.cruzado.grafo.matchAll(/ spid="(\d+)"/g)].map((m) => m[1]); for (const s of spids) assert.ok(html.includes(`spid="${s}"`));
});

test("capítulo 7: sin índice hay deadlock, con índice no", () => {
  const s = R.sinIndice;
  assert.ok(s.sinIndice.cruzado.deadlock && !s.conIndice.cruzado.deadlock);
  assert.ok(s.sinIndice.plan.ops.includes("Clustered Index Scan") && s.conIndice.plan.ops.includes("Index Seek"));
  assert.equal(s.sinIndice.otraFilaPorCodigo.error.numero, 1222); assert.equal(s.conIndice.otraFilaPorCodigo.error, null);
  contiene(s.sinIndice.plan.lecturas, "lecturas scan"); contiene(s.conIndice.plan.lecturas, "lecturas seek"); contiene(s.sinIndice.otraFilaPorCodigo.ms, "bloqueo sin índice");
  contiene((s.sinIndice.cruzado.s1.error ? s.sinIndice.cruzado.s1 : s.sinIndice.cruzado.s2).ms, "víctima sin índice");
});

test("capítulo 8: lock timeout, command timeout y la cadena", () => {
  const t = R.timeout;
  assert.equal(t.lockTimeout.error.numero, 1222); assert.ok(t.lockTimeout.ms >= 2000 && t.lockTimeout.ms < 2500);
  assert.equal(t.commandTimeout.error.numero, "ETIMEOUT"); assert.ok(t.commandTimeout.ms >= 3000 && t.commandTimeout.ms < 3500); assert.ok(t.commandTimeout.pedidoEnElServidorDespues == null, "el pedido ya no estaba en el servidor");
  assert.equal(t.cadena.length, 2); assert.equal(t.cadena[1].bloqueadaPor, t.cadena[0].spid); assert.equal(t.cadena[0].bloqueadaPor, t.cabezaDeLaCadena.spid);
  assert.equal(t.cabezaDeLaCadena.status, "sleeping"); assert.equal(t.cabezaDeLaCadena.transacciones, 1);
  contiene(t.lockTimeout.ms, "lock timeout"); contiene(t.commandTimeout.ms, "command timeout");
  for (const c of t.cadena) { contiene(c.wait_time, "espera de la cadena"); assert.ok(html.includes(`>${c.spid}<`) && html.includes(`>${c.bloqueadaPor}<`)); }
  assert.ok(html.includes(`>${t.cabezaDeLaCadena.spid}<`) && html.includes(`${t.cabezaDeLaCadena.segundosOciosa} s<`));
});

test("capítulo 9: RCSI, el costo por fila, el version store y SNAPSHOT", () => {
  const v = R.versiones;
  assert.ok(v.rcsi.lectorMismaFila.ms < 100 && v.rcsi.sumTotal.ms < 500); assert.equal(v.rcsi.lectorMismaFila.vioEstado, 0); assert.equal(v.rcsi.lectorDespuesDelCommit, 9); assert.equal(v.rcsi.escritorMismaFila.error.numero, 1222);
  assert.ok(Math.abs(v.filaConVersion.bytesDespues - v.filaConVersion.bytesAntes - 14) < 0.01, "14 bytes por fila");
  assert.equal(v.snapshot.segundaLecturaEnSnapshot, 100); assert.equal(v.snapshot.segundaLecturaEnRcsi, 90); assert.equal(v.snapshot.update.error.numero, 3960);
  contiene(v.rcsi.lectorMismaFila.ms, "lector RCSI"); contiene(v.rcsi.sumTotal.ms, "suma RCSI"); contiene(v.rcsi.escritorMismaFila.ms, "escritor RCSI"); contiene(Number(v.versionStore200k.kb), "version store"); contiene(v.snapshot.update.ms, "3960");
  assert.ok(html.includes(`${v.filaConVersion.bytesAntes.toFixed(1).replace(".", ",")} → ${v.filaConVersion.bytesDespues.toFixed(1).replace(".", ",")} bytes`));
});

test("capítulo 10: la fila caliente", () => {
  const f = R.filaCaliente;
  assert.ok(f.espera0.porSegundo > f.espera20.porSegundo && f.espera20.porSegundo > f.espera200.porSegundo);
  assert.ok(f.espera200FilasDistintas.porSegundo > 5 * f.espera200.porSegundo, "repartir la fila multiplica el rendimiento");
  for (const k of ["espera0", "espera20", "espera200"]) { contiene(f[k].commits, `commits ${k}`); contiene(f[k].porSegundo, `por segundo ${k}`); contiene(f[k].esperaMsMediana, `mediana ${k}`); contiene(f[k].esperaMsP99, `p99 ${k}`); }
  contiene(f.espera200FilasDistintas.commits, "commits filas distintas"); contiene(f.espera200FilasDistintas.porSegundo, "por segundo filas distintas");
});

test("la chuleta cubre los diez capítulos y el SQL del grafo está", () => {
  const chuleta = html.slice(html.indexOf('id="chuleta"'));
  for (const id of ["bloqueo", "escalada", "nolock", "perdida", "serializable", "deadlock", "sinindice", "timeout", "versiones", "caliente"]) assert.ok(chuleta.includes(`href="#${id}"`), `la chuleta linkea a ${id}`);
  assert.ok(html.includes("xml_deadlock_report") && fs.readFileSync(path.join(__dirname, "..", "experimentos.sql"), "utf8").includes("xml_deadlock_report"));
  assert.ok(html.includes("TransactionScopeAsyncFlowOption.Enabled") && html.includes("ExecuteUpdateAsync") && html.includes("EnableRetryOnFailure"));
});
