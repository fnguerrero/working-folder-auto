/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: presets, tiles, tabla de políticas, diagnóstico, gráficos, estampida, memoria.
     node experimentos/cache-en-vivo/tests/e2e.js */
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
  const listo = () => page.waitForFunction(() => /pedidos simulados/.test(document.querySelector("#estado").textContent), null, { timeout: 30000 });
  await page.goto(url); await listo();
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Catálogo por defecto: LRU ~51 %, fórmula cerca, 7 políticas, Belady arriba de todas.
  const tiles = await page.textContent("#tiles"); assert.match(tiles, /5\d,\d %hit rate LRU5\d,\d %según la fórmula/);
  assert.equal(await page.locator("#politicas tbody tr").count(), 7);
  const filas = await page.locator("#politicas tbody tr").allTextContents(); const hr = filas.map((f) => parseFloat(f.match(/(\d+,\d) %/)[1].replace(",", ".")));
  assert.ok(hr[6] >= Math.max(...hr.slice(0, 6)), "Belady es el techo");
  assert.match(await page.textContent("#diag"), /La simulación y la aproximación coinciden/);
  assert.match(await page.textContent("#diag"), /Para el 90 % de aciertos, [\d.]+ entradas/);
  const dibujado = async (id) => page.evaluate((i) => { const c = document.querySelector(i); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) n++; return n > 500; }, id);
  for (const id of ["#g-curva", "#g-serie", "#g-est", "#g-vuelo"]) assert.ok(await dibujado(id), `gráfico ${id} dibujado`);
  // Scan de bots: LFU le gana a LRU y el diagnóstico lo dice.
  await page.click("#presets button:has-text('scan')"); await esperar(200); await listo();
  const f2 = await page.locator("#politicas tbody tr").allTextContents(); const h2 = f2.map((f) => parseFloat(f.match(/(\d+,\d) %/)[1].replace(",", ".")));
  assert.ok(h2[1] > h2[0], "LFU > LRU con scan"); assert.match(await page.textContent("#diag"), /una sola vez/);
  // Trending: LRU le gana a LFU.
  await page.click("#presets button:has-text('Trending')"); await esperar(200); await listo();
  const f3 = await page.locator("#politicas tbody tr").allTextContents(); const h3 = f3.map((f) => parseFloat(f.match(/(\d+,\d) %/)[1].replace(",", ".")));
  assert.ok(h3[0] > h3[1], "LRU > LFU con rotación"); assert.match(await page.textContent("#diag"), /popularidad rota/);
  // TTL: aparece en el estado y en el diagnóstico; deslizante rinde más.
  await page.click("#presets button:has-text('TTL')"); await esperar(200); await listo();
  assert.match(await page.textContent("#estado"), /TTL de 30 s/); assert.match(await page.textContent("#diag"), /TTL de 30 s/);
  const hAbs = parseFloat((await page.textContent("#tiles")).match(/(\d+,\d) %hit rate LRU/)[1].replace(",", "."));
  await page.selectOption("select[data-k=expiracion]", "deslizante"); await esperar(500); await listo();
  const hDes = parseFloat((await page.textContent("#tiles")).match(/(\d+,\d) %hit rate LRU/)[1].replace(",", "."));
  assert.ok(hDes > hAbs, `deslizante ${hDes} > absoluta ${hAbs}`);
  // Editar un campo: el caché más grande sube el hit rate.
  await page.fill("input[data-k=C]", "80000"); await esperar(500); await listo();
  const hGrande = parseFloat((await page.textContent("#tiles")).match(/(\d+,\d) %hit rate LRU/)[1].replace(",", "."));
  assert.ok(hGrande > hDes, `${hGrande} > ${hDes}`);
  // Estampida: single flight por defecto, 20 llamadas; sin protección cientos; temprano 100 %.
  assert.match(await page.textContent("#tilesEst"), /\d{3}consultas al backend sin protección20con la protección/);
  await page.selectOption("select[data-e=proteccion]", "temprano"); await esperar(400);
  assert.match(await page.textContent("#tilesEst"), /100,0 %hit rate0 msp99/); assert.match(await page.textContent("#diagEst"), /Refresco temprano/);
  await page.fill("input[data-e=claves]", "50"); await esperar(400);
  assert.match(await page.textContent("#diagEst"), /Refresco temprano/);
  // Recargar: sigue el escenario y la estampida.
  await page.reload(); await listo();
  assert.equal(await page.inputValue("input[data-k=C]"), "80000"); assert.equal(await page.inputValue("select[data-k=expiracion]"), "deslizante");
  assert.equal(await page.inputValue("select[data-e=proteccion]"), "temprano"); assert.equal(await page.inputValue("input[data-e=claves]"), "50");
  await page.click("#presets button:has-text('Catálogo')"); await listo(); await page.selectOption("select[data-e=proteccion]", "singleflight"); await esperar(400);
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
