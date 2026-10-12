/* Prueba de la página de la guía en Chromium headless con Playwright, a 360 px y a 1280 px: carga sin
   errores de consola, el índice se arma con todos los capítulos y navega, el índice lateral solo
   aparece en escritorio y el desplegable solo en el celular, no hay scroll horizontal, los bloques de
   código tienen botón de copiar y todos los bloques "PostgreSQL" tienen su rótulo.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node escritos/postgres-desde-sqlserver/tests/e2e.js */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch (e) {
  console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const RAIZ = path.join(__dirname, "..");

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        res.writeHead(404); res.end("no está"); return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function esperarArriba(page, id) {
  // El scroll es suave: esperamos hasta 2,5 s a que la sección quede arriba de todo.
  for (let i = 0; i < 25; i++) {
    const top = await page.locator("#" + id).evaluate((el) => el.getBoundingClientRect().top);
    if (top >= -5 && top < 120) return top;
    await page.waitForTimeout(100);
  }
  return page.locator("#" + id).evaluate((el) => el.getBoundingClientRect().top);
}

async function probar(browser, url, viewport) {
  const nombre = `${viewport.width} px`;
  const contexto = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(url);

  const secciones = await page.locator("main section[id]").count();
  assert.ok(secciones >= 18, `hay al menos 18 secciones (${secciones})`);
  const sinScrollX = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(sinScrollX, `sin scroll horizontal (${nombre})`);

  const lateralVisible = await page.locator(".toc-lateral").isVisible();
  const movilVisible = await page.locator("details.toc-movil").isVisible();
  if (viewport.width >= 960) {
    assert.ok(lateralVisible && !movilVisible, "en escritorio se ve el índice lateral y no el desplegable");
    assert.equal(await page.locator("#toc-lateral a").count(), secciones, "el índice lateral tiene todos los capítulos");
    await page.locator("#toc-lateral a[data-id=transacciones]").click();
    const top = await esperarArriba(page, "transacciones");
    assert.ok(top >= -5 && top < 120, `el índice lleva al capítulo (top=${Math.round(top)})`);
    await page.waitForTimeout(300);
    assert.ok(await page.locator("#toc-lateral a.activo").count() >= 1, "se marca la sección activa");
  } else {
    assert.ok(!lateralVisible && movilVisible, "en el celular se ve el desplegable y no el índice lateral");
    const resumen = page.locator("details.toc-movil summary");
    const caja = await resumen.boundingBox();
    assert.ok(caja.height >= 24, "el resumen del índice se puede tocar");
    await resumen.click();
    assert.equal(await page.locator("#toc-movil a").count(), secciones, "el índice del celular tiene todos los capítulos");
    await page.locator("#toc-movil a[data-id=json]").click();
    assert.ok(!(await page.locator("details.toc-movil").evaluate((d) => d.open)), "el desplegable se cierra al elegir");
    const top = await esperarArriba(page, "json");
    assert.ok(top >= -5 && top < 120, `el índice lleva al capítulo (top=${Math.round(top)})`);
  }

  // Bloques de código: cada uno con rótulo y con botón de copiar; los de Postgres son los que corre correr-sql.js
  const pres = await page.locator("pre").count();
  assert.equal(await page.locator("pre .copiar").count(), pres, "todos los bloques tienen botón de copiar");
  const pg = await page.locator("pre.sql.pg:not(.ref)").count();
  assert.ok(pg >= 30, `hay al menos 30 bloques PostgreSQL ejecutables (${pg})`);
  const rotulos = await page.locator("pre.sql.pg").evaluateAll((els) => els.every((e) => (e.dataset.rotulo || "").startsWith("PostgreSQL")));
  assert.ok(rotulos, "todos los bloques pg dicen PostgreSQL");
  const anchoCodigo = await page.locator("pre").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().width <= innerWidth));
  assert.ok(anchoCodigo, "ningún bloque de código se sale de la pantalla");

  // Botón de copiar: cambia el texto (en headless puede no haber portapapeles; igual no debe tirar error)
  await page.locator("pre").first().hover();
  await page.locator("pre .copiar").first().click();
  let texto = "";
  for (let i = 0; i < 10 && !["Copiado", "No se pudo"].includes(texto); i++) {
    await page.waitForTimeout(100);
    texto = await page.locator("pre .copiar").first().textContent();
  }
  assert.ok(["Copiado", "No se pudo"].includes(texto), `el botón de copiar responde (${texto})`);
  if (texto === "Copiado") {
    const portapapeles = await page.evaluate(() => navigator.clipboard.readText());
    assert.ok(portapapeles.startsWith("-- Toda la guía"), "lo copiado es el código del bloque, sin el botón");
  }

  // Volver arriba aparece al bajar
  await page.evaluate(() => scrollTo(0, 3000));
  let visibleArriba = false;
  for (let i = 0; i < 20 && !visibleArriba; i++) {   // el scroll es suave: puede tardar
    await page.waitForTimeout(100);
    visibleArriba = await page.locator("#arriba").evaluate((b) => b.classList.contains("visible"));
  }
  assert.ok(visibleArriba, "aparece el botón de volver arriba");

  // Tablas con scroll propio en el celular
  if (viewport.width < 700) {
    const tablasOk = await page.locator(".tabla-scroll").evaluateAll((els) => els.every((e) => e.scrollWidth >= e.clientWidth && e.getBoundingClientRect().width <= innerWidth));
    assert.ok(tablasOk, "las tablas anchas scrollean dentro de su caja");
  }

  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok  ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  try {
    await probar(browser, url, { width: 360, height: 740 });
    await probar(browser, url, { width: 1280, height: 800 });
    console.log("Todo bien.");
  } catch (e) {
    console.error("FALLÓ:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
