/* E2e en Chromium headless (Playwright) a 360×740 y 1280×720: veredicto, tasa escondida, situaciones, modo total, tabla y que se guarda.
     node apps/cuotas-o-contado/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url); await esperar(150);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Por defecto: contado 900.000, 12 de 83.333 (≈ 1.000.000), TNA 20 %, a rendir → empate (la tasa escondida ≈ plazo fijo).
  assert.match(await page.textContent("#temRinde"), /1,64 %/);
  assert.match(await page.textContent("#cTem"), /1,66 % mensual/);
  assert.match(await page.textContent("#cTemDet"), /TNA 20,2 %/);
  assert.match(await page.textContent("#vTitulo"), /Da lo mismo/);
  assert.equal(await page.locator("#cuotas tbody tr").count(), 12);
  assert.equal(await page.locator("#lentes tr.elegida").count(), 1);
  assert.match(await page.textContent("#lentes tr.elegida"), /la pongo a rendir/);
  // Con la plata quieta, conviene contado; con el sueldo, cuotas.
  await page.click("#situacion button[data-valor=quieta]"); await esperar(80);
  assert.match(await page.textContent("#vTitulo"), /Conviene contado/);
  assert.match(await page.textContent("#vDetalle"), /con la plata quieta en la cuenta/);
  assert.match(await page.textContent("#lentes tr.elegida"), /queda quieta/);
  await page.click("#situacion button[data-valor=sueldo]"); await esperar(80);
  assert.match(await page.textContent("#vTitulo"), /Conviene en cuotas/);
  assert.match(await page.textContent("#equilibrio"), /Las cuotas convienen hasta/);
  // Subir la TNA al 40 %: a rendir, conviene en cuotas.
  await page.click("#situacion button[data-valor=rinde]"); await page.fill("#tna", "40"); await esperar(80);
  assert.match(await page.textContent("#temRinde"), /3,29 %/);
  assert.match(await page.textContent("#vTitulo"), /Conviene en cuotas/);
  assert.match(await page.textContent("#cRinde"), /te sobran/);
  // Modo total: 12 cuotas de un total de 1.200.000 → cuota 100.000, tasa alta, conviene contado.
  await page.click("#modoCuotas button[data-modo=total]"); await esperar(50);
  assert.ok(await page.locator("#total").isVisible()); assert.ok(!(await page.locator("#cuota").isVisible()));
  await page.fill("#total", "1200000"); await esperar(80);
  assert.match(await page.textContent("#cTotal"), /\$ 1\.200\.000/);
  assert.match(await page.textContent("#cuotas tbody tr:first-child"), /\$ 100\.000/);
  assert.match(await page.textContent("#vTitulo"), /Conviene contado/);
  assert.match(await page.textContent("#equilibrio"), /la cuota tendría que ser de/);
  // Atajo de 6 cuotas y primera cuota hoy: 6 filas y la primera dice «hoy».
  await page.click("#atajosN button[data-n='6']"); await page.click("#primera button[data-valor='0']"); await esperar(80);
  assert.equal(await page.locator("#cuotas tbody tr").count(), 6);
  assert.match(await page.textContent("#cuotas tbody tr:first-child"), /hoy/);
  assert.match(await page.textContent("#cuotas tbody tr:first-child"), /\$ 200\.000/);
  // Recargar: sigue todo.
  await page.reload(); await esperar(200);
  assert.equal(await page.inputValue("#tna"), "40"); assert.equal(await page.inputValue("#n"), "6");
  assert.equal(await page.getAttribute("#primera button[data-valor='0']", "aria-pressed"), "true");
  assert.equal(await page.locator("#cuotas tbody tr").count(), 6);
  // Sin datos: mensaje.
  await page.fill("#contado", ""); await esperar(80);
  assert.match(await page.textContent("#vTitulo"), /Faltan datos/);
  await page.fill("#contado", "900000"); await esperar(80);
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 720 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
