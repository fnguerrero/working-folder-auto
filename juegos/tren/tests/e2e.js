/* E2e de El tren en Chromium headless (Playwright) a 360×740 y 1280×800: arranca, el tren anda, cada toque hace algo, sin errores ni pedidos afuera.
     node juegos/tren/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url + "?rapido"); await page.click("#jugar"); await esperar(300);
  assert.ok(await page.locator("#inicio").isHidden());
  const E = () => page.evaluate(() => { const T = window.__tren; return { x: T.tren().x, silba: T.tren().silba, flores: T.flores.length, humos: T.humos.length, pajaros: T.pajaros.length, lluvia: T.nubes.filter((n) => n.llueve > 0).length, vacas: T.vacas.filter((v) => v.habla > 0).length, sol: T.sol().risa, suelo: T.suelo(), nube: T.nubes[0], vaca: T.vacas[0], solPos: T.sol(), flor: T.flores[0], barrera: T.barrera() }; });
  const a = await E(); await esperar(400); const b = await E();
  assert.ok(b.x > a.x, "el tren avanza"); assert.ok(b.humos > 0, "sale humo");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), "sin scroll");
  // Tocar el tren: silba.
  await page.waitForFunction(() => { const t = window.__tren.tren(); return t.x > 50 && t.x < innerWidth - 150; }, null, { timeout: 15000 });
  const t = await E(); await page.mouse.click(t.x + 30, t.suelo - 20); assert.ok((await E()).silba > 0, "silba");
  // Tocar el sol, una nube, una vaca, una flor, el cielo y el pasto.
  await page.mouse.click(t.solPos.x, t.solPos.y); assert.ok((await E()).sol > 0, "el sol se ríe");
  await page.mouse.click(t.nube.x, t.nube.y); assert.equal((await E()).lluvia, 1, "llueve");
  await page.waitForFunction((vx) => { const x = window.__tren.tren().x; return x > vx + 260 || x < vx - 120; }, t.vaca.x, { timeout: 15000 });
  await page.mouse.click(t.vaca.x + 10, t.vaca.y - 10); assert.equal((await E()).vacas, 1, "la vaca muge");
  await page.mouse.click(viewport.width / 2, t.suelo * 0.5); assert.equal((await E()).pajaros, 1, "un pájaro");
  const antes = (await E()).flores; await page.mouse.click(viewport.width * 0.3, t.suelo + 40); const despues = await page.evaluate(() => ({ n: window.__tren.flores.length, saltan: window.__tren.flores.filter((f) => f.salta > 0).length })); assert.ok(despues.n === antes + 1 || despues.saltan > 0, "brota o salta una flor");
  await page.keyboard.press("Space"); assert.ok((await E()).silba > 0);
  await esperar(2500); assert.ok((await E()).lluvia === 0, "la lluvia para");
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`) });
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
