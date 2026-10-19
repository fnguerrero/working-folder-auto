/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: ejemplos, explicación, matches y grupos, avisos, corte por backtracking, opciones, C# y memoria.
     node herramientas/regex-en-criollo/tests/e2e.js */
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
  await page.goto(url); await esperar(500);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Por defecto: la fecha. Explicación con grupos, dos matches, avisos.
  assert.match(await page.textContent("#arbol"), /grupo «dia» \(número 1\)/);
  assert.match(await page.textContent("#resumen"), /2 matches/);
  assert.equal(await page.locator("#marcado mark").count(), 2);
  assert.match(await page.textContent("#matches tbody tr:first-child"), /dia = 09/);
  assert.match(await page.textContent("#avisos"), /No está anclada/);
  assert.match(await page.textContent("#cs"), /\[GeneratedRegex\(@"\\b\(\?<dia>/);
  // Escribir a mano: un error con posición.
  await page.fill("#patron", "(ab"); await esperar(300);
  assert.ok(await page.locator("#error").isVisible()); assert.match(await page.textContent("#error"), /falta cerrar el grupo/);
  // Un patrón que valida con $: aviso del salto final; con Multiline, no.
  await page.fill("#patron", "^\\d+$"); await page.fill("#texto", "123\n45a"); await esperar(400);
  assert.match(await page.textContent("#avisos"), /\$ también matchea/);
  assert.match(await page.textContent("#resumen"), /No matchea/);
  await page.check("#opciones input[data-op=multiline]"); await esperar(400);
  assert.ok(!/\$ también matchea/.test(await page.textContent("#avisos")));
  assert.match(await page.textContent("#resumen"), /1 match/);
  assert.match(await page.textContent("#cs"), /RegexOptions\.Multiline/);
  await page.uncheck("#opciones input[data-op=multiline]");
  // El que explota: se corta a los 2 segundos y lo dice; después la página sigue viva.
  await page.click("#ejemplos button:has-text('explota')"); await esperar(200);
  assert.match(await page.textContent("#avisos"), /catastrófico/);
  await page.waitForFunction(() => /Se cortó|match/.test(document.querySelector("#resumen").textContent), null, { timeout: 8000 });
  assert.match(await page.textContent("#resumen"), /Se cortó a los 2 segundos/);
  await page.click("#ejemplos button:has-text('CUIT')"); await esperar(600);
  assert.match(await page.textContent("#resumen"), /3 matches/);
  assert.match(await page.textContent("#matches tbody tr:nth-child(2)"), /dni = 12345678/);
  assert.equal(await page.isChecked("#opciones input[data-op=multiline]"), true);
  // C# clásico y copiar.
  await page.click("#modoCs button[data-modo=clasico]"); await esperar(100);
  assert.match(await page.textContent("#cs"), /TimeSpan\.FromSeconds\(1\)/);
  await page.click("#copiar"); await esperar(200);
  assert.ok(await page.locator("#copiado").isVisible());
  if (viewport.width >= 700) assert.match(await page.evaluate(() => navigator.clipboard.readText()), /RegexOptions\.Compiled/);
  // Recargar: sigue el CUIT y el modo clásico.
  await page.reload(); await esperar(600);
  assert.match(await page.inputValue("#patron"), /^\^\(\?<tipo>/);
  assert.equal(await page.getAttribute("#modoCs button[data-modo=clasico]", "aria-pressed"), "true");
  assert.match(await page.textContent("#resumen"), /3 matches/);
  // Uno que no se puede probar.
  await page.fill("#patron", "(?(1)a|b)"); await esperar(400);
  assert.match(await page.textContent("#resumen"), /no se puede probar/);
  assert.match(await page.textContent("#arbol"), /si el grupo 1 capturó algo/);
  await page.click("#ejemplos button:has-text('Serilog')"); await esperar(500);
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
