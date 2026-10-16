/* Verifica que lo que dice el escrito coincida con resultados.json (lo que midió BenchmarkDotNet):
   que cada tabla tenga la media y la memoria de cada benchmark tal cual las formatea tablas.js, y que las
   afirmaciones de la prosa (× más lento, bytes, nanosegundos) salgan de los datos.
   Correr desde la raíz del repo: node --test escritos/cuanto-cuesta-dotnet/tests/*.test.js */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { tiempo, memoria } = require("../tablas.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const R = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resultados.json"), "utf8"));
const g = (c, m) => { const b = R.capitulos[c].find((x) => x.metodo === m); assert.ok(b, `${c}.${m}`); return b; };
const ratio = (c, a, b) => g(c, a).mediaNs / g(c, b).mediaNs;
const entre = (x, lo, hi, que) => assert.ok(x >= lo && x <= hi, `${que}: ${x} no está entre ${lo} y ${hi}`);
const dice = (t) => assert.ok(html.includes(t), `falta en el texto: «${t}»`);

test("hay 129 benchmarks en 17 capítulos y cada uno tiene su tabla", () => {
  const caps = Object.keys(R.capitulos);
  assert.equal(caps.length, 17);
  assert.equal(caps.reduce((n, c) => n + R.capitulos[c].length, 0), 129);
  for (const c of caps) assert.ok(html.includes(`<table data-clase="${c}">`), `tabla de ${c}`);
  dice("129 microbenchmarks");
});

test("cada fila de cada tabla tiene la media y la memoria que dice el JSON", () => {
  for (const [c, lista] of Object.entries(R.capitulos)) {
    const tabla = html.slice(html.indexOf(`<table data-clase="${c}">`), html.indexOf("</table>", html.indexOf(`<table data-clase="${c}">`)));
    for (const b of lista) {
      assert.ok(tabla.includes(`<code>${b.metodo}</code>`), `${c}.${b.metodo} en la tabla`);
      assert.ok(tabla.includes(tiempo(b.mediaNs)), `${c}.${b.metodo}: media ${tiempo(b.mediaNs)}`);
      assert.ok(tabla.includes(memoria(b.bytes)), `${c}.${b.metodo}: memoria ${memoria(b.bytes)}`);
    }
    assert.ok(/1,00×/.test(tabla), `${c}: la base está marcada`);
  }
});

test("todo benchmark tiene un bloque de código con su nombre", () => {
  for (const lista of Object.values(R.capitulos)) for (const b of lista) assert.ok(new RegExp(`<pre><code>[^]*?${b.metodo.replace(/_/g, "_?")}\\(`).test(html), `código de ${b.metodo}`);
});

test("capítulo 1 y 2: cadenas y comparaciones", () => {
  assert.equal(g("Cadenas", "ConcatEnBucle").bytes, 3584); dice("3,5 KB para 20 partes");
  entre(ratio("Cadenas", "StringFormat", "Interpolacion"), 1.6, 2.5, "Format vs interpolación: mitad de tiempo");
  assert.ok(g("Cadenas", "Interpolacion").bytes * 2 < g("Cadenas", "StringFormat").bytes, "menos de la mitad de memoria");
  entre(ratio("Comparaciones", "ToLowerEquals", "EqualsOrdinalIgnoreCase"), 4, 7, "ToLower 5×"); assert.equal(g("Comparaciones", "ToLowerEquals").bytes, 208); dice("200 B de basura por comparación");
  entre(ratio("Comparaciones", "StartsWithDefault", "StartsWithOrdinal"), 8, 12.5, "StartsWith cultura");
  entre(ratio("Comparaciones", "EndsWithDefault", "EndsWithOrdinal"), 8, 12.5, "EndsWith cultura"); dice("entre 8 y 12 veces más lentas");
});

test("capítulo 3 a 7: parseo, colecciones, búsquedas, claves, asignaciones", () => {
  assert.equal(g("Parseo", "SplitYParse").bytes, 336); dice("336 B por línea");
  entre(g("Parseo", "SplitMil").bytes / 1024, 440, 480, "470 KB");
  entre(ratio("Parseo", "SplitYParse", "SpanYParse"), 1.8, 2.6, "Span: menos de la mitad");
  assert.equal(g("Parseo", "Substring_").bytes / 100, 48); dice("48 B por llamada");
  entre(ratio("Colecciones", "ListSinCapacidad", "ListConCapacidad"), 1.5, 2.1, "capacidad: 40 %");
  entre(g("Colecciones", "ListSinCapacidad").bytes / g("Colecciones", "ListConCapacidad").bytes, 1.9, 2.2, "capacidad: mitad de memoria");
  entre(ratio("Colecciones", "ForeachSobreIEnumerable", "ForeachSobreList"), 1.8, 2.6, "IEnumerable: el doble"); assert.equal(g("Colecciones", "ForeachSobreIEnumerable").bytes, 40);
  entre(ratio("Colecciones", "LinqWhereSelectSum", "BucleWhereSelectSum"), 2.2, 2.9, "LINQ 2,5×"); dice("2,5 veces menos");
  entre((g("Colecciones", "LinqWhereSelectSum").mediaNs - g("Colecciones", "BucleWhereSelectSum").mediaNs) / 1000, 3.5, 4.6, "4 µs por mil");
  assert.ok(g("Colecciones", "AnySobreList").mediaNs < 10 && g("Colecciones", "CountMayorQueCero").mediaNs < 1, "Any y Count despreciables");
  entre(ratio("Busquedas", "ListFind100", "Dictionary100"), 180, 240, "diccionario 200×"); dice("200 veces más rápido");
  entre(ratio("Busquedas", "ListFind100", "ToDictionaryYBuscar100"), 4.5, 6, "ToDictionary adentro 5×"); entre(g("Busquedas", "ToDictionaryYBuscar100").bytes / 1024, 29, 32, "31 KB");
  entre(ratio("Busquedas", "ListFirstOrDefault100", "ListFind100"), 4.3, 5.7, "Find vs FirstOrDefault 5×");
  entre(g("Busquedas", "JoinLinq100").bytes / 1024, 98, 106, "Join 100 KB");
  assert.equal(g("ClavesStruct", "StructSinEquatable").bytes / 1000, 72); dice("72 B de basura por búsqueda");
  entre(ratio("ClavesStruct", "StructSinEquatable", "StructConEquatable"), 2.5, 4.5, "struct sin Equatable 3 a 4×");
  assert.ok(g("ClavesStruct", "RecordStruct").mediaNs < g("ClavesStruct", "StructConEquatable").mediaNs, "record struct le gana a la mano");
  entre(ratio("Asignaciones", "ArrayListBoxing", "ListGenerica"), 5.5, 7, "ArrayList 6×"); entre(g("Asignaciones", "ArrayListBoxing").bytes / 1024, 30, 33, "32 KB");
  entre(g("Asignaciones", "MilStructs").bytes / 1024, 15.5, 16.5, "16 KB"); entre(g("Asignaciones", "MilClases").bytes / 1024, 38.5, 40, "40 KB");
  entre(ratio("Asignaciones", "MilClases", "MilStructs"), 2.8, 3.8, "clases 3×");
  assert.equal(g("Asignaciones", "LambdaConCaptura").bytes, 96); assert.equal(g("Asignaciones", "LambdaSinCaptura").bytes, 0); dice("96 B acá");
  entre(ratio("Asignaciones", "LambdaConCaptura", "LambdaSinCaptura"), 1.0, 1.25, "lambda: 10 %");
  entre(ratio("Asignaciones", "ParamsArray", "SobrecargaFija"), 17, 23, "params 20×"); dice("20× más lento que una sobrecarga");
});

test("capítulo 8 a 12: excepciones, enums, regex, JSON, reflexión", () => {
  entre(g("Excepciones", "UnThrowCatch").mediaNs, 6000, 8000, "un throw: 6 a 8 µs"); assert.equal(g("Excepciones", "UnThrowCatch").bytes, 224); dice("224 B en el caso simple");
  entre(ratio("Excepciones", "ParseConCatch10PorCiento", "TryParse10PorCiento"), 120, 150, "135×"); dice("135× más lento");
  assert.ok(ratio("Excepciones", "ParseConCatchTodasMalas", "TryParseTodasMalas") > 1000, "más de 1.000×");
  entre(g("Excepciones", "ParseConCatchTodasMalas").bytes / 100, 480, 520, "500 B por entrada inválida");
  entre(g("Enums", "EnumToString").mediaNs / 100, 12, 16, "Enum.ToString 14 ns"); assert.equal(g("Enums", "EnumToString").bytes / 100, 24); dice("24 B por llamada");
  entre(ratio("Enums", "EnumToString", "SwitchANombre"), 3.5, 5, "switch 4×"); entre(ratio("Enums", "EnumToString", "DiccionarioCache"), 5, 7, "diccionario 6×");
  entre(g("Enums", "EnumParse").mediaNs / 100, 17, 21, "Enum.Parse 19 ns"); entre(g("Enums", "EnumIsDefined").mediaNs / 100, 1.3, 1.9, "IsDefined 1,6 ns");
  entre(ratio("Regexes", "RegexNuevaCadaVez", "Interpretada"), 20, 25, "new Regex 22×"); dice("22× más lento"); entre(g("Regexes", "RegexNuevaCadaVez").bytes / 100 / 1024, 5.8, 6.4, "6 KB por llamada");
  entre(ratio("Regexes", "Interpretada", "Compilada"), 2.2, 2.7, "Compiled 2,4×"); entre(ratio("Regexes", "Interpretada", "Generada_"), 2.5, 3, "generada 2,7×"); entre(ratio("Regexes", "Interpretada", "AManoSinRegex"), 17, 23, "a mano 20×");
  entre(ratio("Json", "NewtonsoftSerializar", "StjSerializar"), 1.6, 2, "Newtonsoft serializar 1,8×"); entre(ratio("Json", "NewtonsoftDeserializar", "StjDeserializar"), 1.6, 2, "Newtonsoft deserializar 1,8×");
  entre(g("Json", "NewtonsoftSerializar").bytes / g("Json", "StjSerializar").bytes, 3.4, 3.8, "3,5× menos memoria"); entre(g("Json", "NewtonsoftDeserializar").bytes / g("Json", "StjDeserializar").bytes, 4.2, 4.6, "4,4× menos memoria");
  entre(1 - ratio("Json", "StjSerializarSourceGen", "StjSerializar"), 0.25, 0.37, "source gen 30 %"); entre(ratio("Json", "StjSerializarOpcionesNuevas", "StjSerializar"), 1.2, 1.35, "opciones nuevas 28 %"); dice("28 % más");
  entre((g("Reflexion", "GetValueReflexion").mediaNs - g("Reflexion", "Directo").mediaNs) / 100, 17, 23, "GetValue 20 ns"); assert.equal(g("Reflexion", "GetValueReflexion").bytes / 100, 32); dice("32 B por cada <code>decimal</code>");
  entre(ratio("Reflexion", "GetPropertyCadaVez", "GetValueReflexion"), 1.6, 2.1, "GetProperty cada vez: el doble"); entre(ratio("Reflexion", "DynamicCast", "Directo"), 9, 12, "dynamic 10×");
  const porLlamada = (m) => g("Llamadas", m).mediaNs / 1000, base = porLlamada("NoVirtual");
  for (const m of ["Virtual", "Interfaz", "Delegado"]) entre(porLlamada(m) - base, 0.05, 0.12, `${m}: una fracción de ns`);
  assert.ok(porLlamada("Sellada") - base < 0.04, "sealed casi directa");
});

test("capítulo 13 a 16: async, concurrencia, logging, fechas", () => {
  entre((g("Asincronia", "AsyncQueCompletaSincronico").mediaNs - g("Asincronia", "Sincronico").mediaNs) / 100, 17, 26, "async de más: 20 ns"); entre(g("Asincronia", "AsyncQueCompletaSincronico").bytes / 100, 64, 76, "70 B por Task");
  assert.equal(g("Asincronia", "ValueTaskSincronica").bytes, 0);
  entre(g("Asincronia", "TaskYield100").mediaNs / 100, 300, 500, "Yield 300 a 400 ns"); entre(g("Asincronia", "TaskRun100").mediaNs / 100, 250, 450, "Task.Run 300 ns");
  entre(ratio("Asincronia", "ResultBloqueante100", "TaskRun100"), 3.5, 5.5, ".Result 4× peor que await"); dice("4× peor");
  const porOp = (m) => g("Concurrencia", m).mediaNs / 1000;
  entre(porOp("LockIncrement"), 17, 25, "lock 20 ns"); entre(porOp("InterlockedIncrement"), 4, 7, "Interlocked 5 ns");
  entre(porOp("LockContencion4Hilos"), 70, 95, "lock con contención 83 ns"); entre(porOp("InterlockedContencion4Hilos"), 14, 22, "Interlocked con contención 18 ns");
  entre(ratio("Concurrencia", "LockContencion4Hilos", "InterlockedContencion4Hilos"), 4, 5.2, "4,6× adelante"); dice("4,6× adelante");
  entre(porOp("ConcurrentDictionaryGetOrAdd"), 3.5, 5, "ConcurrentDictionary 4 ns"); entre(porOp("DictionaryConLock"), 17, 22, "Dictionary + lock 19 ns");
  entre(g("Logging", "DebugInterpolado").mediaNs, 85, 105, "LogDebug interpolado 94 ns"); assert.equal(g("Logging", "DebugInterpolado").bytes, 96); dice("94 ns y 96 B para nada");
  assert.equal(g("Logging", "DebugPlantilla").bytes, 128); dice("(128 B)");
  for (const m of ["DebugConIsEnabled", "DebugLoggerMessageDefine", "DebugSourceGenerator"]) { assert.equal(g("Logging", m).bytes, 0); assert.ok(g("Logging", m).mediaNs < 4, `${m}: 2 a 3 ns`); }
  entre(g("Logging", "InfoPlantilla").mediaNs, 220, 265, "Info plantilla 241 ns"); assert.equal(g("Logging", "InfoPlantilla").bytes, 224); dice("241 ns, 224 B");
  entre(g("Fechas", "UtcNow").mediaNs, 25, 40, "UtcNow 30 ns"); assert.ok(g("Fechas", "Now").mediaNs < g("Fechas", "UtcNow").mediaNs * 1.3, "Now apenas más que UtcNow");
  entre(ratio("Fechas", "ToStringFormato", "ToStringO"), 2.4, 3.1, "O casi 3×"); assert.equal(g("Fechas", "TryFormat").bytes, 0);
  entre(g("Fechas", "NewGuid").mediaNs, 320, 400, "NewGuid 360 ns"); dice("360 ns");
});

test("el entorno está declarado y enlazado", () => {
  assert.match(R.entorno.runtime, /^\.NET 8\./); dice("resultados.json"); dice('href="benchmarks/"');
  dice(R.entorno.runtime.split(" (")[0]);
});
