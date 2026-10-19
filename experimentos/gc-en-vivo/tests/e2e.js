/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: escenarios, cifras, gráficos, diagnóstico, controles y memoria.
     node experimentos/gc-en-vivo/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".js") ? "text/javascript; charset=utf-8" : a.endsWith(".json") ? "application/json" : "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url); await esperar(300);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Escenario por defecto: vida corta. Pocas pausas, gen0 de medio milisegundo.
  assert.equal(await page.getAttribute("#escenarios button[data-clave=corta]", "aria-pressed"), "true");
  assert.match(await page.textContent("#cColecciones"), /^\d+ \/ 0 \/ 0$/);
  assert.match(await page.textContent("#cPausaPct"), /0,1\d %/);
  assert.ok((await page.locator("#gPausas circle").count()) > 20, "pausas dibujadas");
  assert.ok((await page.locator("#gHeap path").count()) >= 4, "capas del heap");
  assert.match(await page.textContent("#diagnostico"), /Casi todo muere en gen0/);
  // Crisis de la mediana edad: gen1 y gen2 de fondo, p99 alto, diagnóstico.
  await page.click("#escenarios button[data-clave=media]"); await esperar(300);
  assert.equal(await page.inputValue("#vidaMediaPct"), "100");
  assert.match(await page.textContent("#cColeccionesDet"), /de fondo/);
  assert.match(await page.textContent("#diagnostico"), /Crisis de la mediana edad/);
  assert.ok((await page.locator("#gPausas rect").count()) >= 1, "sombra del marcado de fondo");
  const p99 = parseFloat((await page.textContent("#cLatP99")).replace(",", "."));
  assert.ok(p99 > 20, "p99 de pedidos con pausas: " + p99);
  // LOH y pool.
  await page.click("#escenarios button[data-clave=loh]"); await esperar(300);
  assert.match(await page.textContent("#diagnostico"), /Churn en el LOH/);
  assert.match(await page.textContent("#tPausas"), /gen2 bloqueante/);
  await page.click("#escenarios button[data-clave=loh-pool]"); await esperar(300);
  assert.match(await page.textContent("#cColecciones"), /^0 \/ 0 \/ 0$/);
  assert.match(await page.textContent("#diagnostico"), /No hubo ni un GC/);
  // Controles a mano: subir el ritmo cambia la cantidad de gen0; cambiar el modo a server; escenario pasa a «a medida».
  await page.click("#escenarios button[data-clave=corta]"); await esperar(200);
  const antes = await page.textContent("#cColecciones");
  await page.fill("#ritmoMBs", "800"); await page.dispatchEvent("#ritmoMBs", "change"); await esperar(300);
  assert.notEqual(await page.textContent("#cColecciones"), antes);
  assert.equal(await page.getAttribute("#escenarios button[data-clave=corta]", "aria-pressed"), "false");
  assert.match(await page.textContent("#escenarioTexto"), /a medida/);
  await page.click("#modo button[data-valor=server]"); await esperar(300);
  assert.match(await page.textContent("#cHeapDet"), /en 4 heaps/);
  assert.match(await page.textContent("#diagnostico"), /Server GC/);
  await page.click("#modo button[data-valor=datas]"); await esperar(300);
  assert.match(await page.textContent("#diagnostico"), /DATAS/);
  // Recargar: sigue el estado.
  await page.reload(); await esperar(300);
  assert.equal(await page.inputValue("#ritmoMBs"), "800");
  assert.equal(await page.getAttribute("#modo button[data-valor=datas]", "aria-pressed"), "true");
  // La tabla real está generada y la sección del texto tiene fuentes.
  assert.ok((await page.locator("table[aria-label='Mediciones en .NET 8 real'] tbody tr").count()) >= 20, "tabla real");
  assert.ok((await page.locator(".texto a[href^='https://learn.microsoft.com']").count()) >= 3);
  await page.click("#escenarios button[data-clave=cache-bloq]"); await esperar(400);
  assert.match(await page.textContent("#diagnostico"), /bloqueantes/);
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
