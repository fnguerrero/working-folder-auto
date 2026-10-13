/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px y a 1280 px.
   Correr desde la raíz del repo:
     node experimentos/guid-vs-identity/tests/e2e.js
   Si Playwright está instalado en otro lado, apuntá NODE_PATH a su node_modules. */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

let chromium;
try { ({ chromium } = require("playwright")); } catch (e) {
  console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}
const I = require("../logica.js");
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };
const CAPTURAS = process.env.CAPTURAS || "";

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function recorrido(navegador, url, { ancho, alto, movil }) {
  console.log(`\n== ${ancho} px ==`);
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, locale: "es-AR" });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log("  ✓ " + n);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();

  await pagina.goto(url);
  // La corrida automática inicial es de 50.000 filas.
  await pagina.waitForFunction(() => window.ultimoResultado && window.ultimoResultado.opciones.n === 50000, null, { timeout: 60000 });
  assert.ok(await pagina.locator("#resultados").isVisible());
  assert.equal(await pagina.locator(".esc").count(), 4);
  assert.ok(!(await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "sin scroll horizontal");
  paso("corrida inicial de 50.000 filas con cuatro escenarios, sin scroll horizontal");

  const rs = await pagina.evaluate(() => window.ultimoResultado.resultados.map((r) => ({ tipo: r.tipo, llenado: r.llenado, frag: r.fragmentacion, hojas: r.hojas, calientes: r.hojasCalientes })));
  const porTipo = Object.fromEntries(rs.map((r) => [r.tipo, r]));
  assert.ok(porTipo.identity.llenado > 0.98);
  assert.ok(porTipo["guid-aleatorio"].llenado > 0.66 && porTipo["guid-aleatorio"].llenado < 0.72);
  assert.ok(porTipo["guid-aleatorio"].frag > 0.95);
  assert.ok(porTipo["guid-secuencial"].hojas > porTipo.identity.hojas);
  // Lo que se ve coincide con la lógica corrida en Node con los mismos parámetros.
  const esperado = I.correr({ tipo: "guid-aleatorio", n: 50000, bytesCarga: 100, division: "fin", semilla: 1, insercionesPorMs: 5 });
  assert.equal(porTipo["guid-aleatorio"].hojas, esperado.hojas);
  assert.ok((await texto("#esc-aleatorio")).includes(I.fmtEntero(esperado.hojas)));
  assert.ok((await texto("#esc-aleatorio")).includes(I.fmtPorcentaje(esperado.llenado, 1)));
  paso("los números de la página coinciden con la lógica en Node");

  assert.equal(await pagina.locator("#g-llenado path.linea").count(), 4);
  assert.equal(await pagina.locator("#g-barras rect").count(), 16);
  assert.ok((await texto("#diag")).includes("GUID aleatorio"));
  assert.ok((await texto("#diag")).includes("GUID v7"));
  paso("gráfico de llenado con cuatro líneas, barras y diagnóstico");

  // Cambiar a PostgreSQL con v7 a 1 inserción por ms y correr de nuevo con 20.000 filas.
  await pagina.selectOption("#n", "20000");
  await pagina.selectOption("#motor", "derecha");
  await pagina.fill("#por-ms", "1");
  await pagina.click("#correr");
  await pagina.waitForFunction(() => window.ultimoResultado && window.ultimoResultado.opciones.n === 20000, null, { timeout: 60000 });
  const r2 = await pagina.evaluate(() => Object.fromEntries(window.ultimoResultado.resultados.map((r) => [r.tipo, r])));
  assert.ok(r2.identity.llenado > 0.87 && r2.identity.llenado < 0.92, "fillfactor 90 de PostgreSQL");
  assert.ok(r2["guid-v7"].llenado > 0.87, "v7 a 1 por ms rinde como secuencial");
  assert.ok((await texto("#diag")).includes("rinde como un secuencial estricto"));
  assert.equal(await texto("#estado"), "Listo");
  paso("segunda corrida: PostgreSQL, v7 a 1 por ms");

  const chicos = await pagina.evaluate(() => Array.from(document.querySelectorAll("button, input, select"))
    .filter((e) => e.offsetParent !== null).map((e) => ({ id: e.id, h: e.getBoundingClientRect().height })).filter((x) => x.h < 44));
  assert.deepEqual(chicos, [], "controles de al menos 44 px");
  paso("controles de al menos 44 px");

  if (CAPTURAS) await pagina.screenshot({ path: path.join(CAPTURAS, `guid-${ancho}.png`), fullPage: true });
  assert.deepEqual(errores, [], "sin errores de consola");
  paso("sin errores de consola");
  await contexto.close();
}

async function main() {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try {
    await recorrido(navegador, url, { ancho: 360, alto: 740, movil: true });
    await recorrido(navegador, url, { ancho: 1280, alto: 900, movil: false });
    console.log("\nTodo bien.");
  } finally { await navegador.close(); srv.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
