/* Tests del simulador. Correr desde la raíz del repo:
     node --test experimentos/guid-vs-identity/tests/*.test.js */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../logica.js");

test("el azar es reproducible y uniforme a ojo", () => {
  const a = I.prng(42), b = I.prng(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(xs.slice(0, 10), Array.from({ length: 10 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const media = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(media - 0.5) < 0.05, "media " + media);
});

test("capacidades de página", () => {
  assert.equal(I.capacidadHoja(4, 100), Math.floor((8192 - 96) / 114));
  assert.equal(I.capacidadHoja(16, 100), Math.floor((8192 - 96) / 126));
  assert.ok(I.capacidadHoja(16, 100) < I.capacidadHoja(4, 100));
  assert.equal(I.capacidadHoja(16, 100000), 2);
  assert.equal(I.capacidadInterna(16), Math.floor((8192 - 96) / 24));
});

test("generadores: formato, tamaño y orden", () => {
  const id = I.GENERADORES.identity.crear(1);
  assert.equal(id(), "00000001"); assert.equal(id(), "00000002");
  const v4 = I.GENERADORES["guid-aleatorio"].crear(5);
  const g = v4();
  assert.match(g, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(g, v4());
  const v7 = I.GENERADORES["guid-v7"].crear(5, { insercionesPorMs: 1 });
  const g1 = v7(), g2 = v7();
  assert.match(g1, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(g1 < g2, "con una inserción por ms, v7 es monótono");
  const sec = I.GENERADORES["guid-secuencial"].crear();
  const s1 = sec(), s2 = sec();
  assert.ok(s1 < s2);
  assert.match(s1, /^0{8}-0{4}-0{4}-0{4}-0{11}1$/);
  // Dentro de un mismo milisegundo, v7 no está ordenado (como en .NET).
  const v7b = I.GENERADORES["guid-v7"].crear(9, { insercionesPorMs: 1000 });
  const lote = Array.from({ length: 200 }, () => v7b());
  assert.ok(lote.some((x, i) => i > 0 && x < lote[i - 1]), "hay desorden dentro del ms");
  assert.equal(new Set(lote.map((x) => x.slice(0, 13))).size, 1, "mismo prefijo de tiempo");
});

test("B+tree: orden, búsqueda, conteo y encadenado de hojas", () => {
  const arbol = I.crearArbol({ capacidadHoja: 4, capacidadInterna: 3, division: "mitad" });
  const r = I.prng(3);
  const claves = new Set();
  for (let i = 0; i < 2000; i++) claves.add(String(Math.floor(r() * 100000)).padStart(6, "0"));
  for (const k of claves) assert.ok(arbol.insertar(k));
  assert.ok(!arbol.insertar([...claves][0]), "repetida no entra");
  const hojas = arbol.hojas();
  const todas = hojas.flatMap((h) => h.claves);
  assert.equal(todas.length, claves.size);
  for (let i = 1; i < todas.length; i++) assert.ok(todas[i - 1] < todas[i], "hojas en orden");
  for (const h of hojas) assert.ok(h.claves.length >= 1 && h.claves.length <= 4);
  for (const k of claves) assert.ok(arbol.buscar(k));
  assert.ok(!arbol.buscar("zzz"));
  const m = arbol.medir();
  assert.equal(m.claves, claves.size);
  assert.equal(m.hojas, hojas.length);
  assert.ok(m.altura >= 3);
  assert.ok(m.llenado > 0.5 && m.llenado < 0.85, "llenado " + m.llenado);
});

test("claves secuenciales: SQL Server llena las páginas, PostgreSQL al 90 %, de libro al 50 %", () => {
  const fin = I.correr({ tipo: "identity", n: 20000, bytesCarga: 100, division: "fin" });
  const derecha = I.correr({ tipo: "identity", n: 20000, bytesCarga: 100, division: "derecha" });
  const mitad = I.correr({ tipo: "identity", n: 20000, bytesCarga: 100, division: "mitad" });
  assert.ok(fin.llenado > 0.98, "fin " + fin.llenado);
  assert.ok(derecha.llenado > 0.87 && derecha.llenado < 0.92, "derecha " + derecha.llenado);
  assert.ok(mitad.llenado > 0.49 && mitad.llenado < 0.52, "mitad " + mitad.llenado);
  assert.ok(fin.fragmentacion < 0.02, "sin fragmentación");
  assert.ok(fin.hojasCalientes <= 20, "pocas páginas calientes: " + fin.hojasCalientes);
  assert.equal(fin.repetidas, 0);
  assert.equal(fin.claves, 20000);
  assert.equal(fin.serie.at(-1).i, 20000);
});

test("GUID aleatorio: llenado ≈ ln 2, fragmentación casi total, todas las páginas calientes", () => {
  const r = I.correr({ tipo: "guid-aleatorio", n: 50000, bytesCarga: 100, division: "fin", semilla: 11 });
  assert.ok(r.llenado > 0.66 && r.llenado < 0.72, "llenado " + r.llenado);
  assert.ok(r.fragmentacion > 0.95, "fragmentación " + r.fragmentacion);
  assert.ok(r.hojasCalientes > r.hojas * 0.5, "calientes " + r.hojasCalientes + " de " + r.hojas);
  assert.equal(r.repetidas, 0);
  const otra = I.correr({ tipo: "guid-aleatorio", n: 50000, bytesCarga: 100, division: "fin", semilla: 11 });
  assert.equal(otra.hojas, r.hojas, "misma semilla, mismo resultado");
});

test("GUID v7: perfecto a una inserción por ms, se degrada con varias; el secuencial estricto es como identity", () => {
  const id = I.correr({ tipo: "identity", n: 30000, bytesCarga: 100 });
  const v7lento = I.correr({ tipo: "guid-v7", n: 30000, bytesCarga: 100, insercionesPorMs: 1 });
  const v7rapido = I.correr({ tipo: "guid-v7", n: 30000, bytesCarga: 100, insercionesPorMs: 10 });
  const sec = I.correr({ tipo: "guid-secuencial", n: 30000, bytesCarga: 100 });
  assert.ok(sec.llenado > 0.98, "secuencial " + sec.llenado);
  assert.ok(v7lento.llenado > 0.98, "v7 lento " + v7lento.llenado);
  assert.ok(v7lento.fragmentacion < 0.02, "v7 lento frag " + v7lento.fragmentacion);
  assert.ok(v7rapido.llenado > 0.45 && v7rapido.llenado < 0.75, "v7 rápido " + v7rapido.llenado);
  assert.ok(v7rapido.fragmentacion > 0.3, "v7 rápido frag " + v7rapido.fragmentacion);
  assert.ok(v7rapido.hojasCalientes < 40, "v7 calientes " + v7rapido.hojasCalientes);
  // En PostgreSQL (división a la derecha) el v7 rápido no se fragmenta.
  const v7pg = I.correr({ tipo: "guid-v7", n: 30000, bytesCarga: 100, insercionesPorMs: 10, division: "derecha" });
  assert.ok(v7pg.fragmentacion < 0.05, "v7 en pg frag " + v7pg.fragmentacion);
  assert.ok(sec.hojas > id.hojas, "la clave de 16 bytes ocupa más páginas que la de 4");
  assert.equal(sec.bytesClave, 16);
  assert.equal(id.bytesClave, 4);
});

test("correr por pasos da el mismo resultado que correr de una", () => {
  const directo = I.correr({ tipo: "guid-aleatorio", n: 12000, bytesCarga: 50, semilla: 2 });
  const it = I.correrPorPasos({ tipo: "guid-aleatorio", n: 12000, bytesCarga: 50, semilla: 2 }, 1000);
  let pasos = 0, r;
  for (;;) { const { value, done } = it.next(); if (done) { r = value; break; } pasos++; assert.equal(value.total, 12000); }
  assert.equal(pasos, 11);
  assert.equal(r.hojas, directo.hojas);
  assert.equal(r.llenado, directo.llenado);
  assert.equal(r.serie.length, directo.serie.length);
});

test("tipo desconocido y formato", () => {
  assert.throws(() => I.correr({ tipo: "lo-que-sea", n: 10 }));
  assert.equal(I.fmtEntero(1234567), "1.234.567");
  assert.equal(I.fmtBytes(500), "500 B");
  assert.equal(I.fmtBytes(8192 * 100), "800 KB");
  assert.equal(I.fmtBytes(8192 * 5000), "39,1 MB");
  assert.equal(I.fmtBytes(3 * 1024 ** 3), "3,00 GB");
  assert.equal(I.fmtPorcentaje(0.6931, 1), "69,3 %");
});
