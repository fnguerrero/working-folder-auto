/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 (celular parado) y a
   1280×720 (compu). Recorre: carga sin errores de consola, las ocho láminas visibles y con tamaño
   para dedos, tocar con el mouse, deslizar (glissando), teclado, cambio de timbre guardado en
   localStorage, canción que arranca y se corta, y que los adornos se limpian solos.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node juegos/xilofon/tests/e2e.js */
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

async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const contexto = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(url);

  // Ocho láminas, todas visibles, sin scroll y con tamaño para dedos chicos.
  const laminas = page.locator(".tecla");
  assert.equal(await laminas.count(), 8, "ocho láminas");
  const cajas = [];
  for (let i = 0; i < 8; i++) {
    const b = await laminas.nth(i).boundingBox();
    assert.ok(b && b.width >= 44 && b.height >= 44, `lámina ${i} con al menos 44 px (${nombre})`);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width + 1 && b.y + b.height <= viewport.height + 1,
      `lámina ${i} dentro de la pantalla (${nombre})`);
    cajas.push(b);
  }
  // En vertical se apilan y se acortan hacia abajo; en apaisado van una al lado de la otra y se acortan a la derecha.
  if (viewport.height > viewport.width) {
    assert.ok(cajas[7].y > cajas[0].y && cajas[7].width < cajas[0].width, "vertical: apiladas y la última más corta");
  } else {
    assert.ok(cajas[7].x > cajas[0].x && cajas[7].height < cajas[0].height, "apaisado: en fila y la última más baja");
  }
  const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
  assert.ok(sinScroll, `sin scroll (${nombre})`);

  // Botones de arriba con tamaño táctil.
  for (const b of await page.locator(".botones button").all()) {
    const caja = await b.boundingBox();
    assert.ok(caja.height >= 44, "botón de al menos 44 px de alto");
  }

  // Tocar una lámina: se ilumina y aparece el bicho.
  const do4 = cajas[0];
  await page.mouse.move(do4.x + do4.width / 2, do4.y + do4.height / 2);
  await page.mouse.down();
  assert.ok(await laminas.nth(0).evaluate((el) => el.classList.contains("suena")), "la lámina se ilumina");
  assert.equal(await laminas.nth(0).locator(".bicho").count(), 1, "aparece el bicho");
  // Deslizar hasta la cuarta lámina sin soltar: glissando, suenan las intermedias.
  const fa = cajas[3];
  await page.mouse.move(fa.x + fa.width / 2, fa.y + fa.height / 2, { steps: 12 });
  await page.mouse.up();
  for (const i of [1, 2, 3]) {
    assert.ok(await laminas.nth(i).locator(".bicho").count() >= 1, `glissando pasó por la lámina ${i}`);
  }
  await page.waitForTimeout(250);
  assert.ok(!(await laminas.nth(0).evaluate((el) => el.classList.contains("suena"))), "se apaga sola");

  // Teclado: '8' y 'k' tocan el Do agudo; Enter sobre una lámina enfocada también suena.
  await page.keyboard.press("8");
  await page.keyboard.press("k");
  assert.equal(await laminas.nth(7).locator(".bicho").count(), 2, "teclas 8 y k");
  await laminas.nth(5).focus();
  await page.keyboard.press("Enter");
  assert.equal(await laminas.nth(5).locator(".bicho").count(), 1, "Enter sobre la lámina enfocada");

  // Los adornos se van solos cuando termina la animación.
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(".bicho, .estrella").count(), 0, "los adornos desaparecen");

  // Timbre: cambia el texto, se guarda y sobrevive a la recarga.
  const btnTimbre = page.locator("#btn-timbre");
  const antes = await btnTimbre.textContent();
  await btnTimbre.click();
  assert.notEqual(await btnTimbre.textContent(), antes, "cambia el timbre");
  await page.reload();
  assert.notEqual(await page.locator("#btn-timbre").textContent(), antes, "el timbre se recuerda");
  assert.equal(await page.evaluate(() => window.__xilofon.timbre()), "madera");
  await page.locator("#btn-timbre").click(); // vuelve a metal

  // Canción: ilumina láminas en orden, el botón late y se corta al tocarlo de nuevo (o con Esc).
  const estrellita = page.locator("[data-cancion=estrellita]");
  await estrellita.click();
  assert.ok(await estrellita.evaluate((el) => el.classList.contains("sonando")), "la canción arranca");
  await page.waitForTimeout(1300);
  assert.ok(await page.locator(".tecla").nth(0).locator(".bicho").count() >= 1, "Estrellita arranca en Do");
  await page.keyboard.press("Escape");
  assert.ok(!(await estrellita.evaluate((el) => el.classList.contains("sonando"))), "Esc la corta");
  const bichosAntes = await page.locator(".bicho").count();
  await page.waitForTimeout(600);
  assert.ok((await page.locator(".bicho").count()) <= bichosAntes, "cortada, no siguen apareciendo notas");
  await page.locator("[data-cancion=alegria]").click();
  await page.locator("[data-cancion=alegria]").click();
  assert.equal(await page.locator("[data-cancion].sonando").count(), 0, "tocar el botón de nuevo la corta");

  // Las tres canciones solo usan láminas que existen.
  const fueraDeRango = await page.evaluate(() => Object.values(window.__xilofon.CANCIONES)
    .flatMap((c) => c.notas.trim().split(/\s+/)).map((t) => t.split(":")[0]).filter((n) => n !== "-")
    .some((n) => !(Number(n) >= 0 && Number(n) <= 7)));
  assert.equal(fueraDeRango, false, "las canciones usan solo las ocho láminas");

  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok  ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  try {
    await probar(browser, url, { width: 360, height: 740 });
    await probar(browser, url, { width: 1280, height: 720 });
    console.log("Todo bien.");
  } catch (e) {
    console.error("FALLÓ:", e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
