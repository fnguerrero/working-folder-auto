/* Tests de Regex en criollo.   node --test herramientas/regex-en-criollo/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const R = require("../logica.js");
const P = (p, o) => R.parsear(p, o || {});
const texto = (p, o) => R.explicar(P(p, o));
const plano = (n) => n.texto + (n.hijos.length ? " { " + n.hijos.map(plano).join(" ; ") + " }" : "");

test("parsea literales, clases, cuantificadores y alternativas con la numeración de .NET (sin nombre primero, con nombre después)", () => {
  const p = P("(a)(?<n>b)(c)(?'m'd)");
  assert.deepEqual(p.grupos.map((g) => [g.numero, g.nombre]), [[1, null], [2, null], [3, "n"], [4, "m"]]);
  const q = P("(?<x>a)(?<x>b)(c)");
  assert.deepEqual(q.grupos.map((g) => [g.numero, g.nombre]), [[1, null], [2, "x"]]);
  const r = P("(a)(b)", { explicitCapture: true });
  assert.equal(r.grupos.length, 0);
});

test("errores con posición: paréntesis, cuantificadores sueltos, rangos al revés, escapes raros, referencias", () => {
  for (const [pat, msg] of [["(a", /falta cerrar el grupo/], ["a)", /de más/], ["*a", /no tiene nada adelante/], ["a**", /dos cuantificadores/], ["[z-a]", /al revés/], ["\\q", /no es un escape/], ["a{3,2}", /máximo menor/], ["[abc", /falta cerrar la clase/], ["(?", /no entiendo/], ["^*", /no se puede repetir una ancla/]]) {
    assert.throws(() => P(pat), (e) => e instanceof R.ErrorRegex && msg.test(e.message) && typeof e.pos === "number", pat);
  }
  assert.doesNotThrow(() => P("a{,3}"), "una llave que no es cuantificador es literal");
  assert.equal(P("a{,3}").ast.items.length, 5);
});

test("explica en castellano", () => {
  assert.match(plano(texto("\\d{2}/\\d{2}")), /exactamente 2 veces.*un dígito/);
  assert.match(plano(texto("(?<anio>\\d{4})")), /grupo «anio» \(número 1\): captura/);
  assert.match(plano(texto("[^a-z0-9_]")), /que NO sea ninguno de: de «a» a «z», de «0» a «9», «_»/);
  assert.match(plano(texto("hola|chau")), /alternativas.*el texto «hola».*el texto «chau»/);
  assert.match(plano(texto("a+?")), /una o más veces, lo menos posible \(vago\)/);
  assert.match(plano(texto("(?=x)(?<!y)(?>z)")), /seguido de.*NO precedido de.*atómico/);
  assert.match(plano(texto("^a$", { multiline: true })), /inicio de una línea.*fin de una línea/);
  assert.match(plano(texto(".", { singleline: true })), /también el salto de línea/);
  assert.match(plano(texto("(?i)x(?s:.)")), /de acá en más, ignorar mayúsculas.*con opciones Singleline/);
  assert.match(plano(texto("(a)\\1")), /lo mismo que capturó el grupo 1/);
  assert.match(plano(texto("\\p{Lu}\\P{L}")), /una letra mayúscula.*cualquier cosa que no sea una letra/);
  assert.match(plano(texto("[a-z-[aeiou]]")), /menos los de: «a», «e»/);
  assert.match(plano(texto("(?(1)a|b)")), /si el grupo 1 capturó algo.*entonces.*si no/);
  assert.match(plano(texto("(?# un comentario )x")), /^el carácter «x»$/);
  assert.match(plano(texto(" a  b # comentario\n c", { ignoreWhitespace: true })), /^el texto «abc»$/);
});

test("prueba contra un texto con la numeración y los nombres de .NET, aunque JavaScript numere distinto", () => {
  const p = P("(?<anio>\\d{4})-(\\d{2})");
  const r = R.probar(p, "Fechas: 2026-10 y 1999-12.");
  assert.equal(r.error, null); assert.equal(r.matches.length, 2);
  assert.equal(r.matches[0].valor, "2026-10"); assert.equal(r.matches[0].indice, 8);
  assert.deepEqual(r.matches[0].grupos.map((g) => [g.numero, g.nombre, g.valor]), [[1, null, "10"], [2, "anio", "2026"]]);
  assert.equal(r.matches[0].grupos[1].indice, 8);
});

test("semántica de .NET al probar: $ antes del salto final, \\z no, \\d Unicode, ECMAScript solo ASCII, punto sin salto, Singleline", () => {
  assert.equal(R.probar(P("^\\d+$"), "123\n").matches.length, 1);
  assert.equal(R.probar(P("^\\d+\\z"), "123\n").matches.length, 0);
  assert.equal(R.probar(P("\\A\\d+\\z"), "123").matches.length, 1);
  assert.equal(R.probar(P("\\d"), "٣").matches.length, 1);
  assert.equal(R.probar(P("\\d", { ecmaScript: true }), "٣").matches.length, 0);
  assert.equal(R.probar(P("a.b"), "a\nb").matches.length, 0);
  assert.equal(R.probar(P("a.b", { singleline: true }), "a\nb").matches.length, 1);
  assert.equal(R.probar(P("^b", { multiline: true }), "a\nb").matches.length, 1);
  assert.equal(R.probar(P("^b"), "a\nb").matches.length, 0);
  assert.equal(R.probar(P("\\bñandú\\b"), "el ñandú corre").matches.length, 1, "\\b entiende letras con tilde");
  assert.equal(R.probar(P("[^@\\s]+@[^@\\s]+"), "nico@ejemplo.com").matches[0].valor, "nico@ejemplo.com");
  assert.equal(R.probar(P("A", { ignoreCase: true }), "a").matches.length, 1);
  assert.equal(R.probar(P("(?i)a"), "A").matches.length, 1);
  assert.equal(R.probar(P("[a-z-[aeiou]]+"), "murcielago").matches[0].valor, "m");
  assert.equal(R.probar(P("x*"), "aaa").matches.length, 4, "matches vacíos avanzan");
});

test("grupo atómico: se traduce con un grupo oculto y la numeración de .NET se mantiene", () => {
  const p = P("(?>a+)(b)");
  const r = R.probar(p, "aab");
  assert.equal(r.matches.length, 1); assert.deepEqual(r.matches[0].grupos.map((g) => [g.numero, g.valor]), [[1, "b"]]);
  assert.equal(R.probar(P("(?>a+)a"), "aaaa").matches.length, 0, "atómico no devuelve");
  assert.equal(R.probar(P("(?:a+)a"), "aaaa").matches.length, 1);
});

test("lo que no se puede probar en JavaScript se dice: balanceo, condicionales, \\G", () => {
  for (const pat of ["(?<a-b>x)", "(?(1)a|b)", "\\Gx"]) { const r = R.probar(P(pat), "x"); assert.equal(r.matches.length, 0); assert.ok(r.problemas.some((q) => q.nivel === "no"), pat); }
});

test("avisos: anclas, $, \\d, punto, [A-z], backtracking, alternativa vacía, referencia inexistente, mail, punto sin escapar", () => {
  const t = (pat, o) => R.avisos(P(pat, o), pat).map((a) => a.titulo);
  assert.ok(t("\\d+").some((x) => /No está anclada/.test(x)));
  assert.ok(!t("^\\d+$").some((x) => /No está anclada/.test(x)));
  assert.ok(t("^\\d+$").some((x) => /\$ también matchea/.test(x)));
  assert.ok(!t("^\\d+$", { multiline: true }).some((x) => /\$ también matchea/.test(x)));
  assert.ok(t("\\d").some((x) => /\\d no es solo 0-9/.test(x)));
  assert.ok(!t("\\d", { ecmaScript: true }).some((x) => /\\d no es solo/.test(x)));
  assert.ok(t("a.b").some((x) => /punto no matchea/.test(x)));
  assert.ok(t("[A-z]").some((x) => /\[A-z\]/.test(x)));
  assert.ok(t("^(\\w+\\s?)*$").some((x) => /catastrófico/.test(x)));
  assert.ok(t("^(a|b)*$").every((x) => !/catastrófico/.test(x)));
  assert.ok(t("(a|)").some((x) => /alternativa vacía/.test(x)));
  assert.ok(t("(a)\\2").some((x) => /no existe/.test(x)));
  assert.ok(t("^a|b$").some((x) => /solo aplican a su rama/.test(x)));
  assert.ok(t("www.google.com").some((x) => /punto sin escapar/.test(x)));
  assert.ok(t("\\w+@\\w+\\.com").some((x) => /mail/.test(x)));
  assert.ok(t("(a)(b)(c)(d)").some((x) => /grupos sin nombre/.test(x)));
  assert.ok(t("\"(.*)\"").some((x) => /goloso en el medio/.test(x)));
  const a = R.avisos(P("^(\\w+\\s?)*$"), "");
  assert.equal(a[0].nivel, "mal", "los graves van primero");
});

test("snippet de C#: GeneratedRegex con opciones, grupos por nombre y versión clásica con timeout; comillas y saltos", () => {
  const p = P("(?<anio>\\d{4})-(\\d{2})", { ignoreCase: true, cultureInvariant: true });
  const s = R.snippetCs("(?<anio>\\d{4})-(\\d{2})", p, "Fecha");
  assert.match(s.generado, /\[GeneratedRegex\(@"\(\?<anio>\\d\{4\}\)-\(\\d\{2\}\)", RegexOptions\.IgnoreCase \| RegexOptions\.CultureInvariant\)\]/);
  assert.match(s.generado, /public static partial Regex Fecha\(\);/);
  assert.match(s.generado, /var grupo1 = m\.Groups\[1\]\.Value;/); assert.match(s.generado, /var anio = m\.Groups\["anio"\]\.Value;/);
  assert.match(s.clasico, /TimeSpan\.FromSeconds\(1\)/); assert.match(s.clasico, /RegexOptions\.Compiled/);
  assert.equal(R.literalCs("a\"b"), "@\"a\"\"b\"");
  assert.match(R.literalCs("a\nb"), /^"""\n/);
  assert.match(R.snippetCs("x", P("x")).generado, /IsMatch\(entrada\)/);
});

test("los ejemplos parsean, se prueban y matchean lo esperado", () => {
  for (const e of R.EJEMPLOS) {
    const p = P(e.patron, e.opciones || {}); const r = R.probar(p, e.texto);
    assert.equal(r.error, null, e.nombre);
    if (!/explota/.test(e.nombre)) assert.ok(r.matches.length >= 1, e.nombre + " matchea");
  }
  const cuit = R.probar(P(R.EJEMPLOS[0].patron, { multiline: true }), R.EJEMPLOS[0].texto);
  assert.equal(cuit.matches.length, 3); assert.equal(cuit.matches[1].grupos.find((g) => g.nombre === "dni").valor, "12345678");
  const fecha = R.probar(P(R.EJEMPLOS[2].patron), R.EJEMPLOS[2].texto);
  assert.deepEqual(fecha.matches.map((m) => m.valor), ["09/10/2026", "31/02/2026"]);
});
