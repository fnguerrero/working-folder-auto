/* Extrae de index.html todos los bloques <pre class="sql pg"> (los marcados "PostgreSQL"), en el orden
   en que aparecen, y los ejecuta con psql contra una base real con ON_ERROR_STOP. Si cualquier bloque
   falla, el script falla. Así la guía no puede decir algo que PostgreSQL no haga.

   Cómo correrlo (desde la raíz del repo), con una base a la que puedas conectarte y crear esquemas:
     PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=guia node escritos/postgres-desde-sqlserver/tests/correr-sql.js
   Variables: las estándar de libpq (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE). Con --guardar deja
   el SQL extraído en tests/extraido.sql y la salida en tests/salida.txt para revisarlos a mano. */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const RAIZ = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");

function decodificar(s) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

const bloques = [];
const re = /<pre class="sql pg"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g;
let m;
while ((m = re.exec(html))) bloques.push({ sql: decodificar(m[2]), errorEsperado: /data-error-esperado/.test(m[1]) });
if (bloques.length === 0) {
  console.error("No se encontró ningún bloque PostgreSQL en index.html");
  process.exit(1);
}

const sql = [
  "\\set ON_ERROR_STOP on",
  "\\set VERBOSITY terse",
  "\\pset footer off",
  // Un bloque con data-error-esperado muestra a propósito un error (por ejemplo, el del SAVEPOINT):
  // ahí psql no se detiene, y el bloque siguiente vuelve a exigir cero errores.
  ...bloques.map((b, i) => `\\echo '=== bloque ${i + 1} ==='\n` +
    (b.errorEsperado ? "\\set ON_ERROR_STOP off\n" : "") + b.sql.trim() + "\n" +
    (b.errorEsperado ? "\\set ON_ERROR_STOP on\n" : "")),
  "-- Limpieza: la guía crea roles, que son globales al cluster.",
  "RESET ROLE;",
  "DROP OWNED BY app_ventas; DROP OWNED BY lectores;",
  "DROP ROLE IF EXISTS app_ventas; DROP ROLE IF EXISTS lectores;",
  "DROP SCHEMA IF EXISTS guia CASCADE;",
].join("\n");

const guardar = process.argv.includes("--guardar");
if (guardar) fs.writeFileSync(path.join(__dirname, "extraido.sql"), sql);

const r = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"], { input: sql, encoding: "utf8", env: process.env });
const salida = (r.stdout || "") + (r.stderr || "");
if (guardar) fs.writeFileSync(path.join(__dirname, "salida.txt"), salida);

if (r.error) {
  console.error("No se pudo ejecutar psql:", r.error.message);
  process.exit(2);
}
if (r.status !== 0) {
  console.error(salida.split("\n").slice(-30).join("\n"));
  console.error(`\nFALLÓ: psql terminó con código ${r.status}. Se ejecutaron ${bloques.length} bloques.`);
  process.exit(1);
}
console.log(`ok  ${bloques.length} bloques de PostgreSQL ejecutados sin errores.`);
