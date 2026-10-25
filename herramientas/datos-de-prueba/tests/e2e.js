/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: generar, formatos, campos, semilla, copiar, descargar, validador y memoria.
     node herramientas/datos-de-prueba/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const D = require("../logica.js");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const movil = viewport.width < 700;
  const ctx = await browser.newContext({ viewport, hasTouch: movil, isMobile: movil, locale: "es-AR", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url) && !r.url().startsWith("blob:")) requests.push(r.url()); });
  await page.goto(url); await esperar(400);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  const tocar = (sel) => (movil ? page.tap(sel) : page.click(sel));
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);

  // Por defecto: 20 personas con la semilla «mate», en JSON, igual que la lógica en Node.
  const esperado = D.generar({ cantidad: 20, semilla: "mate" });
  assert.match(await page.textContent("#resumen"), /^20 personas · 21 campos · semilla «mate»$/);
  assert.deepEqual(JSON.parse(await page.textContent("#salida")), esperado);
  assert.equal(await page.locator("#tabla-previa tbody tr").count(), 20);
  assert.equal(await page.locator("#tabla-previa thead th").count(), 21);
  assert.match(await page.textContent("#tabla-previa tbody tr:first-child"), /Norberto.*Barrios.*20071333532/);

  // Validador desde la tabla: el CUIL del primero.
  await tocar("#tabla-previa tbody tr:first-child td.validable:nth-child(6)");
  await esperar(200);
  assert.equal(await page.inputValue("#validar"), "20071333532");
  assert.match(await page.textContent("#veredicto"), /✔ CUIT válido.*20-07133353-2.*persona, masculino/s);

  // Ejemplos del validador.
  await tocar("#ejemplos button:has-text('ARCA')");
  assert.match(await page.textContent("#veredicto"), /✔ CUIT válido.*33-69345023-9.*cuando con 30 el dígito daría 10.*= 145/s);
  await tocar("#ejemplos button:has-text('no cierra')");
  assert.match(await page.textContent("#veredicto"), /✘ El CUIT no cierra.*tendría que ser 6.*El que cierra: 20-12345678-6/s);
  assert.equal(await page.getAttribute("#veredicto", "class"), "veredicto mal");
  await tocar("#ejemplos button:has-text('CBU')");
  assert.match(await page.textContent("#veredicto"), /✔ CBU válido.*Banco Macro.*0590.*✔ verificador 9.*✔ verificador 1/s);
  await page.fill("#validar", "2850590940090418135202");
  assert.match(await page.textContent("#veredicto"), /✘ El CBU no cierra.*✘ verificador 2, tendría que ser 1/s);
  await tocar("#ejemplos button:has-text('DNI')");
  assert.match(await page.textContent("#veredicto"), /DNI 12\.345\.678.*20-12345678-6.*27-12345678-0.*cerca de 19[56]\d/s);
  await tocar("#ejemplos button:has-text('Patente')");
  assert.match(await page.textContent("#veredicto"), /✔ Patente AE 123 KF.*Mercosur/s);
  await page.fill("#validar", "piñón");
  assert.match(await page.textContent("#veredicto"), /✘ No es un CUIT.*entre 6 y 20.*sobra «ñ»/s);

  // Semilla: otra da otros datos; volver a «mate» da los mismos.
  await page.fill("#semilla", "asado"); await esperar(300);
  assert.deepEqual(JSON.parse(await page.textContent("#salida")), D.generar({ cantidad: 20, semilla: "asado" }));
  await tocar("#dado"); await esperar(200);
  assert.notEqual(await page.inputValue("#semilla"), "asado");
  await page.fill("#semilla", "mate"); await esperar(300);
  assert.deepEqual(JSON.parse(await page.textContent("#salida")), esperado);

  // Campos: lo mínimo, y uno de vuelta.
  await tocar("#minimos");
  assert.deepEqual(Object.keys(JSON.parse(await page.textContent("#salida"))[0]), ["id", "nombre", "apellido", "dni", "cuil"]);
  await tocar("#campos button[data-campo=cbu]");
  assert.deepEqual(Object.keys(JSON.parse(await page.textContent("#salida"))[0]), ["id", "nombre", "apellido", "dni", "cuil", "cbu"]);
  assert.equal(await page.locator("#tabla-previa thead th").count(), 6);

  // Separadores y patentes.
  await page.check("#separadores"); await esperar(300);
  assert.match(await page.textContent("#salida"), /"cuil": "20-07133353-2"/);
  assert.match(await page.textContent("#salida"), /"dni": "7\.133\.353"/);

  // CSV con punto y coma.
  await tocar("#formato button[data-formato=csv]");
  assert.ok(await page.locator("#separador").isVisible());
  await page.selectOption("#separador", ";");
  assert.match(await page.textContent("#salida"), /^id;nombre;apellido;dni;cuil;cbu\r?\n1;Norberto;Barrios;7\.133\.353;20-07133353-2;\d{22}/);

  // SQL: PostgreSQL con otra tabla.
  await tocar("#formato button[data-formato=sql]");
  assert.match(await page.textContent("#salida"), /CREATE TABLE \[Personas\]/);
  await page.selectOption("#dialecto", "postgres"); await page.fill("#tabla", "clientes");
  assert.match(await page.textContent("#salida"), /CREATE TABLE clientes \(\n {4}id integer NOT NULL PRIMARY KEY/);
  assert.match(await page.textContent("#salida"), /INSERT INTO clientes \(id, nombre, apellido, dni, cuil, cbu\) VALUES\n {4}\(1, 'Norberto', 'Barrios'/);

  // Empresas en C#.
  await tocar("#tipo button[data-tipo=empresa]"); await esperar(200);
  await tocar("#formato button[data-formato=cs]");
  assert.match(await page.textContent("#resumen"), /^20 empresas · 18 campos/);
  const cs = await page.textContent("#salida");
  assert.match(cs, /public sealed record Empresa/); assert.match(cs, /RazonSocial = ".+ (S\.A\.|S\.R\.L\.|S\.A\.S\.)"/); assert.match(cs, /FechaInicio = new DateOnly\(\d{4}, \d+, \d+\)/);
  assert.match(cs, /Cuit = "3[034]-\d{8}-\d"/);

  // 10.000: la vista previa muestra 50, copiar y descargar llevan todo.
  await tocar("#cantidades button[data-n='10000']"); await esperar(400);
  assert.match(await page.textContent("#resumen"), /^10\.000 empresas/);
  assert.match(await page.textContent("#notaSalida"), /primeros 50.*10\.000.*MB/);
  assert.equal((cs.match(/new\(\) \{/g) || []).length, 20);
  assert.equal(((await page.textContent("#salida")).match(/new\(\) \{/g) || []).length, 50);
  await tocar("#formato button[data-formato=json]");
  const [descarga] = await Promise.all([page.waitForEvent("download"), tocar("#descargar")]);
  assert.equal(descarga.suggestedFilename(), "empresas-mate.json");
  const bajado = JSON.parse(fs.readFileSync(await descarga.path(), "utf8"));
  assert.equal(bajado.length, 10000); assert.equal(bajado[9999].id, 10000);
  assert.ok(bajado.every((e) => D.validarCuit(e.cuit).valido && D.validarCbu(e.cbu).valido));
  assert.deepEqual(bajado.slice(0, 20), D.generar({ tipo: "empresa", cantidad: 20, semilla: "mate", separadores: true }));
  await tocar("#copiar"); await esperar(300);
  assert.match(await page.textContent("#copiado"), /✔ Copiado: 10\.000 empresas/);
  if (!movil) assert.equal(JSON.parse(await page.evaluate(() => navigator.clipboard.readText())).length, 10000);
  // CSV descargado con BOM.
  await tocar("#formato button[data-formato=csv]");
  const [d2] = await Promise.all([page.waitForEvent("download"), tocar("#descargar")]);
  const csv = fs.readFileSync(await d2.path(), "utf8");
  assert.equal(csv.charCodeAt(0), 0xfeff); assert.equal(csv.trim().split("\r\n").length, 10001);

  // Recargar: se acuerda de todo.
  await page.fill("#cantidad", "15"); await esperar(300);
  await page.reload(); await esperar(500);
  assert.equal(await page.getAttribute("#tipo button[data-tipo=empresa]", "aria-pressed"), "true");
  assert.equal(await page.getAttribute("#formato button[data-formato=csv]", "aria-pressed"), "true");
  assert.equal(await page.inputValue("#cantidad"), "15"); assert.equal(await page.inputValue("#separador"), ";");
  assert.ok(await page.isChecked("#separadores"));
  assert.equal(await page.inputValue("#validar"), "piñón");
  assert.match(await page.textContent("#resumen"), /^15 empresas/);
  // Sin campos: aviso y botones apagados.
  await tocar("#minimos");
  for (const k of ["id", "razonSocial", "cuit"]) await tocar(`#campos button[data-campo=${k}]`);
  assert.match(await page.textContent("#notaSalida"), /Elegí al menos un campo/); assert.ok(await page.isDisabled("#copiar"));
  await tocar("#todos"); await tocar("#tipo button[data-tipo=persona]"); await tocar("#formato button[data-formato=json]");
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
