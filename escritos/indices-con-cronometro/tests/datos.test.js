/* Verifica que las cifras del escrito coincidan con resultados.json (lo que midió el servidor) y que
   el SQL de los experimentos esté en experimentos.sql.
   Correr desde la raíz del repo: node --test escritos/indices-con-cronometro/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const sqlTodo = fs.readFileSync(path.join(__dirname, "..", "experimentos.sql"), "utf8");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resultados.json"), "utf8")).experimentos;
const ar = (n) => Math.round(n).toLocaleString("es-AR");
const contiene = (n, que) => assert.ok(html.includes(ar(n)), `falta «${ar(n)}» (${que})`);
const paginas = (ex, k, indice) => Number((R[ex][k].find((f) => f.indice === indice) || {}).paginas);

test("capítulo 1: páginas, niveles y lecturas del scan", () => {
  const niveles = R.paginas.fisico;
  assert.equal(niveles.length, 3);
  contiene(Number(niveles[0].page_count), "hojas"); contiene(Number(niveles[1].page_count), "intermedio");
  assert.ok(html.includes(`${Math.round(niveles[0].avg_record_size_in_bytes)}`), "bytes por registro");
  for (const c of R.paginas.scan1) contiene(c.lecturas, "scan");
  contiene(R.paginas.count.lecturas, "count");
  contiene(paginas("paginas", "tamanos", "IX_Pedidos_ClienteId"), "páginas del índice ClienteId");
});

test("capítulo 2: heap", () => {
  contiene(R.heap.heapPk.lecturas, "heap por PK"); contiene(R.heap.clusterPk.lecturas, "clustered por PK");
  contiene(R.heap.heapRid.lecturas, "RID lookup"); contiene(R.heap.clusterKey.lecturas, "key lookup");
  contiene(paginas("heap", "tamanos", "IX_PedidosHeap_ClienteId"), "índice sobre heap");
  assert.ok(R.heap.heapRid.ops.some((o) => /RID Lookup/.test(o)));
});

test("capítulo 3: clave ancha", () => {
  contiene(paginas("claveAncha", "tamanosCodigo", "PK_PedidosCodigo"), "agrupado nvarchar");
  contiene(paginas("claveAncha", "tamanosCodigo", "IX_PedidosCodigo_ClienteId"), "índice con clave ancha");
  contiene(R.claveAncha.lookupCodigo.lecturas, "lookup código"); contiene(R.claveAncha.lookupInt.lecturas, "lookup int");
});

test("capítulo 4: selectividad", () => {
  for (const d of R.selectividad.dist) contiene(Number(d.Filas), `estado ${d.Estado}`);
  for (const k of ["e3", "e3seek", "e1", "e1seek", "c4242", "c4242scan"]) contiene(R.selectividad[k].lecturas, k);
  assert.ok(R.selectividad.e3.ops[0].startsWith("Clustered Index Scan"), "el optimizador eligió scan con 1 %");
  assert.ok(R.selectividad.e1seek.lecturas > 50 * R.selectividad.e1.lecturas, "forzar el índice con 48 % es 50× peor");
});

test("capítulo 5: cubriente", () => {
  for (const k of ["lookup1", "lookup1libre", "cub1", "cub", "cubStar"]) contiene(R.cubriente[k].lecturas, k);
  contiene(paginas("cubriente", "tamanos", "IX_Pedidos_ClienteId_Cub"), "páginas del cubriente");
  assert.ok(R.cubriente.cubStar.ops.some((o) => /Key Lookup/.test(o)), "SELECT * vuelve al lookup");
  assert.equal(R.cubriente.cub1.ops.length, 1);
});

test("capítulo 6: orden de columnas", () => {
  for (const k of ["ef", "fe", "soloFechaEf", "soloFechaFe", "soloEstadoFe", "soloEstadoEf"]) contiene(R.orden[k].lecturas, k);
  assert.ok(/Index Scan/.test(R.orden.soloFechaEf.ops[0]) && /Index Seek/.test(R.orden.soloFechaFe.ops.join()));
});

test("capítulo 7: sargabilidad", () => {
  for (const k of ["yearMonth", "rango", "castDate", "rangoDia", "emailN", "emailV", "likePrefijo", "likeContiene", "totalExpr", "totalCol"]) contiene(R.sargable[k].lecturas, k);
  assert.ok(R.sargable.emailN.avisos.includes("PlanAffectingConvert"));
  assert.equal(Math.round(R.sargable.castDate.filasEst), 1);
  contiene(R.sargable.castDate.filas, "filas reales del CAST");
});

test("capítulo 8: paginación", () => {
  for (const k of ["top50Sin", "top50Con", "offset0", "offset100k", "offset350k", "keyset"]) { contiene(R.ordenTop[k].lecturas, k); if (R.ordenTop[k].ms > 5) contiene(R.ordenTop[k].ms, k + " ms"); }
  contiene(paginas("ordenTop", "tamanos", "IX_Pedidos_Fecha"), "páginas índice Fecha");
});

test("capítulo 9: filtrados", () => {
  contiene(paginas("filtrado", "tamanos", "IX_Pedidos_Pendientes"), "páginas del filtrado");
  contiene(R.filtrado.literal.lecturas, "literal"); contiene(R.filtrado.parametro.lecturas, "parámetro");
  assert.ok(R.filtrado.parametro.avisos.includes("UnmatchedIndexes"));
});

test("capítulo 10: estadísticas", () => {
  const h = R.estadisticas.histograma;
  assert.equal(h[0].RANGE_HI_KEY, 1); assert.equal(h[0].EQ_ROWS, 100000);
  contiene(h[1].RANGE_ROWS, "range rows"); contiene(h[2].RANGE_ROWS, "range rows 2");
  for (const k of ["c1", "variable1", "variable1Recompile"]) { contiene(R.estadisticas[k].lecturas, k); contiene(R.estadisticas[k].ms, k + " ms"); }
  contiene(Math.round(R.estadisticas.variable1.filasEst), "estimación con variable");
});

test("capítulo 11: escribir", () => {
  for (const k of ["sinIndices", "conIndices", "updateEstado", "updateObs"]) { contiene(R.escribir[k][0].lecturas, k); contiene(R.escribir[k][0].ms, k + " ms"); }
  const total = R.escribir.tamanos.filter((f) => f.indice !== "PK_PedidosCopia").reduce((a, f) => a + Number(f.paginas), 0);
  contiene(total, "páginas de los 5 índices"); contiene(paginas("escribir", "tamanos", "PK_PedidosCopia"), "páginas de la tabla");
  assert.equal(R.escribir.conIndices[0].ops.filter((o) => /^Index Insert/.test(o)).length, 5);
});

test("capítulo 12: columnstore", () => {
  contiene(R.columnar.agregadoFila.lecturas, "reads fila"); contiene(R.columnar.agregadoFila.ms, "ms fila"); contiene(R.columnar.agregadoColumnar.ms, "ms columnar");
  for (const f of R.columnar.tamanos) contiene(Number(f.paginas), f.indice);
  assert.ok(R.columnar.agregadoColumnar.ops.some((o) => /NCCI_Items/.test(o)));
});

test("capítulo 13: uso e índices faltantes", () => {
  for (const u of R.uso.usoPedidos) for (const k of ["seeks", "scans", "lookups"]) assert.ok(html.includes(`<td class="n">${u[k]}</td>`), `${u.indice} ${k}`);
  assert.equal(R.uso.faltantes.length, 1);
  assert.ok(html.includes(`impacto ${R.uso.faltantes[0].impacto} %`));
});

test("el SQL medido está en experimentos.sql y el HTML no tiene undefined/NaN", () => {
  for (const ex of Object.values(R)) for (const v of Object.values(ex)) {
    const sql = Array.isArray(v) ? v.sql : v && v.sql;
    if (sql) assert.ok(sqlTodo.includes(sql), `falta en experimentos.sql: ${sql.slice(0, 60)}`);
  }
  assert.ok(!/undefined|NaN/.test(html));
  assert.ok(!/Noche!|Password/.test(sqlTodo + html), "sin contraseñas");
});
