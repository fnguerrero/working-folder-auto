/* Verifica que lo que dice el escrito coincida con resultados.json (lo que se midió contra SQL Server):
   que cada tabla tenga el tiempo, los viajes, las lecturas, las filas y los bytes de cada variante tal cual los
   formatea tablas.js, que los bloques «lo que mandó EF» sean el SQL capturado, y que las afirmaciones de la prosa
   (× más lento, lecturas, viajes, MB) salgan de los datos dentro de una tolerancia.
   Correr desde la raíz del repo: node --test escritos/efcore-con-cronometro/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tiempo, bytes, entero, limpiarSql } = require("../tablas.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resultados.json"), "utf8"));
const v = (c, i) => { const r = R.capitulos[c][i]; assert.ok(r, `${c}[${i}]`); return r; };
const ratio = (c, a, b) => v(c, a).medianaMs / v(c, b).medianaMs;
const entre = (x, lo, hi, que) => assert.ok(x >= lo && x <= hi, `${que}: ${x} no está entre ${lo} y ${hi}`);
const dice = (t) => assert.ok(html.includes(t), `falta en el texto: «${t}»`);
const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("hay 13 capítulos con 86 mediciones y cada uno tiene su tabla", () => {
  const caps = Object.keys(R.capitulos);
  assert.equal(caps.length, 13);
  assert.equal(caps.reduce((n, c) => n + R.capitulos[c].length, 0), 86);
  for (const c of caps) assert.ok(html.includes(`<table data-capitulo="${c}">`), `tabla de ${c}`);
  assert.equal((html.match(/<h2 id="/g) || []).length, 16);
});

test("cada fila de cada tabla tiene los números que dice el JSON", () => {
  for (const [c, lista] of Object.entries(R.capitulos)) {
    const ini = html.indexOf(`<table data-capitulo="${c}">`);
    const tabla = html.slice(ini, html.indexOf("</table>", ini));
    for (const r of lista) {
      const fila = tabla.slice(tabla.indexOf(`<code>${escapar(r.variante)}</code>`));
      assert.ok(fila.length > 0, `${c}: ${r.variante} en la tabla`);
      const celdas = fila.slice(0, fila.indexOf("</tr>"));
      for (const t of [tiempo(r.medianaMs), entero(r.viajesAlServidor), entero(r.lecturasLogicas), entero(r.filasRecibidas), bytes(r.bytesRecibidos), bytes(r.bytesAsignados)])
        assert.ok(celdas.includes(t), `${c} / ${r.variante}: falta ${t}`);
    }
    assert.ok(/1,0×/.test(tabla), `${c}: la base está marcada`);
  }
});

test("los bloques «lo que mandó EF» son el SQL capturado", () => {
  const bloques = [...html.matchAll(/<!-- sql:(\w+):(\d+)(?::(\d+))? -->\s*<pre class="sql"><code>([\s\S]*?)<\/code><\/pre>/g)];
  assert.equal(bloques.length, 13);
  for (const [, c, i, cual, cuerpo] of bloques) assert.equal(cuerpo, escapar(limpiarSql(v(c, Number(i)).sql[Number(cual || 0)])), `sql ${c}:${i}`);
});

test("todas las mediciones tienen 5 repeticiones, viajes y lecturas coherentes", () => {
  assert.equal(R.repeticiones, 5);
  for (const [c, lista] of Object.entries(R.capitulos)) for (const r of lista) {
    assert.ok(r.medianaMs > 0 && r.minMs <= r.medianaMs && r.medianaMs <= r.maxMs, `${c}: ${r.variante} tiempos`);
    assert.ok(r.viajesAlServidor >= 1, `${c}: ${r.variante} viajes`);
  }
});

test("capítulo 1: N+1", () => {
  assert.equal(v("n1", 0).viajesAlServidor, 201); assert.equal(v("n1", 1).viajesAlServidor, 201); dice("<b>201 viajes</b>");
  assert.equal(v("n1", 2).viajesAlServidor, 1); entre(v("n1", 2).bytesRecibidos / 1024, 320, 340, "Include: 329 KB"); dice("<b>329 KB</b>");
  entre(v("n1", 4).bytesRecibidos / 1024, 10, 12, "proyección con ítems: 11 KB"); dice("en 11 KB");
  entre(v("n1", 3).bytesRecibidos / 1024, 1.5, 2.5, "proyección: 2 KB"); assert.equal(v("n1", 3).lecturasLogicas, 670); dice("2 KB, 670 lecturas y 3 ms");
  entre(ratio("n1", 2, 3), 7, 14, "Include vs proyección ~10×"); entre(ratio("n1", 0, 3), 50, 100, "bucle vs proyección ~70×");
  entre(v("n1", 0).medianaMs, 180, 260, "bucle: 215 ms");
});

test("capítulo 2: explosión cartesiana", () => {
  assert.equal(v("cartesiano", 0).filasRecibidas, 3011); assert.equal(v("cartesiano", 1).filasRecibidas, 12413); dice("<b>12.413</b>");
  entre(v("cartesiano", 1).bytesRecibidos / 1048576, 6.5, 7.5, "7 MB"); entre(v("cartesiano", 1).bytesAsignados / 1048576, 22, 26, "24 MB");
  assert.equal(v("cartesiano", 2).viajesAlServidor, 3); assert.equal(v("cartesiano", 2).filasRecibidas, 8108); entre(v("cartesiano", 2).bytesRecibidos / 1024, 700, 740, "722 KB"); dice("8.108 en total, 722 KB");
  assert.equal(v("cartesiano", 3).filasRecibidas, 12413); entre(v("cartesiano", 3).bytesRecibidos / 1024, 590, 615, "602 KB"); dice("602 KB en vez de 7 MB");
});

test("capítulo 3: tracking", () => {
  entre(ratio("tracking", 0, 1), 2, 4.5, "rastrear vs no: entre 2 y 4 veces"); dice("186 ms contra 49");
  entre((v("tracking", 0).bytesAsignados - v("tracking", 1).bytesAsignados) / 1048576, 20, 24, "22 MB más");
  entre(v("tracking", 2).medianaMs / 1000, 1.6, 2.2, "Include rastreando: 1,9 s"); entre(v("tracking", 3).medianaMs, 150, 200, "HashSet: 169 ms"); dice("169 ms, once veces menos");
  entre(ratio("tracking", 2, 3), 9, 13, "List vs HashSet: 11×");
  entre(v("tracking", 5).medianaMs / 1000, 2.5, 3.2, "identity resolution 2,8 s"); entre(v("tracking", 6).medianaMs, 170, 215, "191 ms"); dice("2,8 segundos contra 191 ms");
  entre((v("tracking", 4).bytesAsignados - v("tracking", 1).bytesAsignados) / 1048576, 10, 14, "20.000 clientes: 12 MB más");
  entre((v("tracking", 7).bytesAsignados - v("tracking", 0).bytesAsignados) / 1048576, 15, 19, "SaveChanges sin cambios: 17 MB más");
});

test("capítulo 4: proyección", () => {
  for (let i = 0; i < 5; i++) assert.equal(v("proyeccion", i).lecturasLogicas, 1364);
  entre(v("proyeccion", 0).bytesRecibidos / 1048576, 10, 10.6, "10,4 MB"); entre(v("proyeccion", 1).bytesRecibidos / 1024, 210, 220, "215 KB"); dice("<b>10,4 MB</b>"); dice("<b>215 KB</b>");
  entre(v("proyeccion", 0).bytesRecibidos / v("proyeccion", 1).bytesRecibidos, 44, 52, "48 veces menos");
  entre(v("proyeccion", 0).bytesAsignados / 1048576, 35, 39, "37 MB"); entre(v("proyeccion", 1).bytesAsignados / 1048576, 4, 6, "5 MB");
  entre(v("proyeccion", 0).medianaMs, 42, 52, "47 ms"); entre(v("proyeccion", 1).medianaMs, 8, 11, "9,5 ms");
  assert.equal(v("proyeccion", 3).filasRecibidas, 1); entre(ratio("proyeccion", 4, 3), 4, 6.5, "Sum en el cliente: 5×");
});

test("capítulo 5: paginación", () => {
  assert.equal(v("paginacion", 0).lecturasLogicas, 19); assert.equal(v("paginacion", 3).lecturasLogicas, 19);
  assert.equal(v("paginacion", 1).lecturasLogicas, 6860); entre(v("paginacion", 1).medianaMs, 75, 100, "87 ms"); dice("6.860 lecturas y 87 ms");
  assert.equal(v("paginacion", 2).lecturasLogicas, 27395); entre(v("paginacion", 2).medianaMs, 300, 380, "343 ms"); dice("27.395 lecturas (la tabla entera) y 343 ms");
  assert.equal(v("paginacion", 4).lecturasLogicas, 7); entre(v("paginacion", 4).medianaMs, 0.7, 1.4, "1 ms"); dice("<b>7 lecturas y 1 ms</b>");
  assert.equal(v("paginacion", 5).lecturasLogicas, 1275897); entre(v("paginacion", 5).medianaMs, 850, 1050, "casi un segundo"); dice("<b>1.275.897 lecturas</b>");
  assert.equal(v("paginacion", 6).lecturasLogicas, 165); dice("hace 165 lecturas");
});

test("capítulo 6: Contains", () => {
  assert.equal(v("contains", 2).filasRecibidas, 10000); entre(v("contains", 2).medianaMs, 24, 34, "OPENJSON 10.000: 28 ms"); entre(v("contains", 5).medianaMs, 95, 120, "IN 10.000: 107 ms"); dice("tarda 28 ms y la vieja 107");
  entre(v("contains", 5).sql[0].length / 1024, 60, 80, "SQL de 70 KB"); dice("mide 70 KB");
  entre(v("contains", 5).primeraMs / 1000, 0.8, 1.3, "primera con 10.000 literales: un segundo");
  assert.equal(v("contains", 6).filasRecibidas, 128); dice("El 128 de la columna de filas");
  assert.match(v("contains", 6).sql[0], /varchar\(200\)/); assert.match(v("contains", 0).sql[0], /OPENJSON/); assert.match(v("contains", 3).sql[0], /IN \(\d+/);
});

test("capítulo 7: lo que trae de más", () => {
  assert.equal(v("demas", 0).lecturasLogicas, 3); assert.equal(v("demas", 1).lecturasLogicas, 177); assert.equal(v("demas", 2).lecturasLogicas, 4);
  entre(ratio("demas", 1, 0), 7, 11, "Count vs Any: 9×"); dice("nueve veces más que <code>Any()</code>");
  assert.equal(v("demas", 3).filasRecibidas, 100000); entre(v("demas", 3).bytesRecibidos / 1048576, 50, 53, "52 MB"); entre(v("demas", 3).bytesAsignados / 1048576, 180, 190, "187 MB"); entre(v("demas", 3).medianaMs, 400, 550, "medio segundo");
  assert.equal(v("demas", 6).lecturasLogicas, 956959); entre(v("demas", 6).medianaMs, 330, 430, "377 ms"); dice("<b>377 ms y 956.959 lecturas</b>");
  assert.equal(v("demas", 8).lecturasLogicas, 36); entre(v("demas", 8).medianaMs, 1, 2.2, "1,5 ms"); dice("36 lecturas y 1,5 ms");
});

test("capítulo 8: insertar", () => {
  assert.equal(v("insertar", 0).viajesAlServidor, 2000); entre(v("insertar", 0).medianaMs / 1000, 5.5, 7.5, "6,4 s"); entre(v("insertar", 0).bytesAsignados / 1073741824, 1.5, 1.9, "1,7 GB"); dice("<b>6,4 segundos</b>"); dice("<b>1,7 GB</b>");
  assert.equal(v("insertar", 1).viajesAlServidor, 50); entre(v("insertar", 1).medianaMs, 210, 280, "240 ms"); dice("hace 50 viajes");
  assert.equal(v("insertar", 2).viajesAlServidor, 3); entre(v("insertar", 2).medianaMs, 90, 125, "106 ms");
  entre(v("insertar", 3).medianaMs / 1000, 1.8, 2.4, "20.000: 2,1 s"); entre(v("insertar", 4).medianaMs / 1000, 0.42, 0.6, "bulk 20.000: 0,5 s");
  entre(v("insertar", 3).bytesAsignados / 1048576, 250, 280, "266 MB"); entre(v("insertar", 4).bytesAsignados / 1048576, 17, 22, "20 MB"); dice("266 MB contra 20");
  assert.match(v("insertar", 1).sql[0], /MERGE \[Pedidos\]/);
});

test("capítulo 9: actualizar y borrar", () => {
  assert.equal(v("actualizar", 0).viajesAlServidor, 242); entre(v("actualizar", 0).bytesRecibidos / 1048576, 5.2, 5.7, "5,5 MB"); entre(v("actualizar", 0).bytesAsignados / 1048576, 108, 118, "114 MB"); entre(v("actualizar", 0).medianaMs, 500, 620, "554 ms");
  assert.equal(v("actualizar", 1).viajesAlServidor, 1); entre(v("actualizar", 1).medianaMs, 35, 50, "42 ms"); dice("<b>un viaje, 42 ms y ningún objeto</b>");
  assert.equal(v("actualizar", 2).viajesAlServidor, 954); entre(v("actualizar", 2).medianaMs / 1000, 1.9, 2.4, "2,1 s"); assert.equal(v("actualizar", 3).viajesAlServidor, 1); entre(v("actualizar", 3).medianaMs, 350, 450, "401 ms"); dice("2,1 segundos y 954 viajes contra 401 ms y uno");
});

test("capítulo 10: buscar por clave", () => {
  entre(v("clave", 10).medianaMs / 2000, 0.13, 0.18, "Dapper: 0,15 ms"); entre(v("clave", 11).medianaMs / 2000, 0.13, 0.18, "SqlCommand: 0,15 ms"); dice("<b>El viaje cuesta 0,15 ms</b>");
  entre(v("clave", 5).medianaMs / 2000, 0.2, 0.26, "un contexto: 0,23 ms"); entre(v("clave", 4).medianaMs / 2000, 0.2, 0.26, "pool: 0,23 ms");
  entre(v("clave", 1).medianaMs / 2000, 0.58, 0.7, "contexto nuevo: 0,64 ms"); entre(v("clave", 1).bytesAsignados / 2000 / 1024, 72, 84, "78 KB por contexto"); dice("0,64 ms y 78 KB");
  entre(ratio("clave", 1, 3), 1.35, 1.7, "compilada: un tercio menos");
  entre(v("clave", 7).medianaMs, 10, 20, "Find rastreado: 14 ms"); assert.equal(v("clave", 7).viajesAlServidor, 1); dice("14 ms las 2.000: 7 µs cada una");
  assert.equal(v("clave", 8).viajesAlServidor, 2001);
  entre(v("clave", 9).medianaMs / 1000, 3.3, 4.2, "Local: 3,7 s"); entre(v("clave", 9).bytesAsignados / 1073741824, 3.1, 3.6, "3,4 GB"); dice("3,7 segundos y <b>3,4 GB</b>");
});

test("capítulo 11: varchar y sargabilidad", () => {
  const lect = R.capitulos.varchar.map((r) => r.lecturasLogicas);
  assert.deepEqual(lect, [3, 257, 3, 257, 257, 257, 3, 257]);
  assert.equal(v("varchar", 0).sql[0], v("varchar", 1).sql[0]); dice("mandan exactamente el mismo texto SQL");
  entre(ratio("varchar", 1, 0), 5, 10, "nvarchar: 7×");
});

test("capítulo 12: caché de planes", () => {
  assert.match(v("constantes", 0).nota, /: 300$/); assert.match(v("constantes", 1).nota, /: 1$/); assert.match(v("constantes", 2).nota, /: 1$/); assert.match(v("constantes", 3).nota, /: 300$/);
  dice("<b>300 planes en caché</b>");
  entre(ratio("constantes", 0, 1), 6, 8, "FromSqlRaw: 7×"); dice("tarda siete veces más (640 ms contra 92)");
  assert.equal(v("constantes", 0).lecturasLogicas, 12923); assert.equal(v("constantes", 1).lecturasLogicas, 1262); dice("suben de 1.262 a 12.923");
  entre(v("constantes", 3).medianaMs, 680, 820, "Expression.Constant: 744 ms"); assert.match(v("constantes", 3).sql[1], /> 1017\.0/); dice("[p].[Total] &gt; 1017.0");
  assert.match(v("constantes", 2).sql[0], /@__total_0/); assert.match(v("constantes", 1).sql[0], /@p0/);
});

test("capítulo 13: async", () => {
  entre(v("async", 0).medianaMs, 125, 160, "sync docs: 140 ms"); entre(v("async", 1).medianaMs, 800, 1000, "async docs: 892 ms"); dice("<b>892 ms contra 140, y 944 MB asignados contra 117</b>");
  entre(v("async", 1).bytesAsignados / 1048576, 900, 990, "944 MB"); entre(v("async", 0).bytesAsignados / 1048576, 110, 125, "117 MB"); entre(v("async", 1).bytesRecibidos / 1048576, 37, 40, "39 MB");
  entre(ratio("async", 4, 3), 2.2, 3, "20.000 pedidos: 2,6×"); dice("<b>2,6 veces más</b> (117 ms contra 46)");
  entre((v("async", 4).bytesAsignados - v("async", 3).bytesAsignados) / 1048576, 13, 17, "15 MB más");
  entre(v("async", 6).medianaMs - v("async", 5).medianaMs, 0.15, 0.5, "un pedido: 0,3 ms más");
  entre(v("async", 2).medianaMs, 1.5, 3, "solo título: 2 ms");
});
