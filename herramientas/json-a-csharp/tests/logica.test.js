// Tests de la lógica pura. Se corren con: node --test herramientas/json-a-csharp/tests
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../logica.js");

const cs = (json, op) => L.generarCSharp(L.parsear(json), op).codigo;
const ts = (json, op) => L.generarTypeScript(L.parsear(json), op).codigo;

test("parsear: JSON válido, con decimales marcados", () => {
  const v = L.parsear('{"a": 1, "b": 1.0, "c": 2e3, "d": [true, null, "x\\n\\u00e9"], "e": {}}');
  assert.equal(v.a, 1);
  assert.ok(v.b instanceof Number && v.b.decimal);
  assert.ok(v.c instanceof Number);
  assert.deepEqual(v.d, [true, null, "x\né"]);
  assert.deepEqual(v.e, {});
  assert.equal(L.parsear("  42 "), 42);
  assert.equal(L.parsear('"hola"'), "hola");
});

test("parsear: errores con línea y columna y mensajes útiles", () => {
  const err = (t) => { try { L.parsear(t); } catch (e) { return e; } throw new Error("no falló: " + t); };
  let e = err('{\n  "a": 1,\n  "b": tru\n}');
  assert.equal(e.linea, 3); assert.equal(e.columna, 8);
  e = err('{"a": 1,}');
  assert.match(e.message, /Sobra una coma/);
  e = err("{a: 1}");
  assert.match(e.message, /claves van entre comillas/);
  e = err("{'a': 1}");
  assert.match(e.message, /comillas dobles, no simples/);
  e = err('{"a": 1');
  assert.match(e.message, /Falta cerrar el objeto/);
  e = err('[1, 2');
  assert.match(e.message, /Falta cerrar la lista/);
  e = err('{"a": "sin cerrar}');
  assert.match(e.message, /Cadena sin cerrar/);
  e = err('{"a": 1} x');
  assert.match(e.message, /Sobra texto/);
  e = err("");
  assert.match(e.message, /antes de tiempo/);
  assert.ok(e instanceof L.ErrorJson);
});

test("inferir: escalares, fechas, guid, enteros grandes", () => {
  assert.equal(L.inferir(5).k, "int");
  assert.equal(L.inferir(3000000000).k, "long");
  assert.equal(L.inferir(1e20).k, "double");
  assert.equal(L.inferir(2.5).k, "double");
  assert.equal(L.inferir(true).k, "bool");
  assert.equal(L.inferir(null).k, "null");
  assert.deepEqual(L.inferir("2026-10-09T14:30:00Z"), { k: "string", f: "datetime" });
  assert.deepEqual(L.inferir("2026-10-09 14:30"), { k: "string", f: "datetime" });
  assert.deepEqual(L.inferir("2026-10-09"), { k: "string", f: "date" });
  assert.deepEqual(L.inferir("b7e4c1a2-5f3d-4e8a-9c21-7d1f0a6b3e55"), { k: "string", f: "guid" });
  assert.deepEqual(L.inferir("hola"), { k: "string" });
  assert.deepEqual(L.inferir([]), { k: "array", de: { k: "vacio" } });
});

test("unificar: nulos, números, formatos de string y propiedades faltantes", () => {
  const u = (a, b) => L.unificar(L.inferir(a), L.inferir(b));
  assert.deepEqual(u(1, null), { k: "int", nulo: true });
  assert.deepEqual(u(null, "x"), { k: "string", nulo: true });
  assert.equal(u(1, 2.5).k, "double");
  assert.equal(u(1, 3000000000).k, "long");
  assert.equal(u(1, "x").k, "any");
  assert.deepEqual(u("2026-01-01", "hola"), { k: "string" });
  assert.deepEqual(u("2026-01-01", "2027-02-02"), { k: "string", f: "date" });
  const o = u({ a: 1, b: "x" }, { a: 2, c: true });
  assert.deepEqual(o.props.map((p) => p.clave), ["a", "b", "c"]);
  assert.deepEqual(o.props[1].tipo, { k: "string", nulo: true, opcional: true });
  assert.deepEqual(o.props[2].tipo, { k: "bool", nulo: true, opcional: true });
  assert.deepEqual(u([], [1]), { k: "array", de: { k: "int" } });
  assert.deepEqual(u([1], [null]), { k: "array", de: { k: "int", nulo: true } });
});

test("nombres: PascalCase, camelCase y singular", () => {
  assert.equal(L.pascal("fecha_entrega"), "FechaEntrega");
  assert.equal(L.pascal("razonSocial"), "RazonSocial");
  assert.equal(L.pascal("userID"), "UserId");
  assert.equal(L.pascal("HTMLParser"), "HtmlParser");
  assert.equal(L.pascal("ID"), "Id");
  assert.equal(L.pascal("año-fiscal"), "AñoFiscal");
  assert.equal(L.pascal("2fa"), "_2fa");
  assert.equal(L.pascal("precio unitario ($)"), "PrecioUnitario");
  assert.equal(L.pascal(""), "Campo");
  assert.equal(L.camel("fecha_entrega"), "fechaEntrega");
  for (const [plural, sing] of [["items", "item"], ["clientes", "cliente"], ["direcciones", "direccion"],
    ["categories", "category"], ["paises", "pais"], ["meses", "mes"], ["addresses", "address"],
    ["status", "status"], ["data", "data"], ["boxes", "box"], ["cuotas", "cuota"]]) {
    assert.equal(L.singular(plural), sing, plural);
  }
});

test("C#: clase básica con atributos solo cuando difiere el nombre", () => {
  const salida = cs('{"id": 1, "Nombre": "x", "fecha_alta": "2026-10-09", "activo": true, "saldo": 10.5}', { nombreRaiz: "cliente" });
  assert.match(salida, /^using System;\nusing System.Text.Json.Serialization;\n\npublic class Cliente\n\{/);
  assert.match(salida, /\[JsonPropertyName\("id"\)\]\n    public int Id \{ get; set; \}/);
  assert.match(salida, /\n    public required string Nombre \{ get; set; \}/);
  assert.ok(!salida.includes('JsonPropertyName("Nombre")'), "sin atributo cuando coincide");
  assert.match(salida, /public DateTime FechaAlta/);
  assert.match(salida, /public bool Activo/);
  assert.match(salida, /public double Saldo/);
  assert.ok(!salida.includes("System.Collections.Generic"), "no mete usings que no usa");
});

test("C#: anidados, listas, clases compartidas por forma y nombres únicos", () => {
  const salida = cs('{"cliente": {"id": 1}, "proveedor": {"id": 2}, "items": [{"sku": "a"}], "item": {"nombre": "x"}, "matriz": [[{"x": 1}]]}');
  assert.match(salida, /public required Cliente Cliente/);
  assert.match(salida, /public required Cliente Proveedor/, "misma forma, misma clase");
  assert.match(salida, /public required List<Item> Items/);
  assert.match(salida, /public required Item2 Item/, "distinta forma, otro nombre");
  assert.match(salida, /public required List<List<Matriz>> Matriz/);
  assert.match(salida, /public class Matriz\n\{\n    \[JsonPropertyName\("x"\)\]\n    public int X/);
  assert.equal((salida.match(/public class /g) || []).length, 5);
});

test("C#: opciones de estilo, atributos, colección, decimales, NRT y required", () => {
  const json = '{"nombre": "x", "lista": [1], "precio": 1.5, "nota": null, "fecha": "2026-01-01"}';
  const rec = cs(json, { estilo: "record", atributos: "newtonsoft", coleccion: "array", decimales: "decimal", nombreRaiz: "Cosa" });
  assert.match(rec, /^using Newtonsoft.Json;\nusing System;\n\npublic record Cosa\(\n/);
  assert.match(rec, /    \[property: JsonProperty\("nombre"\)\] string Nombre,\n/);
  assert.match(rec, /int\[\] Lista,/);
  assert.match(rec, /decimal Precio,/);
  assert.match(rec, /object\? Nota,/);
  assert.match(rec, /DateTime Fecha\n\);\n$/);

  const init = cs(json, { estilo: "init", atributos: "ninguno", nrt: false, fechas: false });
  assert.ok(!init.includes("Json"), "sin usings de JSON ni atributos");
  assert.match(init, /public string Nombre \{ get; init; \}/);
  assert.match(init, /public object Nota \{ get; init; \}/, "sin NRT no hay ? en referencias");
  assert.match(init, /public string Fecha/);
  assert.ok(!init.includes("required"));

  const sinReq = cs(json, { required: false });
  assert.match(sinReq, /public string Nombre \{ get; set; \}/);
  assert.match(sinReq, /CS8618/);

  const siempre = cs('{"Nombre": "x"}', { atributosSiempre: true });
  assert.match(siempre, /\[JsonPropertyName\("Nombre"\)\]/);

  const ro = cs('{"xs": [true]}', { coleccion: "IReadOnlyList" });
  assert.match(ro, /IReadOnlyList<bool> Xs/);
});

test("C#: nullable en valores, listas de nulos, any y propiedades opcionales", () => {
  const salida = cs('[{"a": 1, "b": "x", "c": [1, null], "d": 1}, {"a": null, "b": 2, "c": [2], "e": true}]', { nombreRaiz: "Fila" });
  assert.match(salida, /El JSON de raíz es List<Fila>/);
  assert.match(salida, /public int\? A/);
  assert.match(salida, /public JsonElement B/, "int + string = JsonElement con STJ");
  assert.match(salida, /public required List<int\?> C/);
  assert.match(salida, /public int\? D/, "falta en una fila: anulable");
  assert.match(salida, /public bool\? E/);
  assert.match(salida, /using System.Text.Json;/);
  const nt = cs('[{"b": "x"}, {"b": 2}]', { atributos: "newtonsoft" });
  assert.match(nt, /public required JToken B/);
  assert.match(nt, /JsonConvert.DeserializeObject<List<Root>>/);
  assert.match(nt, /using Newtonsoft.Json.Linq;/);
  const ni = cs('[{"b": "x"}, {"b": 2}]', { atributos: "ninguno" });
  assert.match(ni, /public required object B/);
});

test("C#: diccionarios por claves numéricas o fechas, y raíces que no son objetos", () => {
  const dic = cs('{"totales": {"2026-01": 1.5, "2026-02": 2.0}, "porId": {"1": {"n": "a"}, "2": {"n": "b"}}}');
  assert.match(dic, /Dictionary<string, double> Totales/);
  assert.match(dic, /Dictionary<string, PorId> PorId/);
  assert.match(dic, /public class PorId/);
  assert.equal((dic.match(/public class /g) || []).length, 2);

  const lista = cs("[1, 2, 3]");
  assert.match(lista, /El JSON de raíz es List<int>, no una clase/);
  assert.ok(!lista.includes("public class"));
  const vacio = cs("{}");
  assert.match(vacio, /public class Root\n\{\n\}/);
  const raizDic = cs('{"2026-01": {"a": 1}}');
  assert.match(raizDic, /public class Root/, "un solo par no es diccionario");
  const raizDic2 = cs('{"2026-01": {"a": 1}, "2026-02": {"a": 2}}', { nombreRaiz: "Mes" });
  assert.match(raizDic2, /El JSON de raíz es Dictionary<string, Mes>/);
  assert.match(raizDic2, /public class Mes/);
});

test("C#: namespace, nombres chocados con la clase y claves raras", () => {
  const salida = cs('{"pedido": "x", "user_id": 1, "userId": 2, "class": "a", "3d": true}', { nombreRaiz: "Pedido", espacio: " Mi.App.Dtos " });
  assert.match(salida, /\nnamespace Mi.App.Dtos;\n\n/);
  assert.match(salida, /public required string PedidoValue/, "no puede llamarse igual que la clase");
  assert.match(salida, /public int UserId \{/);
  assert.match(salida, /public int UserId2 \{/);
  assert.match(salida, /public required string Class \{/);
  assert.match(salida, /public bool _3d \{/);
});

test("TypeScript: interfaces con claves originales, opcionales y uniones", () => {
  const salida = ts('[{"id": 1, "razon social": "x", "tags": ["a"], "sub": {"ok": true}, "mapa": {"1": 1, "2": 2}}, {"id": null, "razon social": "y", "tags": [null], "sub": {"ok": false}, "mapa": {"3": 3}, "extra": 1}]', { nombreRaiz: "Cliente" });
  assert.match(salida, /export interface Cliente \{\n  id: number \| null;\n  "razon social": string;\n  tags: \(string \| null\)\[\];\n  sub: Sub;\n  mapa: Record<string, number>;\n  extra\?: number \| null;\n\}/);
  assert.match(salida, /export interface Sub \{\n  ok: boolean;\n\}/);
  assert.match(salida, /export type ClienteJson = Cliente\[\];/);
  assert.match(ts('{"a": [1, "x"]}'), /a: unknown\[\];/);
  assert.match(ts("42"), /export type RootJson = number;/);
});

test("formatear y ejemplo", () => {
  assert.equal(L.formatear('{"a":[1,2.50,{"b":null}]}'), '{\n  "a": [\n    1,\n    2.5,\n    {\n      "b": null\n    }\n  ]\n}');
  const r = L.generarCSharp(L.parsear(L.EJEMPLO), { nombreRaiz: "Pedido" });
  assert.equal(r.clases, 4);
  assert.ok(r.propiedades >= 20);
  assert.match(r.codigo, /Dictionary<string, double> TotalesPorMes/);
  assert.match(r.codigo, /public Guid Id/);
});
