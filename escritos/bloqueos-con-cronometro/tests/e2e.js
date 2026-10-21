/* Recorrido en Chromium headless con Playwright, a 360 px y 1280 px: índice generado, navegación por
   secciones, sección activa, copiar un bloque, las dos ventanas lado a lado en escritorio y apiladas en
   el celular, modo oscuro, sin scroll horizontal ni errores de consola ni pedidos afuera.
   Correr desde la raíz del repo: node escritos/bloqueos-con-cronometro/tests/e2e.js */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".sql": "text/plain; charset=utf-8" };
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
async function probar(browser, url, viewport, oscuro) {
  const nombre = `${viewport.width}×${viewport.height}${oscuro ? " oscuro" : ""}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR", colorScheme: oscuro ? "dark" : "light", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); const errores = []; const afuera = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) afuera.push(r.url()); });
  await page.goto(url); await page.waitForSelector("#toc-lateral li", { state: "attached" });
  assert.equal(await page.locator("#toc-lateral li").count(), 13, "13 entradas en el índice");
  assert.equal(await page.locator("#toc-movil li").count(), 13);
  const movil = viewport.width < 960;
  assert.equal(await page.locator("nav.toc-lateral").isVisible(), !movil, "índice lateral solo en escritorio");
  assert.equal(await page.locator("details.toc-movil").isVisible(), movil, "índice desplegable solo en el celular");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal");
  // Las dos ventanas: lado a lado en escritorio, apiladas en el celular.
  const cajas = await page.locator("#bloqueo ~ .ventanas").first().locator("pre").evaluateAll((ps) => ps.map((p) => p.getBoundingClientRect().top));
  assert.equal(cajas.length, 2); assert.equal(Math.abs(cajas[0] - cajas[1]) < 2, !movil, "ventanas lado a lado solo en escritorio");
  // Navegar a un capítulo por el índice y ver que queda activo.
  if (movil) await page.click("details.toc-movil summary");
  await page.click(`${movil ? "#toc-movil" : "#toc-lateral"} a[data-id=deadlock]`);
  await page.waitForFunction(() => document.getElementById("deadlock").getBoundingClientRect().top < 200, null, { timeout: 10000 }); await page.waitForTimeout(400);
  assert.ok((await page.locator("nav.toc a[data-id=deadlock]").first().getAttribute("class") || "").includes("activo"), "sección activa");
  assert.ok(await page.locator("#deadlock").evaluate((h) => h.getBoundingClientRect().top < 200), "el capítulo quedó arriba");
  // Copiar un bloque.
  const pre = page.locator("#deadlock ~ pre").first(); await pre.hover(); await pre.locator("button.copiar").click();
  assert.ok(await page.locator("#toast").evaluate((t) => t.classList.contains("visible")), "toast de copiado");
  if (!movil) assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes("<victim-list>"), "se copió el grafo del deadlock");
  // Tablas con scroll propio, no de la página.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal al final");
  const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(fondo === "rgb(21, 23, 28)", oscuro, `fondo ${fondo}`);
  assert.deepEqual(errores, [], `errores en consola: ${errores.join(" | ")}`);
  assert.deepEqual(afuera, [], "no pide nada afuera");
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => {
  const { srv, url } = await servir(); const browser = await chromium.launch();
  try {
    await probar(browser, url, { width: 360, height: 740 }, false);
    await probar(browser, url, { width: 1280, height: 800 }, false);
    await probar(browser, url, { width: 1280, height: 800 }, true);
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
