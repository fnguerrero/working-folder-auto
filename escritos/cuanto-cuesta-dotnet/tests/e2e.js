/* Recorrido en Chromium headless con Playwright, a 360 px y 1280 px: índice generado, navegación por
   secciones, sección activa, copiar un bloque, modo oscuro, sin scroll horizontal ni errores de consola.
   Correr desde la raíz del repo:
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node escritos/cuanto-cuesta-dotnet/tests/e2e.js */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".cs": "text/plain; charset=utf-8", ".py": "text/plain; charset=utf-8" };
function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" }); fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}
async function recorrido(navegador, url, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR", permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  await pagina.goto(url);
  assert.equal(await pagina.locator("main h2[id]").count(), 19);
  assert.equal(await pagina.locator("#toc-lateral li").count(), 19);
  assert.equal(await pagina.locator("#toc-movil li").count(), 19);
  assert.ok((await pagina.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width + 1, "sin scroll horizontal");
  const lateralVisible = await pagina.locator(".toc-lateral").isVisible();
  assert.equal(lateralVisible, !movil, "índice lateral solo en escritorio");
  paso("carga, índice con 19 secciones, sin scroll horizontal");
  if (movil) { await pagina.click("details.toc-movil summary"); assert.ok(await pagina.locator("#toc-movil").isVisible()); }
  await pagina.click(`${movil ? "#toc-movil" : "#toc-lateral"} a[data-id='regex']`);
  await pagina.waitForFunction(() => location.hash === "#regex");
  await pagina.waitForFunction(() => (document.querySelector("nav.toc a.activo") || { dataset: {} }).dataset.id === "regex", null, { timeout: 5000 });
  assert.ok((await pagina.evaluate(() => document.getElementById("regex").getBoundingClientRect().top)) < 150, "la sección quedó arriba");
  paso("navegar a un capítulo y resaltado de la sección activa");
  assert.equal(await pagina.locator("pre .copiar").count(), await pagina.locator("pre").count());
  if (!movil) {
    await pagina.click("#regex ~ pre .copiar >> nth=0");
    const t = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(t, /GeneratedRegex/);
    paso("copiar un bloque");
  }
  assert.ok((await pagina.locator(".tabla table").count()) >= 17);
  assert.ok(await pagina.locator("a[href='resultados.json']").first().isVisible());
  await pagina.emulateMedia({ colorScheme: "dark" });
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(21, 23, 28)");
  paso("tablas, enlaces a los datos y modo oscuro");
  assert.deepEqual(errores, [], "sin errores de consola");
  await contexto.close();
}
(async () => {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try { await recorrido(navegador, url, { width: 360, height: 740 }, true); await recorrido(navegador, url, { width: 1280, height: 900 }, false); console.log("E2E OK"); }
  catch (e) { console.error("E2E FALLÓ:", e); process.exitCode = 1; }
  finally { await navegador.close(); srv.close(); }
})();
