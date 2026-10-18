/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×640 (celular parado) y a
   1280×800 (compu). Recorre: carga sin errores de consola, canvas a pantalla completa sin scroll,
   estrellas que titilan, tocar una estrella la hace brillar con chispas, tocar un planeta lo hace
   girar, tocar el cohete lo hace despegar y pasa por todas las fases (encendido, subiendo, luna,
   bajando) hasta volver a la plataforma, la luna se pone contenta, tocar el cohete en vuelo hace
   chispas sin romper el viaje, deslizar el dedo deja estela, el botón y el teclado despegan, el
   sonido apagado queda guardado y la pestaña oculta pausa el juego.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node juegos/cohete/tests/e2e.js */
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
  const movil = viewport.width < 700;
  const contexto = await browser.newContext({ viewport, hasTouch: movil, isMobile: movil, locale: "es-AR" });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(url);
  await esperar(400);

  // El canvas ocupa toda la pantalla y no hay scroll.
  const caja = await page.locator("#cielo").boundingBox();
  assert.ok(caja.width >= viewport.width - 1 && caja.height >= viewport.height - 1, `canvas a pantalla completa (${nombre})`);
  const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
  assert.ok(sinScroll, `sin scroll (${nombre})`);
  for (const b of await page.locator(".botones button").all()) {
    const c = await b.boundingBox();
    assert.ok(c.height >= 44 && c.width >= 44, "botones de al menos 44 px");
  }

  const estado = () => page.evaluate(() => ({
    fase: __cohete.fase, alt: __cohete.alt, cam: __cohete.cam, tiempo: __cohete.tiempo, viajes: __cohete.viajes,
    estrellas: __cohete.estrellas.length, brillando: __cohete.estrellas.filter((e) => e.brillo > 0).length,
    chispas: __cohete.chispas.length, humo: __cohete.humo.length, estelas: __cohete.estelas.length,
    lunaFeliz: __cohete.luna.feliz, coheteChispa: __cohete.cohete.chispa, dedos: __cohete.dedos.size,
    planetasGirando: __cohete.planetas.filter((p) => p.giro > 0).length,
  }));
  const esperarFase = async (fase, maxMs) => {
    for (let i = 0; i < maxMs / 100; i++) { if ((await estado()).fase === fase) return true; await esperar(100); }
    return false;
  };

  // Cielo con estrellas, dos planetas a la vista, cohete en la plataforma.
  const e0 = await estado();
  assert.ok(e0.estrellas >= 40, `hay estrellas (${e0.estrellas})`);
  assert.equal(e0.fase, "lista", "el cohete arranca en la plataforma");
  const planetasVisibles = await page.evaluate(() => __cohete.planetas.filter((p) => { const y = __cohete.pantallaY(p.alt, p.d); return y > 40 && y < __cohete.suelo; }).length);
  assert.ok(planetasVisibles >= 2, `dos planetas a la vista (${planetasVisibles})`);

  // Tocar una estrella lejos de todo lo demás: brilla y tira chispas.
  const estrella = await page.evaluate(() => {
    const lejos = (x, y) => __cohete.planetas.every((p) => Math.hypot(x - p.x * __cohete.W, y - __cohete.pantallaY(p.alt, p.d)) > p.r * 2 + 30)
      && Math.abs(x - __cohete.cohete.x * __cohete.W) > 80 && (!__cohete.ovni || Math.hypot(x - __cohete.ovni.x * __cohete.W, y - __cohete.pantallaY(__cohete.ovni.alt, __cohete.ovni.d)) > 80);
    for (const e of __cohete.estrellas) {
      const x = e.x * __cohete.W, y = __cohete.pantallaY(e.alt, e.d);
      if (y > 90 && y < __cohete.suelo - 120 && x > 30 && x < __cohete.W - 30 && lejos(x, y)) return { x, y };
    }
    return null;
  });
  assert.ok(estrella, "hay una estrella para tocar");
  await page.mouse.click(estrella.x, estrella.y);
  const e1 = await estado();
  assert.ok(e1.brillando >= 1, "la estrella tocada brilla");
  assert.ok(e1.chispas >= 3, `salen chispas (${e1.chispas})`);

  // Tocar un planeta: gira y rebota.
  const planeta = await page.evaluate(() => { const p = __cohete.planetas[0]; return { x: p.x * __cohete.W, y: __cohete.pantallaY(p.alt, p.d) }; });
  await page.mouse.click(planeta.x, planeta.y);
  assert.ok((await estado()).planetasGirando >= 1, "el planeta tocado gira");

  // Tocar el cielo vacío: nace una estrellita.
  const antesEstrellas = (await estado()).estrellas;
  const vacio = await page.evaluate(() => {
    for (let i = 0; i < 500; i++) {
      const x = 30 + Math.random() * (__cohete.W - 60), y = 90 + Math.random() * (__cohete.suelo - 220);
      const libre = __cohete.estrellas.every((e) => Math.hypot(x - e.x * __cohete.W, y - __cohete.pantallaY(e.alt, e.d)) > 50)
        && __cohete.planetas.every((p) => Math.hypot(x - p.x * __cohete.W, y - __cohete.pantallaY(p.alt, p.d)) > p.r * 2 + 40)
        && Math.abs(x - __cohete.cohete.x * __cohete.W) > 80 && !__cohete.ovni && !__cohete.cometa;
      if (libre) return { x, y };
    }
    return null;
  });
  if (vacio) {
    await page.mouse.click(vacio.x, vacio.y);
    assert.equal((await estado()).estrellas, antesEstrellas + 1, "tocar el cielo vacío crea una estrella");
  }

  // Deslizar el dedo: estela de estrella fugaz.
  await page.mouse.move(viewport.width * 0.2, viewport.height * 0.2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(viewport.width * (0.2 + i * 0.04), viewport.height * (0.2 + i * 0.015));
  const conDedo = await estado();
  assert.equal(conDedo.dedos, 1, "un dedo apoyado");
  assert.ok(conDedo.estelas >= 5, `deslizar deja estela (${conDedo.estelas})`);
  await page.mouse.up();
  assert.equal((await estado()).dedos, 0, "al soltar no queda ningún dedo");

  // Tocar el cohete: despega, sube, llega a la luna, baja con paracaídas y vuelve a la plataforma.
  const cohete = await page.evaluate(() => ({ x: __cohete.cohete.x * __cohete.W, y: __cohete.suelo - 30 }));
  await page.mouse.click(cohete.x, cohete.y);
  const e2 = await estado();
  assert.equal(e2.fase, "encendido", "tocar el cohete enciende el motor");
  assert.equal(e2.viajes, 1);
  assert.ok(await esperarFase("subiendo", 3000), "después del encendido sube");
  await esperar(500);
  const e3 = await estado();
  assert.ok(e3.alt > 0 && e3.humo > 0, `sube y deja humo (alt ${Math.round(e3.alt)}, humo ${e3.humo})`);
  // En vuelo, tocar el cohete hace chispas pero no interrumpe nada.
  const enVuelo = await page.evaluate(() => ({ x: __cohete.cohete.x * __cohete.W, y: __cohete.pantallaY(__cohete.alt, 1) - 40 }));
  await page.mouse.click(enVuelo.x, enVuelo.y);
  const e4 = await estado();
  assert.ok(e4.coheteChispa > 0, "tocarlo en vuelo hace chispas");
  assert.equal(e4.fase, "subiendo", "y sigue subiendo");
  assert.ok(await esperarFase("luna", 15000), "llega a la luna");
  const e5 = await estado();
  assert.ok(e5.lunaFeliz > 0, "la luna se pone contenta");
  assert.ok(e5.cam > 0, "la cámara siguió al cohete");
  const lunaVisible = await page.evaluate(() => { const y = __cohete.pantallaY(__cohete.luna.alt, 1); return y > 0 && y < __cohete.H * 0.6; });
  assert.ok(lunaVisible, "la luna está en pantalla");
  assert.ok(await esperarFase("bajando", 6000), "después baja");
  assert.ok(await esperarFase("lista", 20000), "vuelve a la plataforma");
  const e6 = await estado();
  assert.equal(e6.alt, 0); assert.equal(e6.cam, 0);

  // Botón de despegar: otro viaje. Y en la compu, espacio también.
  await page.click("#despegar");
  assert.equal((await estado()).fase, "encendido", "el botón despega");
  assert.equal((await estado()).viajes, 2);
  if (!movil) {
    // Mientras vuela, espacio no rompe nada: hace bip y chispas.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("Space");
    assert.ok((await estado()).coheteChispa > 0, "espacio durante el vuelo hace chispas");
    // Una letra cualquiera hace brillar una estrella.
    await page.keyboard.press("a");
    assert.ok((await estado()).brillando >= 1, "una letra hace brillar una estrella");
  }
  assert.ok(await esperarFase("lista", 30000), "el segundo viaje también vuelve");
  if (!movil) {
    await page.keyboard.press("Enter");
    assert.equal((await estado()).fase, "encendido", "Enter despega");
    assert.equal((await estado()).viajes, 3);
  }

  // Sonido: se apaga y queda guardado al recargar.
  await page.click("#sonido");
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "sonido apagado");
  await page.reload();
  await esperar(300);
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "el sonido apagado se recuerda");
  if (!movil) {
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press("m");
    assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "true", "la tecla M lo vuelve a prender");
  } else {
    await page.click("#sonido");
    assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "true", "sonido prendido de nuevo");
  }

  // Dos dedos a la vez (solo táctil): dos estrellas suenan.
  if (movil) {
    const cdp = await contexto.newCDPSession(page);
    const pts = await page.evaluate(() => {
      const r = [];
      for (const e of __cohete.estrellas) {
        const x = e.x * __cohete.W, y = __cohete.pantallaY(e.alt, e.d);
        if (y > 90 && y < __cohete.suelo - 130 && Math.abs(x - __cohete.cohete.x * __cohete.W) > 70 && r.every((q) => Math.hypot(q.x - x, q.y - y) > 120)
          && __cohete.planetas.every((p) => Math.hypot(x - p.x * __cohete.W, y - __cohete.pantallaY(p.alt, p.d)) > p.r * 2 + 30)) r.push({ x, y });
        if (r.length === 2) break;
      }
      return r;
    });
    assert.equal(pts.length, 2, "dos estrellas separadas para tocar");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts });
    await esperar(50);
    const dos = await estado();
    assert.equal(dos.dedos, 2, "dos dedos apoyados a la vez");
    assert.ok(dos.brillando >= 2, `dos estrellas brillan (${dos.brillando})`);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await esperar(50);
    assert.equal((await estado()).dedos, 0, "al soltar no queda ningún dedo");
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
    await probar(browser, url, { width: 360, height: 640 }, capturas && path.join(capturas, "cohete-360.png"));
    await probar(browser, url, { width: 1280, height: 800 }, capturas && path.join(capturas, "cohete-1280.png"));
    console.log("Cohete: todo ok");
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
