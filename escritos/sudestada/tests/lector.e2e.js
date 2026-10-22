/* E2e del lector (index.html) y de la novela entera (sudestada.html) en Chromium headless (Playwright), a 360×740 y 1280×800:
   portada con índice, abrir un capítulo, siguiente, recargar y que recuerde dónde quedó, tema oscuro con el botón,
   tamaño de letra, sin scroll horizontal ni errores en consola. Corre desde la raíz del repo (sirve todo el repo):
     NODE_PATH=/opt/node-tools/node_modules node escritos/sudestada/tests/lector.e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright"); process.exit(2); }
const RAIZ = path.join(__dirname, "..", "..", "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".epub": "application/epub+zip" };
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": TIPOS[path.extname(a)] || "application/octet-stream" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/escritos/sudestada/` })); }); }
(async () => {
  const { srv, url } = await servir(); const browser = await chromium.launch(); let fallas = 0;
  for (const [w, h] of [[360, 740], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
    const errores = []; page.on("pageerror", (e) => errores.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
    try {
      await page.goto(url); await page.waitForSelector(".portada h1");
      assert.equal(await page.textContent(".portada h1"), "Sudestada");
      const nCaps = await page.locator(".indice li").count(); assert.ok(nCaps >= 1, "hay capítulos en el índice");
      const sinScroll = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `sin scroll horizontal a ${w}px`);
      await sinScroll();
      await page.click(".acciones .boton"); await page.waitForSelector(".capitulo h1");
      assert.match(await page.textContent(".capitulo h1"), /Capítulo 1/); await sinScroll();
      assert.ok((await page.locator(".capitulo .texto p").count()) > 10, "el capítulo tiene párrafos");
      if (nCaps >= 2) {
        await page.click("nav.pie a.sig"); await page.waitForFunction(() => /Capítulo 2/.test(document.querySelector(".capitulo h1")?.textContent || ""));
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.5)); await page.waitForTimeout(300);
        await page.reload(); await page.waitForSelector(".capitulo h1");
        assert.match(await page.textContent(".capitulo h1"), /Capítulo 2/, "al recargar sigue en el capítulo 2");
        await page.waitForTimeout(200); assert.ok(await page.evaluate(() => scrollY > 100), "recuerda la posición");
        await page.keyboard.press("ArrowLeft"); await page.waitForFunction(() => /Capítulo 1/.test(document.querySelector(".capitulo h1")?.textContent || ""));
        await page.click("#ir-indice"); await page.waitForSelector(".portada h1");
        assert.match(await page.textContent(".acciones .boton"), /Seguir leyendo/, "la portada ofrece seguir");
        assert.ok(await page.locator(".indice li.actual").count() === 1, "marca el capítulo actual en el índice");
      }
      await page.click("#tema"); assert.equal(await page.evaluate(() => document.documentElement.dataset.tema), "oscuro");
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor); assert.ok(/rgb\((\d+), (\d+), (\d+)\)/.test(bg) && parseInt(bg.slice(4), 10) < 60, "fondo oscuro: " + bg);
      await page.click("#tema"); assert.equal(await page.evaluate(() => document.documentElement.dataset.tema), "claro");
      await page.click("#letra-mas"); const tam = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize)); assert.ok(tam > 17, "letra más grande: " + tam);
      await page.goto(url + "sudestada.html"); await page.waitForSelector(".capitulo"); await sinScroll();
      assert.ok((await page.locator(".capitulo").count()) === nCaps, "la novela entera tiene todos los capítulos");
      assert.equal(errores.length, 0, "sin errores en consola: " + errores.join(" | "));
      console.log(`✓ ${w}×${h}: portada, capítulos, memoria, tema, letra, novela entera`);
    } catch (e) { fallas++; console.log(`✗ ${w}×${h}: ${e.message}`); }
    await ctx.close();
  }
  await browser.close(); srv.close(); process.exit(fallas ? 1 : 0);
})();
