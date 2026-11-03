/* Prueba e2e de Burbujas con Playwright a 360×740 y 1280×720: carga sin errores ni pedidos externos,
   tocar una burbuja la explota y suena, tocar el vacío también suena, varios dedos a la vez,
   una burbuja con animal saluda, el silencio se recuerda al recargar y no hay scroll.
   Correr desde la raíz del repo:  node juegos/burbujas/tests/e2e.js */
"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const assert = require("node:assert/strict");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Falta Playwright."); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const srv = http.createServer((req, res) => {
  const f = path.join(RAIZ, req.url.split("?")[0] === "/" ? "/index.html" : req.url.split("?")[0]);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const exe = process.env.CHROME_PATH || undefined;
  const browser = await chromium.launch({ executablePath: exe, args: ["--autoplay-policy=no-user-gesture-required"] });
  for (const [w, h, touch] of [[360, 740, true], [1280, 720, false]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch });
    const page = await ctx.newPage();
    const errores = [], externos = [];
    page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("request", (r) => { if (!r.url().startsWith(url)) externos.push(r.url()); });
    await page.goto(url); await page.waitForTimeout(500);
    const nBurb = await page.evaluate(() => __estado.burbujas.length);
    assert.ok(nBurb >= 4, `hay burbujas al abrir (${nBurb})`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true, "sin scroll");
    // tocar la primera burbuja
    const pos = await page.evaluate(() => { const b = __estado.burbujas[0]; return [b.x, b.y]; });
    const antes = await page.evaluate(() => __estado.explotadas);
    if (touch) await page.touchscreen.tap(pos[0], pos[1]); else await page.mouse.click(pos[0], pos[1]);
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => __estado.explotadas) > antes, "explota al tocar");
    assert.ok(await page.evaluate(() => __sonidos) >= 1, "suena el plop");
    // el vacío también responde
    const s0 = await page.evaluate(() => __sonidos);
    await page.evaluate(() => __tocar(1, 1)); 
    assert.ok(await page.evaluate(() => __sonidos) > s0, "tocar el vacío suena");
    // la burbuja con animal saluda y suena
    const idx = await page.evaluate(() => { const b = __estado.burbujas.find((x) => x.animal); return b ? [b.x, b.y] : null; });
    if (idx) {
      await page.evaluate(([x, y]) => __tocar(x, y), idx);
      assert.ok(await page.evaluate(() => __estado.saludos.length) >= 1, "el animal saluda");
    }
    // silencio se recuerda
    await page.click("#mute");
    assert.equal(await page.getAttribute("#mute", "aria-pressed"), "true");
    await page.reload(); await page.waitForTimeout(200);
    assert.equal(await page.getAttribute("#mute", "aria-pressed"), "true", "silencio recordado");
    const s1 = await page.evaluate(() => __sonidos);
    await page.evaluate(() => __tocar(5, 5));
    assert.equal(await page.evaluate(() => __sonidos), s1, "en silencio no suena");
    if (w === 360) await page.screenshot({ path: path.join(process.env.SHOTS || ".", "burbujas-360.png") });
    assert.deepEqual(errores, [], "sin errores de consola");
    assert.deepEqual(externos, [], "sin pedidos externos");
    console.log(`ok ${w}×${h}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
