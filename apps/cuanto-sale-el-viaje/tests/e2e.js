/* E2e con Playwright a 360x740 y 1280x720: node apps/cuanto-sale-el-viaje/tests/e2e.js */
"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const srv = http.createServer((q, r) => { const f = path.join(RAIZ, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]); if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": f.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const opts = process.env.EDGE ? { channel: "msedge" } : {};
  const browser = await chromium.launch(opts);
  for (const vp of [{ width: 360, height: 740 }, { width: 1280, height: 720 }]) {
    const page = await (await browser.newContext({ viewport: vp, locale: "es-AR" })).newPage(); const err = [];
    page.on("pageerror", (e) => err.push(String(e))); page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) err.push(m.text()); });
    await page.goto(url);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal " + vp.width);
    // 120 km x2 = 240 km, 8 l/100 = 19,2 l x 1500 = 28.800; desgaste 240x80 = 19.200; total 48.000; 2 personas
    assert.match(await page.textContent("#porPersona"), /24\.000/);
    await page.fill("#alternativa", "30000");
    assert.match(await page.textContent("#veredicto"), /auto conviene/);
    await page.fill("#alternativa", "20000");
    assert.match(await page.textContent("#veredicto"), /otro medio/);
    assert.match(await page.textContent("#veredicto"), /3 personas/);
    await page.uncheck("#idaVuelta");
    assert.match(await page.textContent("#porPersona"), /12\.000/);
    assert.deepEqual(err, []);
    console.log("ok", vp.width);
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
