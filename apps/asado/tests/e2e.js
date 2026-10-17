/* E2e en Chromium headless (Playwright) a 360×740 y 1280×720: contadores, chips, tabla, plan, copiar, precios guardados.
     node apps/asado/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url); await esperar(150);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  assert.match(await page.textContent("#resumen"), /Para 6 \(6 adultos\)/);
  assert.match(await page.textContent("#tabla"), /Chorizo6 u\./);
  // Sumar dos comilones y un chico.
  await page.click("[data-mas=comilones]"); await page.click("[data-mas=comilones]"); await page.click("[data-mas=chicos]");
  await esperar(100);
  assert.match(await page.textContent("#resumen"), /Para 9 \(6 adultos, 2 comilones, 1 chico\)/);
  assert.equal(await page.textContent("#n-comilones"), "2");
  // Sacar el vacío y poner entraña: la tabla cambia, el plan también.
  await page.click("#cortes button[data-clave=vacio]"); await page.click("#cortes button[data-clave=entrana]"); await esperar(100);
  assert.ok(!/Vacío/.test(await page.textContent("#tabla"))); assert.match(await page.textContent("#tabla"), /Entraña/);
  assert.match(await page.textContent("#plan"), /Entraña/); assert.match(await page.textContent("#plan"), /Sale la entrada/); assert.match(await page.textContent("#plan"), /Sale la carne/);
  assert.match(await page.textContent("#fuegoTexto"), /45 minutos antes/);
  await page.click("#fuego button[data-clave=lena]"); await esperar(100);
  assert.match(await page.textContent("#fuegoTexto"), /leña 60 minutos antes/);
  assert.match(await page.textContent("#tabla"), /Leña/);
  // Lista como texto y copiar.
  await page.click("#verLista"); await esperar(50);
  assert.ok(await page.locator("#lista").isVisible()); assert.match(await page.textContent("#lista"), /^Asado para 9/);
  await page.click("#copiar"); await esperar(150);
  assert.ok(await page.locator("#copiado").isVisible());
  if (viewport.width >= 700) assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Carnicería:/);
  // Precios: cargar dos, ver total y por persona; recargar y que sigan.
  await page.fill("input[data-precio=tira]", "9000"); await page.fill("input[data-precio=chorizo]", "6000"); await esperar(100);
  assert.match(await page.textContent("#costoTotal"), /Total \$ [\d.]+: \$ [\d.]+ cada uno entre 8 grandes/);
  await page.reload(); await esperar(200);
  assert.equal(await page.inputValue("input[data-precio=tira]"), "9000");
  assert.match(await page.textContent("#resumen"), /Para 9/);
  assert.equal(await page.getAttribute("#fuego button[data-clave=lena]", "aria-pressed"), "true");
  // Bajar a cero a todos: mensaje y sin carne.
  for (const k of ["adultos", "comilones", "chicos"]) for (let i = 0; i < 8; i++) await page.click(`[data-menos=${k}]`);
  await esperar(100);
  assert.match(await page.textContent("#resumen"), /Sumá gente/);
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 720 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
