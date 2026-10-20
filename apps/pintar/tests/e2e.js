/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: modelos, editar un ambiente, agregar y quitar, supuestos, precios, copiar, memoria.
     node apps/pintar/tests/e2e.js */
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
  await page.goto(url); await esperar(400);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Por defecto: el depto de 2 ambientes, con lista y tiempo.
  assert.equal(await page.locator(".ambiente").count(), 5);
  assert.match(await page.textContent("#superficies"), /m² de paredes/);
  const filas = await page.locator("#lista tbody tr").allTextContents();
  assert.ok(filas.some((f) => /Látex interior/.test(f)) && filas.some((f) => /cielorraso/.test(f)) && filas.some((f) => /Rodillo/.test(f)));
  assert.ok(!filas.some((f) => /Esmalte/.test(f)));
  assert.match(await page.textContent("#tiempo"), /horas de trabajo .* jornadas de 6 h/);
  assert.match(await page.textContent("#total"), /Poné los precios/);
  assert.equal(await page.locator("#orden li").count(), 6);
  // Editar: el dormitorio pasa a revoque nuevo con sintético: aparecen enduido, fijador y esmalte.
  const dorm = page.locator(".ambiente").nth(1);
  await dorm.locator("select[data-k=paredes]").selectOption("nueva"); await dorm.locator("input[data-k=aberturas]").check(); await esperar(200);
  const filas2 = await page.locator("#lista tbody tr").allTextContents();
  assert.ok(filas2.some((f) => /Enduido/.test(f)) && filas2.some((f) => /Fijador/.test(f)) && filas2.some((f) => /Esmalte sintético/.test(f)) && filas2.some((f) => /Aguarrás/.test(f)));
  assert.match(await dorm.locator("[data-m2]").textContent(), /m² de pared .* m² de techo .* m² de carpintería/);
  assert.ok((await page.locator("#orden li").allTextContents()).some((t) => /Revoque nuevo/.test(t)));
  // Piso nuevo en la cocina: cajas, pegamento, pastina.
  await page.locator(".ambiente").nth(2).locator("input[data-k=piso]").check(); await esperar(200);
  const filas3 = await page.locator("#lista tbody tr").allTextContents();
  assert.ok(filas3.some((f) => /Piso 45×45.*cajas/.test(f)) && filas3.some((f) => /Pegamento/.test(f)) && filas3.some((f) => /Pastina/.test(f)));
  assert.match((await page.locator("#orden li").first().textContent()) + (await page.locator("#orden li").nth(1).textContent()), /Piso primero/);
  // Precios: subtotal y total.
  await page.fill("input[data-precio=latexInterior]", "9000"); await esperar(200);
  assert.match(await page.textContent("#total"), /Total: \$[\d.]+ \(faltan precios en \d+ renglones\)/);
  const litros = +(await page.locator("#lista tbody tr", { hasText: "Látex interior" }).locator("td").nth(1).textContent()).replace(/[^\d,]/g, "").replace(",", ".");
  assert.match(await page.locator("#lista tbody tr", { hasText: "Látex interior" }).locator("td").nth(3).textContent(), new RegExp("\\$" + (9000 * litros).toLocaleString("es-AR").replace(/\./g, "\\.")));
  // Supuestos: rendimiento a la mitad duplica los litros.
  await page.click("#supuestos summary"); await esperar(100);
  await page.fill("input[data-cfg='rendimiento.latexInterior']", "5"); await esperar(200);
  const litros2 = +(await page.locator("#lista tbody tr", { hasText: "Látex interior" }).locator("td").nth(1).textContent()).replace(/[^\d,]/g, "").replace(",", ".");
  assert.ok(litros2 >= litros * 1.6, `${litros2} vs ${litros}`);
  await page.fill("input[data-cfg='rendimiento.latexInterior']", "10"); await esperar(200);
  // Agregar, renombrar, duplicar y quitar.
  await page.click("#agregar"); await esperar(100);
  assert.equal(await page.locator(".ambiente").count(), 6);
  await page.locator(".ambiente").nth(5).locator("input[data-k=nombre]").fill("Lavadero"); await esperar(100);
  await page.locator(".ambiente").nth(5).locator("button[data-accion=duplicar]").click(); await esperar(100);
  assert.equal(await page.locator(".ambiente").count(), 7);
  assert.equal(await page.locator(".ambiente").nth(6).locator("input[data-k=nombre]").inputValue(), "Lavadero (copia)");
  await page.locator(".ambiente").nth(6).locator("button[data-accion=quitar]").click(); await esperar(100);
  assert.equal(await page.locator(".ambiente").count(), 6);
  assert.match(await page.locator("#porAmbiente tbody").textContent(), /Lavadero/);
  // Copiar la lista.
  await page.click("#copiar"); await esperar(200);
  assert.ok(await page.locator("#copiado").isVisible());
  if (viewport.width >= 700) { const t = await page.evaluate(() => navigator.clipboard.readText()); assert.match(t, /^Para pintar: Living comedor, Dormitorio/); assert.match(t, /- Látex interior: \d+ L .*— \$/); assert.match(t, /jornadas de 6 h/); }
  // Recargar: sigue todo.
  await page.reload(); await esperar(400);
  assert.equal(await page.locator(".ambiente").count(), 6);
  assert.equal(await page.locator(".ambiente").nth(1).locator("select[data-k=paredes]").inputValue(), "nueva");
  assert.equal(await page.inputValue("input[data-precio=latexInterior]"), "9000");
  assert.ok(await page.locator(".ambiente").nth(2).locator("input[data-k=piso]").isChecked());
  // Un modelo: la casa, con el frente exterior.
  await page.click("button[data-preset=casa]"); await esperar(300);
  assert.equal(await page.locator(".ambiente").count(), 9);
  assert.ok((await page.locator("#lista tbody tr").allTextContents()).some((f) => /Látex exterior/.test(f)));
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
