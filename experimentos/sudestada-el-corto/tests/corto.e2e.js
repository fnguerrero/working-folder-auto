/* E2e del corto (index.html) en Chromium headless con WebGL por software, a 360×740 y 1280×800: los shaders de todas las
   escenas compilan, el cuadro de prueba de cada escena con shader propio tiene imagen (no negro, no uniforme), Reproducir
   oculta la portada y la barra avanza, tocar una escena de la lista salta a ella, sin scroll horizontal ni errores en consola.
     NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/tests/corto.e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright"); process.exit(2); }
const RAIZ = path.join(__dirname, "..", "..", "..");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/experimentos/sudestada-el-corto/` })); }); }
const estadisticas = async (page) => page.evaluate(() => { const c = document.getElementById("c"); const gl = c.getContext("webgl"); const px = new Uint8Array(c.width * c.height * 4); gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px); let s = 0, s2 = 0, n = 0; for (let i = 0; i < px.length; i += 16) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; s += v; s2 += v * v; n++; } const m = s / n; return { media: m, desvio: Math.sqrt(s2 / n - m * m) }; });
(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }); let fallas = 0;
  for (const [w, h] of [[360, 740], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    try {
      await page.goto(url + "?t=1"); await page.waitForFunction(() => window.__listo === true, null, { timeout: 300000 });
      /* todas las escenas compilan */
      const comp = await page.evaluate(() => window.__probarTodas());
      const malas = comp.filter((c) => !c.ok); assert.equal(malas.length, 0, "compilan todas las escenas: " + malas.map((c) => c.id + " → " + c.error.slice(0, 200)).join(" | "));
      /* cada escena con shader propio tiene imagen en la mitad de su duración (a 360 px alcanza con la pantalla chica) */
      const escenas = await page.evaluate(() => window.__escenas()); const medias = [];
      for (const e of escenas) { if (!e.propia) continue; await page.evaluate((tg) => window.__render(tg), e.inicio + e.dur * 0.5); const a = await estadisticas(page); assert.ok(a.media > 2 && a.desvio > 4, `${e.id} tiene imagen: ${JSON.stringify(a)}`); medias.push(`${e.id.slice(0, 2)}:${a.media.toFixed(0)}`); }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal");
      await page.goto(url); await page.waitForSelector("#play:not([disabled])");
      await page.click("#play"); await page.waitForTimeout(2500);
      assert.ok(await page.evaluate(() => document.getElementById("capa").classList.contains("oculta")), "Reproducir oculta la portada");
      assert.ok(await page.evaluate(() => parseFloat(document.getElementById("avance").style.width) > 0), "la barra de tiempo avanza");
      /* saltar a la última escena desde la lista */
      await page.click("#escenas button:last-child"); await page.waitForTimeout(2500);
      assert.ok(await page.evaluate(() => document.querySelector("#escenas button:last-child").classList.contains("actual")), "saltar a una escena la marca como actual");
      assert.ok(await page.evaluate(() => parseFloat(document.getElementById("avance").style.width) > 80), "la barra está al final");
      assert.equal(errores.length, 0, "sin errores en consola: " + errores.join(" | "));
      console.log(`✓ ${w}×${h}: ${comp.length} escenas compilan, imagen (${medias.join(" ")}), reproducir, saltar, sin scroll`);
    } catch (e) { fallas++; console.log(`✗ ${w}×${h}: ${e.message}`); }
    await ctx.close();
  }
  await browser.close(); srv.close(); process.exit(fallas ? 1 : 0);
})();
