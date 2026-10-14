/* Tests de la lógica de Plan en criollo con node --test, sobre planes reales de SQL Server 2022
   (carpeta planes/) y algunos XML armados a mano para los casos que no se pudieron reproducir.
   Correr desde la raíz del repo: node --test herramientas/plan-en-criollo/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../logica.js");

const plan = (nombre) => fs.readFileSync(path.join(__dirname, "planes", nombre + ".sqlplan"), "utf8");
const analizar = (nombre) => L.analizar(plan(nombre));
const titulos = (s) => s.hallazgos.map((h) => h.titulo);
const con = (s, re) => s.hallazgos.find((h) => re.test(h.titulo));

test("parser XML: entidades, atributos, autocierre, prefijos, comentarios y CDATA", () => {
  const doc = L.parsearXml(`<?xml version="1.0"?><!-- c --><p:a xmlns:p="x" n='1' m="&lt;&amp;&#x41;&#66;"><b/><c>texto <![CDATA[<crudo>]]></c></p:a>`);
  const a = doc.hijos[0];
  assert.equal(a.nombre, "a");
  assert.equal(a.atributos.n, "1");
  assert.equal(a.atributos.m, "<&AB");
  assert.equal(a.hijos.length, 2);
  assert.equal(a.hijos[1].texto, "texto <crudo>");
});

test("parser XML: errores con mensaje útil", () => {
  assert.throws(() => L.parsearXml("<a><b></a>"), /Se cierra <a> pero estaba abierto <b>/);
  assert.throws(() => L.parsearXml("<ShowPlanXML><RelOp NodeId=\"0\""), /sin cerrar|Etiqueta/);
  assert.throws(() => L.analizar("<html><body>hola</body></html>"), /No parece un plan/);
  assert.throws(() => L.analizar("SELECT 1"), /No parece un plan|sin cerrar/);
});

test("lookup: árbol, Key Lookup, costos y parametrización simple", () => {
  const r = analizar("lookup");
  assert.equal(r.versionServidor, "SQL Server 2022");
  assert.equal(r.conPlan.length, 1);
  const s = r.conPlan[0];
  assert.equal(s.esReal, true);
  assert.equal(s.raiz.fisico, "Nested Loops");
  assert.equal(s.raiz.hijos.length, 2);
  const lookup = s.raiz.hijos[1];
  assert.equal(lookup.fisico, "Key Lookup");
  assert.equal(lookup.esLookup, true);
  assert.equal(lookup.real.ejecuciones, 5);
  assert.equal(lookup.real.filas, 5);
  assert.ok(lookup.porcentaje > 80 && lookup.porcentaje < 85, `porcentaje ${lookup.porcentaje}`);
  assert.equal(Math.round(s.nodos.reduce((a, n) => a + n.porcentaje, 0)), 100);
  assert.equal(s.raiz.hijos[0].predicadoSeek[0], "p.ClienteId = (4242)");
  assert.equal(s.filasReales, 5);
  assert.equal(s.lecturasLogicas, 19);
  const h = con(s, /Key Lookup/);
  assert.equal(h.gravedad, "info");
  assert.match(h.codigo, /CREATE NONCLUSTERED INDEX \[IX_Pedidos_ClienteId\]\n  ON \[dbo\]\.\[Pedidos\] \(\[ClienteId\]\)\n  INCLUDE \(\[Fecha\], \[Estado\], \[Total\]\)\n  WITH \(DROP_EXISTING = ON\);/);
  assert.ok(con(s, /parametrizó sola/));
  assert.match(s.resumen.frase, /devolvió 5 filas \(estimaba 6\), serial/);
  assert.match(L.arbolTexto(s), /\[ 83 %\] Key Lookup · dbo\.Pedidos \(PK_Pedidos\) como p · 6 est → 5 reales · 5 ejec\. · 15 lect\./);
});

test("sniffing: lookups masivos, desvío de estimación, parámetros distintos y spill", () => {
  const s = analizar("sniffing").conPlan[0];
  const t = titulos(s);
  assert.match(t[0], /Key Lookup sobre dbo\.Pedidos: 100\.000 veces/);
  assert.ok(con(s, /erró las filas por 16\.873×/));
  const sniff = con(s, /se compiló con @ClienteId = \(4242\) y corrió con \(1\)/);
  assert.equal(sniff.gravedad, "alta");
  assert.match(sniff.hacer, /OPTION \(RECOMPILE\)/);
  const spill = con(s, /derramó a tempdb \(nivel 1\)/);
  assert.equal(spill.gravedad, "alta");
  assert.equal(s.plan.parametros[0].compilado, "(4242)");
  assert.equal(s.plan.parametros[0].ejecucion, "(1)");
  assert.equal(s.plan.esperas[0].tipo, "IO_COMPLETION");
  assert.equal(s.hallazgos.filter((h) => h.gravedad === "alta").length, 4);
  assert.match(s.resumen.veredicto, /4 problemas serios/);
});

test("conversion: PlanAffectingConvert de tipo Seek Plan, sin duplicar el hallazgo del scan", () => {
  const s = analizar("conversion").conPlan[0];
  const h = con(s, /Conversión implícita de «Email» a nvarchar\(200\): no puede usar el índice/);
  assert.equal(h.gravedad, "alta");
  assert.match(h.hacer, /IsAnsi = true/);
  assert.ok(!con(s, /Recorre .* filas de dbo\.Clientes/), "el scan ya lo explica la conversión");
  assert.equal(h.nodos.length, 1);
  assert.equal(s.nodos.find((n) => n.id === h.nodos[0]).fisico, "Index Scan");
});

test("scan: índice faltante con script y recorrido con filtro (plan paralelo: filas sin multiplicar por hilos)", () => {
  const s = analizar("scan").conPlan[0];
  const f = con(s, /Falta un índice sobre dbo\.Pedidos \(Estado, Fecha\)/);
  assert.equal(f.gravedad, "alta");
  assert.equal(f.codigo, "CREATE NONCLUSTERED INDEX [IX_Pedidos_Estado_Fecha]\n  ON [dbo].[Pedidos] ([Estado], [Fecha])\n  INCLUDE ([ClienteId], [Total]);");
  const r = con(s, /Recorre 400\.000 filas de dbo\.Pedidos para quedarse con 605/);
  assert.equal(r.gravedad, "media");
  assert.match(r.que, /\(4 hilos\)/);
  assert.equal(s.plan.dop, 4);
  assert.equal(s.plan.indicesFaltantes[0].impacto > 90, true);
  assert.match(L.arbolTexto(s), /4 hilos · 10\.544 lect\./);
});

test("paralelo: Adaptive Join con rama no ejecutada excluida de costos y desvíos", () => {
  const s = analizar("paralelo").conPlan[0];
  const adapt = s.nodos.find((n) => n.fisico === "Adaptive Join");
  assert.equal(adapt.hijos.length, 3);
  assert.equal(adapt.hijos[2].ramaAlternativa, true);
  assert.equal(adapt.hijos[2].noEjecutado, true);
  assert.equal(adapt.hijos[2].porcentaje, 0);
  assert.ok(!con(s, /erró las filas/), "la rama no ejecutada no cuenta como desvío");
  assert.ok(Math.abs(s.nodos.reduce((a, n) => a + n.porcentaje, 0) - 100) < 2);
  assert.ok(con(s, /Pidió 168,0 MB de memoria y usó 15,5 MB/));
  assert.ok(con(s, /Join adaptativo/));
  assert.ok(con(s, /Falta un índice sobre dbo\.Pedidos \(Estado\)/));
  assert.match(s.resumen.frase, /paralela con 4 hilos/);
  assert.ok(s.plan.esperas.some((e) => e.tipo === "CXSYNC_PORT"));
  assert.match(L.arbolTexto(s), /no se ejecutó/);
});

test("sobregrant: MemoryGrantWarning y parámetros con fecha", () => {
  const s = analizar("sobregrant").conPlan[0];
  const m = con(s, /Pidió 347,6 MB de memoria y usó 6,4 MB/);
  assert.equal(m.gravedad, "media");
  assert.ok(con(s, /se compiló con @d = '2020-01-01 00:00:00' y corrió con '2099-01-01 00:00:00'/));
  assert.ok(con(s, /erró las filas por 400\.000×/));
  assert.ok(!con(s, /ordenamiento se lleva/), "sort con 0 filas no se reporta");
  assert.equal(s.plan.avisos[0].tipo, "MemoryGrantWarning");
});

test("udf: función escalar, razón de no paralelismo y tiempos de UDF", () => {
  const s = analizar("udf").conPlan[0];
  const h = con(s, /Función escalar definida por el usuario/);
  assert.equal(h.gravedad, "alta");
  assert.match(h.que, /fn_TotalConIva/);
  assert.match(h.que, /TSQLUserDefinedFunctionsNotParallelizable/);
  assert.match(h.que, /67 ms de CPU de 153 ms/);
  assert.equal(s.plan.tiempos.udfCpuMs, 67);
  assert.ok(!con(s, /No se pudo paralelizar/), "la UDF ya explica el no paralelismo");
});

test("spool: bucles anidados con table spool y seek con predicado residual", () => {
  const s = analizar("spool").conPlan[0];
  const b = con(s, /Bucles anidados que recorren dbo\.Pedidos 300 veces/);
  assert.equal(b.gravedad, "alta");
  assert.match(b.que, /Spool de tabla/);
  assert.match(b.que, /120\.000\.000 filas/);
  const sp = con(s, /Table Spool en el lado interno/);
  assert.equal(sp.gravedad, "alta");
  assert.ok(con(s, /El seek sobre dbo\.Clientes lee 3\.000 filas y filtra después hasta 300/));
  assert.ok(con(s, /Falta un índice sobre dbo\.Pedidos \(Total\)/));
  assert.match(s.resumen.frase, /10,0 s de duración/);
});

test("cruzado: NoJoinPredicate", () => {
  const s = analizar("cruzado").conPlan[0];
  const h = con(s, /producto cartesiano/);
  assert.equal(h.gravedad, "alta");
  assert.equal(s.nodos.find((n) => n.id === h.nodos[0]).avisos[0].tipo, "NoJoinPredicate");
});

test("timeout, trivial, estimado y procedimiento", () => {
  const t = analizar("timeout").conPlan[0];
  assert.equal(t.abortoTemprano, "TimeOut");
  assert.equal(con(t, /se quedó sin tiempo/).gravedad, "media");
  assert.equal(t.nodos.length, 30);
  const tr = analizar("trivial").conPlan[0];
  assert.equal(tr.nivelOptimizacion, "TRIVIAL");
  assert.ok(con(tr, /Plan trivial/));
  assert.match(tr.resumen.frase, /devolvió 1 fila \(estimaba 1\)/);
  const e = analizar("estimado");
  assert.equal(e.esReal, false);
  assert.equal(titulos(e.conPlan[0])[0], "Es un plan estimado, sin filas reales");
  assert.match(e.conPlan[0].resumen.frase, /estima 6 filas/);
  assert.equal(e.conPlan[0].raiz.hijos[1].real, null);
  const p = analizar("procedimiento").conPlan[0];
  assert.ok(p.nodos.some((n) => n.objeto && n.objeto.esVariable), "detecta la variable de tabla");
  assert.equal(p.plan.dop, 4);
});

test("índice filtrado que no se usa por la parametrización (UnmatchedIndexes)", () => {
  const s = analizar("indice-filtrado-parametro").conPlan[0];
  const h = con(s, /índice filtrado que no se puede usar porque la consulta está parametrizada: dbo\.Pedidos \(IX_Pedidos_Pendientes\)/);
  assert.equal(h.gravedad, "media");
  assert.match(h.que, /lee la tabla entera/);
  assert.match(h.hacer, /OPTION \(RECOMPILE\)/);
  assert.deepEqual(s.plan.indicesNoUsados.map((o) => o.indice), ["IX_Pedidos_Pendientes"]);
  assert.equal(s.nodos.find((n) => n.id === h.nodos[0]).fisico, "Clustered Index Scan");
});

test("update, ventana, like, agregado y spool2 no tiran y dan hallazgos coherentes", () => {
  const u = analizar("update").conPlan[0];
  assert.equal(u.tipo, "UPDATE");
  assert.ok(con(u, /Modifica/));
  assert.ok(u.nodos.some((n) => n.fisico === "Clustered Index Update"));
  const v = analizar("ventana").conPlan[0];
  assert.ok(v.nodos.some((n) => n.fisico === "Window Aggregate"));
  assert.ok(con(v, /ordenamiento se lleva el 17 %/));
  assert.deepEqual(v.nodos.find((n) => n.fisico === "Sort").detalle.ordenPor, ["p.ClienteId", "p.Fecha desc"]);
  const l = analizar("like").conPlan[0];
  const h = con(l, /Recorre 50\.000 filas de dbo\.Clientes para quedarse con 50/);
  assert.match(h.que, /LIKE que empieza con «%»/);
  const a = analizar("agregado").conPlan[0];
  assert.equal(a.hallazgos.filter((x) => x.gravedad === "alta").length, 0);
  assert.equal(a.nodos.find((n) => n.fisico === "Hash Match").nombreEs, "Agregado por hash");
  const s2 = analizar("spool2").conPlan[0];
  assert.equal(s2.hallazgos.filter((x) => x.gravedad === "alta").length, 0);
});

test("todos los planes reales se analizan sin excepciones y los porcentajes cierran", () => {
  for (const f of fs.readdirSync(path.join(__dirname, "planes")).filter((x) => x.endsWith(".sqlplan"))) {
    const r = L.analizar(plan(f.replace(/\.sqlplan$/, "")));
    for (const s of r.conPlan) {
      assert.ok(s.raiz, `${f}: sin raíz`);
      const total = s.nodos.reduce((acc, n) => acc + n.porcentaje, 0);
      assert.ok(total >= 95 && total <= 105, `${f}: porcentajes suman ${total}`);
      for (const h of s.hallazgos) { assert.ok(h.titulo && h.que && h.hacer, `${f}: hallazgo incompleto`); assert.ok(!/undefined|NaN/.test(h.titulo + h.que + h.hacer + (h.codigo || "")), `${f}: texto con undefined/NaN en «${h.titulo}»`); }
      assert.ok(!/undefined|NaN/.test(L.arbolTexto(s) + s.resumen.frase + s.resumen.masPesa), `${f}: árbol con undefined`);
    }
  }
});

/* Casos que no se pudieron generar contra el servidor: XML mínimo armado a mano siguiendo el esquema showplan. */
const envolver = (relOp, extraQP = "", extraStmt = "") => `<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.564" Build="16.0.4305.5"><BatchSequence><Batch><Statements>
<StmtSimple StatementText="SELECT 1" StatementId="1" StatementType="SELECT" StatementSubTreeCost="12" StatementEstRows="10" StatementOptmLevel="FULL" CardinalityEstimationModelVersion="70" ${extraStmt}>
<QueryPlan DegreeOfParallelism="1" CompileTime="2500" CompileCPU="2500" CompileMemory="9000" NonParallelPlanReason="MaxDOPSetToOne">${extraQP}${relOp}</QueryPlan></StmtSimple></Statements></Batch></BatchSequence></ShowPlanXML>`;

test("a mano: columnas sin estadísticas, index spool ansioso, CE 70, compilación cara y no paralelo por MAXDOP", () => {
  const xml = envolver(`
<RelOp NodeId="0" PhysicalOp="Nested Loops" LogicalOp="Inner Join" EstimateRows="10" EstimatedTotalSubtreeCost="12" Parallel="0" EstimateRebinds="0" EstimateRewinds="0">
  <OutputList/><NestedLoops Optimized="0">
  <RelOp NodeId="1" PhysicalOp="Clustered Index Scan" LogicalOp="Clustered Index Scan" EstimateRows="10" EstimatedTotalSubtreeCost="1" TableCardinality="200000" EstimateRebinds="0" EstimateRewinds="0">
    <OutputList/><Warnings><ColumnsWithNoStatistics><ColumnReference Database="[db]" Schema="[dbo]" Table="[Ventas]" Column="Zona"/></ColumnsWithNoStatistics></Warnings>
    <RunTimeInformation><RunTimeCountersPerThread Thread="0" ActualRows="10" ActualRowsRead="200000" ActualExecutions="1" ActualLogicalReads="5000"/></RunTimeInformation>
    <IndexScan Ordered="0"><Object Database="[db]" Schema="[dbo]" Table="[Ventas]" Index="[PK_Ventas]" IndexKind="Clustered"/><Predicate><ScalarOperator ScalarString="[db].[dbo].[Ventas].[Zona]=(3)"><Identifier><ColumnReference Database="[db]" Schema="[dbo]" Table="[Ventas]" Column="Zona"/></Identifier></ScalarOperator></Predicate></IndexScan>
  </RelOp>
  <RelOp NodeId="2" PhysicalOp="Index Spool" LogicalOp="Eager Spool" EstimateRows="1" EstimatedTotalSubtreeCost="10" EstimateRebinds="9" EstimateRewinds="0">
    <OutputList/><RunTimeInformation><RunTimeCountersPerThread Thread="0" ActualRows="10" ActualExecutions="10"/></RunTimeInformation>
    <Spool><RelOp NodeId="3" PhysicalOp="Table Scan" LogicalOp="Table Scan" EstimateRows="50000" EstimatedTotalSubtreeCost="2" EstimateRebinds="0" EstimateRewinds="0"><OutputList/><RunTimeInformation><RunTimeCountersPerThread Thread="0" ActualRows="50000" ActualExecutions="1"/></RunTimeInformation><TableScan Ordered="0"><Object Database="[db]" Schema="[dbo]" Table="[Detalle]"/></TableScan></RelOp></Spool>
  </RelOp>
  </NestedLoops></RelOp>`);
  const r = L.analizar(xml);
  const s = r.conPlan[0];
  const t = titulos(s);
  assert.ok(t.some((x) => /Sin estadísticas sobre Ventas\.Zona/.test(x)), t.join(" | "));
  const spool = con(s, /Index Spool: el optimizador se armó un índice al vuelo/);
  assert.equal(spool.gravedad, "alta");
  assert.ok(con(s, /estimador de cardinalidad viejo \(CE 70\)/));
  assert.ok(con(s, /Compilar el plan llevó 2,5 s/));
  assert.match(con(s, /No se pudo paralelizar/).titulo, /MAXDOP está en 1/);
  const scan = con(s, /Recorre 200\.000 filas de dbo\.Ventas para quedarse con 10/);
  assert.equal(scan.gravedad, "media");
  assert.match(scan.hacer, /Un índice sobre Zona/);
  assert.equal(s.nodos.find((n) => n.id === 3).nombreEs, "Recorrido de tabla (heap)");
});

test("a mano: StmtCond con Then/Else, StmtCursor y sentencias sin plan", () => {
  const sub = (id) => `<StmtSimple StatementText="SELECT ${id}" StatementId="${id}" StatementType="SELECT" StatementSubTreeCost="0.01" StatementEstRows="1"><QueryPlan><RelOp NodeId="0" PhysicalOp="Constant Scan" LogicalOp="Constant Scan" EstimateRows="1" EstimatedTotalSubtreeCost="0.01" EstimateRebinds="0" EstimateRewinds="0"><OutputList/><ConstantScan/></RelOp></QueryPlan></StmtSimple>`;
  const xml = `<ShowPlanXML xmlns="http://schemas.microsoft.com/sqlserver/2004/07/showplan" Version="1.5" Build="15.0.4"><BatchSequence><Batch><Statements>
    <StmtSimple StatementText="SET NOCOUNT ON" StatementId="1" StatementType="SET ON/OFF"/>
    <StmtCond StatementText="IF @x = 1" StatementId="2" StatementType="COND"><Condition>${sub(3)}</Condition><Then><Statements>${sub(4)}</Statements></Then><Else><Statements>${sub(5)}</Statements></Else></StmtCond>
    <StmtCursor StatementText="DECLARE c CURSOR" StatementId="6" StatementType="DECLARE CURSOR"><CursorPlan CursorName="c"><Operation OperationType="FetchQuery">${sub(7).replace(/<\/?StmtSimple[^>]*>/g, "")}</Operation></CursorPlan></StmtCursor>
  </Statements></Batch></BatchSequence></ShowPlanXML>`;
  const r = L.analizar(xml);
  assert.equal(r.versionServidor, "SQL Server 2019");
  assert.deepEqual(r.conPlan.map((s) => s.texto), ["SELECT 3", "SELECT 4", "SELECT 5", "DECLARE c CURSOR"]);
  assert.equal(r.conPlan[3].tipo, "CURSOR FetchQuery");
  assert.equal(r.conPlan[0].orden, 1);
  assert.equal(r.conPlan[0].raiz.nombreEs, "Lectura de constantes");
});

test("a mano: plan dentro de otro XML (eventos extendidos) y sin namespace", () => {
  const xml = `<event name="query_post_execution_showplan"><data name="showplan_xml"><value><ShowPlanXML Version="1.5" Build="14.0.1"><BatchSequence><Batch><Statements><StmtSimple StatementText="SELECT 1" StatementId="1" StatementType="SELECT" StatementSubTreeCost="0.01" StatementEstRows="1"><QueryPlan><RelOp NodeId="0" PhysicalOp="Constant Scan" LogicalOp="Constant Scan" EstimateRows="1" EstimatedTotalSubtreeCost="0.01" EstimateRebinds="0" EstimateRewinds="0"><OutputList/><ConstantScan/></RelOp></QueryPlan></StmtSimple></Statements></Batch></BatchSequence></ShowPlanXML></value></data></event>`;
  const r = L.analizar(xml);
  assert.equal(r.versionServidor, "SQL Server 2017");
  assert.equal(r.conPlan.length, 1);
});

test("glosario y formato", () => {
  assert.ok(L.glosario().length > 40);
  assert.ok(L.glosario().every((g) => g.nombre && g.descripcion && g.clase));
  assert.equal(L.fmtKB(355904), "347,6 MB");
  assert.equal(L.fmtMs(845), "845 ms");
  assert.equal(L.fmtMs(10000), "10,0 s");
  assert.equal(L.fmtNum(1234567, 0), "1.234.567");
  assert.equal(L.plural(1, "fila"), "1 fila");
  assert.equal(L.plural(6, "fila"), "6 filas");
  assert.equal(L.scriptIndice("dbo", "T", ["A", "B"], ["C"]), "CREATE NONCLUSTERED INDEX [IX_T_A_B]\n  ON [dbo].[T] ([A], [B])\n  INCLUDE ([C]);");
});
