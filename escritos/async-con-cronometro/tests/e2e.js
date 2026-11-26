/* Recorrido headless a 360 px y 1280 px: índice, navegación, copiar, gráfico, tablas, modo oscuro, sin scroll
   horizontal ni errores de consola. Abre la página como archivo local. Necesita Playwright:
     node escritos/async-con-cronometro/tests/e2e.js
   CANAL=msedge usa el Edge instalado; CAPTURAS=<carpeta> guarda capturas. */
"use strict";
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const URL_PAGINA = pathToFileURL(path.join(__dirname, "..", "index.html")).href;

async function recorrido(navegador, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR" });
  const p = await contexto.newPage();
  const errores = [];
  p.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  p.on("pageerror", (e) => errores.push(String(e)));
  await p.goto(URL_PAGINA);
  assert.equal(await p.locator("main h2[id]").count(), 11);
  assert.equal(await p.locator("#toc-lateral li").count(), 11);
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(ancho <= viewport.width + 1, `scroll horizontal: ${ancho}`);
  assert.equal(await p.locator(".toc-lateral").isVisible(), !movil);
  if (movil) await p.click("details.toc-movil summary");
  await p.click(`${movil ? "#toc-movil" : "#toc-lateral"} a[data-id='hambre']`);
  await p.waitForFunction(() => location.hash === "#hambre");
  assert.equal(await p.locator("pre .copiar").count(), await p.locator("pre").count());
  assert.equal(await p.locator(".tabla table").count(), 12);

  const antes = await p.locator("#g-hilos polyline").getAttribute("points");
  assert.ok(antes && antes.split(" ").length >= 18, "el gráfico tiene puntos");
  await p.selectOption("#g-modo", "async");
  assert.notEqual(await p.locator("#g-hilos polyline").getAttribute("points"), antes);
  await p.locator("#g-ritmo").fill("3");
  assert.equal(await p.locator("#g-ritmo-v").textContent(), "800");
  await p.selectOption("#g-rt", "net10");
  assert.match(await p.locator("#g-resumen").textContent(), /hilos en el pool/);
  await p.selectOption("#g-modo", "result");
  if (process.env.CAPTURAS) await p.locator("#grafico").screenshot({ path: path.join(process.env.CAPTURAS, `async-grafico-${viewport.width}.png`) });

  await p.emulateMedia({ colorScheme: "dark" });
  assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(21, 23, 28)");
  assert.deepEqual(errores, [], "sin errores de consola");
  console.log(`  ok ${viewport.width}px`);
  await contexto.close();
}
(async () => {
  const navegador = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});
  try { await recorrido(navegador, { width: 360, height: 740 }, true); await recorrido(navegador, { width: 1280, height: 900 }, false); console.log("E2E OK"); }
  catch (e) { console.error("E2E FALLÓ:", e); process.exitCode = 1; }
  finally { await navegador.close(); }
})();
