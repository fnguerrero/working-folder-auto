/* E2e con Playwright a 360x740 y 1280x720: node herramientas/fechas-en-criollo/tests/e2e.js (EDGE=1 usa el Edge del sistema) */
"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const srv = http.createServer((q, r) => { const f = path.join(RAIZ, q.url.split("?")[0] === "/" ? "index.html" : q.url.split("?")[0]); if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": f.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch(process.env.EDGE ? { channel: "msedge" } : {});
  for (const vp of [{ width: 360, height: 740 }, { width: 1280, height: 720 }]) {
    const page = await (await browser.newContext({ viewport: vp, locale: "es-AR" })).newPage(); const err = [];
    page.on("pageerror", (e) => err.push(String(e))); page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) err.push(m.text()); });
    await page.goto(url);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal " + vp.width);
    // 2026-11-13 07:00:00 tomado como UTC -> 04:00 en Argentina
    const zonas = await page.textContent("#zonas");
    assert.match(zonas, /Argentina[\s\S]*13\/11\/2026 04:00:00[\s\S]*UTC-03:00/);
    assert.match(zonas, /13\/11\/2026 07:00:00/);
    assert.match(await page.textContent("#tecnicos"), /1794553200000/);
    // epoch en segundos
    await page.fill("#entrada", "1700000000");
    assert.match(await page.textContent("#tipo"), /segundos/);
    assert.match(await page.textContent("#zonas"), /14\/11\/2023 19:13:20/);
    // ticks de .NET
    await page.fill("#entrada", "638355968000000000");
    assert.match(await page.textContent("#tipo"), /ticks/);
    // hora sin zona tomada como Argentina
    await page.fill("#entrada", "13/11/2026 04:00");
    await page.selectOption("#zona", "America/Argentina/Buenos_Aires");
    assert.match(await page.textContent("#tecnicos"), /2026-11-13T07:00:00Z/);
    // diferencia
    await page.fill("#otra", "14/11/2026 06:30");
    assert.match(await page.textContent("#dif"), /1 días, 2 h, 30 min/);
    // error sin romper
    await page.fill("#entrada", "banana");
    assert.equal(await page.isVisible("#error"), true);
    assert.equal(await page.isHidden("#resultado"), true);
    await page.fill("#entrada", "1700000000");
    assert.equal(await page.isVisible("#resultado"), true);
    assert.deepEqual(err, []);
    console.log("ok", vp.width);
  }
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
