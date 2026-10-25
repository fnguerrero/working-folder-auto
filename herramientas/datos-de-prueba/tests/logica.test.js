/* Tests de Datos de prueba argentinos.   node --test herramientas/datos-de-prueba/tests/logica.test.js */
"use strict";
const test = require("node:test"); const assert = require("node:assert/strict");
const D = require("../logica.js");

// CUIT públicos de organismos y empresas (figuran en sus facturas y en el padrón de ARCA).
const CUITS_CONOCIDOS = [
  ["33693450239", "ARCA (ex AFIP)"], ["30546689979", "YPF"], ["30500010912", "Banco de la Nación Argentina"], ["30703088534", "Mercado Libre"],
];
// CBU de ejemplo que circulan en la documentación de validadores, con sus dos bloques bien calculados.
const CBUS_CONOCIDOS = [["2850590940090418135201", "Banco Macro"], ["0110599520000001235579", "Banco de la Nación Argentina"], ["0170099220000067797370", "BBVA"]];

test("dígito de CUIT/CUIL contra casos conocidos", () => {
  for (const [c, quien] of CUITS_CONOCIDOS) {
    assert.equal(D.digitoCuit(c.slice(0, 10)), Number(c[10]), quien);
    assert.equal(D.validarCuit(c).valido, true, quien);
  }
  assert.equal(D.digitoCuit("2012345678"), 6); // el 20-12345678-6 de los manuales
  assert.equal(D.validarCuit("20-12345678-6").formateado, "20-12345678-6");
  assert.equal(D.validarCuit("33-69345023-9").clase, "persona jurídica (cuando con 30 el dígito daría 10)");
  // ARCA tiene 33 justamente porque con 30 el dígito da 10.
  assert.equal(D.digitoCuit("3069345023"), 10);
  assert.equal(D.cuitEmpresa("69345023"), "33693450239");
  assert.match(D.cuentaCuit("3369345023"), /= 145 → 145 mod 11 = 2 → 11 − 2 = 9$/);
});

test("CUIT inválidos: dígito que no cierra, largo, prefijo, resto 10", () => {
  const r = D.validarCuit("20-12345678-5");
  assert.equal(r.valido, false); assert.equal(r.esperado, 6); assert.equal(r.sugerido, "20-12345678-6"); assert.match(r.error, /tendría que ser 6, no 5/);
  assert.match(D.validarCuit("2012345678").error, /tiene 10/);
  const raro = "99123456780"; const d = D.digitoCuit(raro.slice(0, 10));
  const conPrefijoRaro = D.validarCuit(raro.slice(0, 10) + (d === 10 ? 0 : d));
  assert.equal(conPrefijoRaro.valido, false);
  const r10 = D.validarCuit("30693450230");
  assert.equal(r10.valido, false); assert.match(r10.error, /cambia el prefijo/); assert.equal(r10.sugerido, "33-69345023-9");
});

test("CUIL desde el DNI: 20 y 27, y el 23 cuando da 10 (sale 9 para varones y 4 para mujeres)", () => {
  assert.equal(D.cuilDesdeDni("12345678", "M"), "20123456786");
  assert.equal(D.cuilDesdeDni("12.345.678", "F"), "27123456780");
  assert.equal(D.cuilDesdeDni("7133353", "M"), "20071333532"); // DNI de 7 dígitos: se completa con 0
  let m = null, f = null;
  for (let n = 10000000; (!m || !f) && n < 10010000; n++) {
    const s = String(n);
    if (!m && D.digitoCuit("20" + s) === 10) m = s;
    if (!f && D.digitoCuit("27" + s) === 10) f = s;
  }
  assert.ok(m && f, "hay DNI con resto 10 en los dos sexos");
  assert.equal(D.cuilDesdeDni(m, "M"), `23${m}9`);
  assert.equal(D.cuilDesdeDni(f, "F"), `23${f}4`);
  assert.equal(D.validarCuit(`23${m}9`).valido, true);
  // Cuando con 30 da 10, con 33 siempre cierra (3×4 suma 12 más, que es 1 más en módulo 11): sale 9.
  for (let n = 50000000; n < 50020000; n++) if (D.digitoCuit("30" + n) === 10) assert.equal(D.cuitEmpresa(n), `33${n}9`);
});

test("CBU contra casos conocidos: los dos bloques y el banco", () => {
  for (const [c, banco] of CBUS_CONOCIDOS) {
    const r = D.validarCbu(c);
    assert.equal(r.valido, true, c); assert.equal(r.banco, banco, c);
    assert.equal(D.digitoCbuBloque1(c.slice(0, 7)), Number(c[7]));
    assert.equal(D.digitoCbuBloque2(c.slice(8, 21)), Number(c[21]));
    assert.equal(D.armarCbu(c.slice(0, 3), c.slice(3, 7), c.slice(8, 21)), c);
  }
  const r = D.validarCbu("2850590940090418135201");
  assert.equal(r.entidad, "285"); assert.equal(r.sucursal, "0590"); assert.equal(r.nroCuenta, "4009041813520");
  assert.match(r.cuenta1, /= 81 → 10 − 1 = 9$/); assert.match(r.cuenta2, /= 139 → 10 − 9 = 1$/);
  // Cuando la suma es múltiplo de 10 el dígito es 0, no 10.
  assert.equal(D.digitoCbuBloque1("0000000"), 0);
});

test("CBU inválidos: cada bloque por separado, largo y CVU", () => {
  const b2 = D.validarCbu("2850590940090418135202");
  assert.equal(b2.valido, false); assert.equal(b2.ok1, true); assert.equal(b2.ok2, false); assert.equal(b2.sugerido, "2850590940090418135201");
  const b1 = D.validarCbu("2850590840090418135201");
  assert.equal(b1.ok1, false); assert.equal(b1.esperado1, 9); assert.match(b1.error, /primer bloque/);
  assert.match(D.validarCbu("123").error, /tiene 3/);
  const cvu = D.armarCbu("000", "0003", "0001234567890"); assert.ok(cvu.startsWith("0000003100"));
  const rc = D.validarCbu(cvu); assert.equal(rc.valido, true); assert.equal(rc.esCvu, true); assert.equal(rc.banco, "CVU de Mercado Pago");
  assert.match(D.validarCbu(D.armarCbu("000", "0099", "0000000000001")).banco, /billetera virtual/);
  assert.equal(D.validarCbu(D.armarCbu("998", "0001", "0000000000001")).banco, null);
});

test("patentes, alias y DNI; el detector de qué se pegó", () => {
  assert.deepEqual(D.validarPatente("ab123cd"), { valido: true, patente: "AB123CD", formateada: "AB 123 CD", formato: "Mercosur de auto (desde 2016)" });
  assert.equal(D.validarPatente("ABC-123").formateada, "ABC 123");
  assert.match(D.validarPatente("A 123 BCD").formato, /moto/); assert.match(D.validarPatente("123ABC").formato, /vieja de moto/);
  assert.equal(D.validarPatente("AB12CD").valido, false);
  assert.equal(D.validarAlias("mate.nube.tango").valido, true);
  assert.match(D.validarAlias("corto").error, /entre 6 y 20/); assert.match(D.validarAlias("piñón.azul").error, /sobra «ñ»/);
  const dni = D.validarDni("12.345.678");
  assert.equal(dni.cuilM, "20-12345678-6"); assert.equal(dni.cuilF, "27-12345678-0"); assert.equal(dni.formateado, "12.345.678");
  assert.ok(dni.anio >= 1958 && dni.anio <= 1962, `un DNI de 12 millones es de cerca de 1960 (${dni.anio})`);
  const tipos = (x) => D.analizar(x).tipo;
  assert.equal(tipos(""), "vacio"); assert.equal(tipos("20-12345678-6"), "cuit"); assert.equal(tipos("0110 5995 2000 0001 2355 79"), "cbu");
  assert.equal(tipos("12345678"), "dni"); assert.equal(tipos("1234567"), "dni"); assert.equal(tipos("AE 123 KF"), "patente");
  assert.equal(tipos("hola.que.tal"), "alias"); assert.equal(tipos("12345"), "desconocido");
  const pat = D.analizar("AB12CD3"); assert.equal(pat.tipo, "patente"); assert.equal(pat.valido, false); assert.match(pat.error, /No es una patente/);
});

test("generar: todo lo que sale cierra (CUIL, CBU, DNI, patente, alias, mail, teléfono)", () => {
  const ps = D.generar({ cantidad: 2000, semilla: "prueba" });
  assert.equal(ps.length, 2000);
  for (const p of ps) {
    assert.equal(D.validarCuit(p.cuil).valido, true, p.cuil);
    assert.equal(p.cuil.slice(2, 10), p.dni.padStart(8, "0"), "el CUIL lleva el DNI");
    assert.ok(/^2[037]$/.test(p.cuil.slice(0, 2)) && (p.cuil.startsWith("23") || p.cuil.startsWith(p.sexo === "F" ? "27" : "20")), p.cuil);
    const cbu = D.validarCbu(p.cbu); assert.equal(cbu.valido, true, p.cbu); assert.equal(cbu.banco, p.banco);
    assert.equal(D.validarAlias(p.alias).valido, true, p.alias);
    assert.equal(D.validarPatente(p.patente).valido, true, p.patente);
    assert.match(p.email, /^[a-z0-9._]+@example\.(com|net|org)$/);
    assert.match(p.telefono, /^\+54 9 \d{2,4} \d{2,4}-\d{4}$/); assert.equal(p.telefono.replace(/\D/g, "").length, 13, p.telefono);
    assert.match(p.fechaNacimiento, /^(19[4-9]\d|200[0-6])-\d\d-\d\d$/);
    assert.ok(!Number.isNaN(Date.parse(p.fechaNacimiento + "T00:00:00Z")), p.fechaNacimiento);
    assert.ok(Number(p.dni) >= 1e6 && Number(p.dni) < 6e7, p.dni);
    assert.equal(p.piso === null, p.depto === null);
    assert.match(p.codigoPostal, /^\d{4}$/);
  }
  for (const k of ["dni", "cuil", "cbu", "alias", "email"]) assert.equal(new Set(ps.map((p) => p[k])).size, ps.length, `${k} no se repite`);
  // El DNI sigue el año: los nacidos antes de 1960 tienen DNI más bajos que los nacidos después de 1995.
  const viejos = ps.filter((p) => p.fechaNacimiento < "1960"), jovenes = ps.filter((p) => p.fechaNacimiento >= "1995");
  assert.ok(Math.max(...viejos.map((p) => +p.dni)) < Math.min(...jovenes.map((p) => +p.dni)));
  assert.ok(ps.some((p) => p.cuil.startsWith("23")), "en 2000 aparece algún 23");
  assert.ok(new Set(ps.map((p) => p.provincia)).size >= 20, "salen casi todas las provincias");

  const es = D.generar({ tipo: "empresa", cantidad: 1000, semilla: "prueba" });
  for (const e of es) {
    assert.equal(D.validarCuit(e.cuit).valido, true, e.cuit); assert.match(e.cuit, /^3[034]/);
    assert.equal(D.validarCbu(e.cbu).valido, true);
    assert.match(e.razonSocial, / (S\.A\.|S\.R\.L\.|S\.A\.S\.)$/);
    assert.match(e.email, /^[a-z]+\d*@[a-z0-9]+\.example$/);
    assert.match(e.telefono, /^\+54 \d{2,4} 4\d{1,3}-\d{4}$/);
  }
  assert.equal(new Set(es.map((e) => e.cuit)).size, es.length);
});

test("semilla: reproducible, el registro n no depende de la cantidad ni de las opciones", () => {
  const a = D.generar({ cantidad: 50, semilla: "mate" }), b = D.generar({ cantidad: 50, semilla: "mate" });
  assert.deepEqual(a, b);
  assert.deepEqual(D.generar({ cantidad: 10, semilla: "mate" }), a.slice(0, 10));
  assert.notDeepEqual(D.generar({ cantidad: 10, semilla: "otra" }), a.slice(0, 10));
  const mer = D.generar({ cantidad: 50, semilla: "mate", patentes: "mercosur" }), vie = D.generar({ cantidad: 50, semilla: "mate", patentes: "vieja" });
  assert.ok(mer.every((p) => /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(p.patente))); assert.ok(vie.every((p) => /^[A-Z]{3}\d{3}$/.test(p.patente)));
  const sinPat = (r) => r.map(({ patente, ...x }) => x);
  assert.deepEqual(sinPat(mer), sinPat(a)); assert.deepEqual(sinPat(vie), sinPat(a));
  const sep = D.generar({ cantidad: 50, semilla: "mate", separadores: true });
  sep.forEach((p, i) => {
    assert.equal(p.cuil, D.formatearCuit(a[i].cuil)); assert.equal(p.dni, D.formatearDni(a[i].dni)); assert.equal(p.cbu, a[i].cbu);
    assert.equal(p.patente, D.validarPatente(a[i].patente).formateada);
  });
  // Fijado: si esto cambia, cambian los datos de todos los que ya usan una semilla.
  assert.deepEqual(a[0], {
    id: 1, nombre: "Norberto", apellido: "Barrios", sexo: "M", dni: "7133353", cuil: "20071333532", fechaNacimiento: "1952-01-26",
    email: "norbertobarrios52@example.net", telefono: a[0].telefono, calle: "Maipú", numero: 2673, piso: "13", depto: "C",
    localidad: "Avellaneda", provincia: "Buenos Aires", codigoPostal: "1870", condicionIva: "Consumidor final",
    banco: "Banco Hipotecario", cbu: "0440758600892745994328", alias: "mesa.basto.vicuna", patente: "AG044CF",
  });
  assert.equal(D.generar({ cantidad: 0 }).length, 0); assert.equal(D.generar({ cantidad: 99999 }).length, D.MAX_REGISTROS);
});

test("exportar a JSON y CSV: nulos, comillas, separador", () => {
  const regs = [{ id: 1, nombre: 'Juan "el Toto"', piso: null, calle: "Av. Mitre; 2", numero: 10 }, { id: 2, nombre: "Ana, María", piso: "PB", calle: " Colón", numero: 5 }];
  const j = JSON.parse(D.aJson(regs, ["id", "nombre", "piso"]));
  assert.deepEqual(j[0], { id: 1, nombre: 'Juan "el Toto"', piso: null }); assert.deepEqual(Object.keys(j[1]), ["id", "nombre", "piso"]);
  assert.equal(D.aCsv(regs, ["id", "nombre", "piso", "calle"], ","), 'id,nombre,piso,calle\r\n1,"Juan ""el Toto""",,Av. Mitre; 2\r\n2,"Ana, María",PB," Colón"\r\n');
  assert.equal(D.aCsv(regs, ["nombre", "calle"], ";"), 'nombre;calle\r\n"Juan ""el Toto""";"Av. Mitre; 2"\r\nAna, María;" Colón"\r\n');
  assert.equal(D.exportar("csv", regs, ["id"], { separador: "\t" }), "id\r\n1\r\n2\r\n");
});

test("exportar a SQL: SQL Server con N'' y tandas de 1000, PostgreSQL en snake_case", () => {
  const regs = D.generar({ cantidad: 2500, semilla: "sql" });
  regs[0].apellido = "O'Brien";
  const s = D.aSql(regs, ["id", "apellido", "fechaNacimiento", "numero", "piso"], { tipo: "persona" });
  assert.match(s, /^CREATE TABLE \[Personas\] \(\n {4}\[Id\] INT NOT NULL PRIMARY KEY,\n {4}\[Apellido\] NVARCHAR\(60\) NOT NULL,\n {4}\[FechaNacimiento\] DATE NOT NULL,\n {4}\[Numero\] INT NOT NULL,\n {4}\[Piso\] NVARCHAR\(4\) NULL\n\);/);
  assert.equal((s.match(/^INSERT INTO \[Personas\] \(\[Id\], \[Apellido\], \[FechaNacimiento\], \[Numero\], \[Piso\]\) VALUES$/gm) || []).length, 3, "2500 filas en 3 tandas");
  assert.match(s, /\(1, N'O''Brien', '\d{4}-\d\d-\d\d', \d+, (NULL|N'\w+')\)/);
  assert.match(s, /SET NOCOUNT ON;/);
  assert.equal((s.match(/^ {4}\(\d+, /gm) || []).length, 2500);
  const pg = D.aSql(regs.slice(0, 2), ["id", "fechaNacimiento", "codigoPostal"], { dialecto: "postgres", tabla: "public.personas", crear: true, tipo: "persona" });
  assert.match(pg, /CREATE TABLE public\.personas \(\n {4}id integer NOT NULL PRIMARY KEY,\n {4}fecha_nacimiento date NOT NULL,\n {4}codigo_postal varchar\(8\) NOT NULL\n\);/);
  assert.match(pg, /INSERT INTO public\.personas \(id, fecha_nacimiento, codigo_postal\) VALUES\n {4}\(1, '\d{4}-\d\d-\d\d', '\d{4}'\),/);
  assert.doesNotMatch(pg, /N'|NOCOUNT/);
  const sinCrear = D.aSql(regs.slice(0, 1), ["id"], { crear: false, tabla: "dbo.Clientes; DROP TABLE x", tipo: "empresa" });
  assert.match(sinCrear, /^SET NOCOUNT ON;\n\nINSERT INTO \[dbo\]\.\[ClientesDROPTABLEx\] \(\[Id\]\) VALUES\n {4}\(1\);\n$/);
});

test("exportar a C#: record, DateOnly, string? para los nulos y escapes", () => {
  const regs = [{ id: 1, nombre: 'Juan "Toto" \\ Pérez', fechaNacimiento: "1985-03-09", piso: null, numero: 42 }];
  const cs = D.aCsharp(regs, ["id", "nombre", "fechaNacimiento", "piso", "numero"], { tipo: "persona" });
  assert.match(cs, /public sealed record Persona\n\{\n {4}public int Id \{ get; init; \}\n {4}public string Nombre \{ get; init; \} = "";\n {4}public DateOnly FechaNacimiento \{ get; init; \}\n {4}public string\? Piso \{ get; init; \}\n {4}public int Numero \{ get; init; \}\n\}/);
  assert.match(cs, /IReadOnlyList<Persona> Personas = new List<Persona>/);
  assert.ok(cs.includes('new() { Id = 1, Nombre = "Juan \\"Toto\\" \\\\ Pérez", FechaNacimiento = new DateOnly(1985, 3, 9), Piso = null, Numero = 42 },'));
  assert.match(D.aCsharp([], ["id"], { tipo: "empresa" }), /record Empresa[\s\S]*IReadOnlyList<Empresa> Empresas/);
  assert.match(D.aCsharp([], ["id"], { tipo: "persona", clase: "Cliente" }), /IReadOnlyList<Cliente> Clientes/);
  // Todas las claves de todos los campos son identificadores válidos de C#.
  for (const t of ["persona", "empresa"]) for (const c of D.CAMPOS[t]) assert.match(c.k, /^[a-z][A-Za-z]*$/);
});
