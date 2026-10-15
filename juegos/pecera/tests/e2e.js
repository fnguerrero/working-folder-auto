/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 (celular parado) y a
   1280×720 (compu). Recorre: carga sin errores de consola, el canvas ocupa toda la pantalla sin
   scroll, hay peces nadando, tocar el agua tira comida y los peces se la comen, tocar un pez lo hace
   girar, el botón suma peces, el sonido se apaga y queda guardado, el teclado tira comida y la
   pestaña oculta pausa el bucle.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node juegos/pecera/tests/e2e.js */
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

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function probar(browser, url, viewport, capturaEn) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const contexto = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(url);
  await esperar(400);

  // El canvas ocupa toda la pantalla y no hay scroll.
  const caja = await page.locator("#agua").boundingBox();
  assert.ok(caja.width >= viewport.width - 1 && caja.height >= viewport.height - 1, `canvas a pantalla completa (${nombre})`);
  const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
  assert.ok(sinScroll, `sin scroll (${nombre})`);
  for (const b of await page.locator(".botones button").all()) {
    const c = await b.boundingBox();
    assert.ok(c.height >= 44 && c.width >= 44, "botones de al menos 44 px");
  }

  // Hay peces y se mueven solos.
  const estado = () => page.evaluate(() => ({
    peces: __pecera.peces.map((p) => ({ x: p.x, y: p.y, giro: p.giro, felicidad: p.felicidad })),
    comidas: __pecera.comidas.filter((c) => c.comida).length,
    burbujas: __pecera.burbujas.length,
    arena: __pecera.arena, tiempo: __pecera.tiempo, cangrejo: { x: __pecera.cangrejo.x, pinza: __pecera.cangrejo.pinza },
  }));
  const e0 = await estado();
  assert.ok(e0.peces.length >= 5 && e0.peces.length <= 8, `entre 5 y 8 peces al arrancar (${nombre}: ${e0.peces.length})`);
  await esperar(600);
  const e1 = await estado();
  const movidos = e1.peces.filter((p, i) => Math.hypot(p.x - e0.peces[i].x, p.y - e0.peces[i].y) > 2).length;
  assert.ok(movidos >= e1.peces.length - 1, `los peces nadan solos (${movidos}/${e1.peces.length})`);
  for (const p of e1.peces) {
    assert.ok(p.x >= 0 && p.x <= viewport.width && p.y >= 0 && p.y < e1.arena, `pez dentro del agua (${nombre})`);
  }

  // Tocar el agua lejos de todo: cae comida y algún pez se la come.
  const lejos = await page.evaluate(() => {
    // Un punto del agua a más de 40 px de cualquier pez y burbuja.
    for (let i = 0; i < 400; i++) {
      const x = 30 + Math.random() * (innerWidth - 60), y = innerHeight * 0.3 + Math.random() * innerHeight * 0.3;
      const libre = __pecera.peces.every((p) => Math.hypot(p.x - x, p.y - y) > 60) && __pecera.burbujas.every((b) => Math.hypot(b.x - x, b.y - y) > 40);
      if (libre) return { x, y };
    }
    return null;
  });
  assert.ok(lejos, "hay un lugar libre para tocar");
  await page.mouse.click(lejos.x, lejos.y);
  const e2 = await estado();
  assert.ok(e2.comidas >= 2, `tocar el agua tira comida (${e2.comidas})`);
  let comida = false;
  for (let i = 0; i < 60 && !comida; i++) {
    await esperar(250);
    const e = await estado();
    if (e.comidas < e2.comidas) comida = true;
  }
  assert.ok(comida, "algún pez se comió la comida en menos de 15 s");

  // Tocar un pez: da una vuelta.
  const pez = await page.evaluate(() => { const p = __pecera.peces[0]; return { x: p.x, y: p.y }; });
  await page.mouse.click(pez.x, pez.y);
  const e3 = await estado();
  assert.ok(e3.peces[0].giro > 0 || e3.peces[0].felicidad > 0, "el pez tocado gira");

  // Tocar el cangrejo: cierra la pinza.
  const cang = await page.evaluate(() => ({ x: __pecera.cangrejo.x, y: __pecera.arena - 10 }));
  await page.mouse.click(cang.x, cang.y);
  const e4 = await estado();
  assert.ok(e4.cangrejo.pinza > 0, "el cangrejo cierra la pinza");

  // Un pez más con el botón y con el teclado.
  const antes = e4.peces.length;
  await page.click("#masPeces");
  await page.keyboard.press("p");
  const e5 = await estado();
  assert.equal(e5.peces.length, antes + 2, "el botón y la tecla P suman un pez");
  for (let i = 0; i < 10; i++) await page.click("#masPeces");
  const e6 = await estado();
  assert.ok(e6.peces.length <= 14, `nunca más de 14 peces (${e6.peces.length})`);

  // Espacio tira comida.
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const c0 = (await estado()).comidas;
  await page.keyboard.press("Space");
  assert.ok((await estado()).comidas > c0, "la barra espaciadora tira comida");

  // Sonido: se apaga y queda guardado al recargar.
  await page.click("#sonido");
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "sonido apagado");
  await page.reload();
  await esperar(300);
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "el sonido apagado se recuerda");
  await page.click("#sonido");
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "true", "sonido prendido de nuevo");

  // Varios dedos a la vez (solo táctil): los peces van hacia el dedo apoyado.
  if (viewport.width < 700) {
    const cdp = await contexto.newCDPSession(page);
    const pts = [{ x: viewport.width * 0.5, y: viewport.height * 0.4 }, { x: viewport.width * 0.25, y: viewport.height * 0.5 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts });
    await esperar(50);
    const dedos = await page.evaluate(() => __pecera.dedos.size);
    assert.equal(dedos, 2, "dos dedos apoyados a la vez");
    const __n = await page.evaluate(() => __pecera.peces.length);
    // Primero comen lo que cayó con el toque y después se quedan curioseando cerca de los dedos.
    const cerca = (ps) => page.evaluate((ps) => __pecera.peces.filter((q) => ps.some((p) => Math.hypot(q.x - p.x, q.y - p.y) < 170)).length, ps);
    let cercanos = 0;
    for (let i = 0; i < 24; i++) { await esperar(250); cercanos = await cerca(pts); if (cercanos >= Math.ceil(__n / 2)) break; }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await esperar(50);
    assert.equal(await page.evaluate(() => __pecera.dedos.size), 0, "al soltar no queda ningún dedo");
    assert.ok(cercanos >= Math.ceil(__n / 2), `los peces se acercan a los dedos (${cercanos}/${__n} a menos de 170 px)`);
  }

  // Pestaña oculta: el tiempo del juego no avanza.
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const t0 = (await estado()).tiempo;
  await esperar(300);
  assert.equal((await estado()).tiempo, t0, "con la pestaña oculta se pausa");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await esperar(300);
  assert.ok((await estado()).tiempo > t0, "al volver sigue");

  if (capturaEn) await page.screenshot({ path: capturaEn });
  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  const capturas = process.env.CAPTURAS;
  try {
    await probar(browser, url, { width: 360, height: 740 }, capturas && path.join(capturas, "pecera-360.png"));
    await probar(browser, url, { width: 1280, height: 720 }, capturas && path.join(capturas, "pecera-1280.png"));
    console.log("Pecera: todo ok");
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
