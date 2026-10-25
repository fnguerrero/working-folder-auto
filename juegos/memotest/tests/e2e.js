/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 (celular parado) y a
   1280×720 (compu). Recorre: carga sin errores de consola ni pedidos afuera, el tablero entra sin
   scroll con cartas de al menos 72 px en los tres tamaños, dar vuelta una carta hace sonar su animal,
   dos distintas se cierran solas al segundo, un par queda abierto y festeja, un tercer toque no espera
   el segundo, al terminar hay confeti y un botón grande para jugar de nuevo, el tamaño y el sonido
   apagado se recuerdan al recargar, el teclado anda, dos dedos a la vez dan vuelta dos cartas (con
   eventos táctiles de CDP) y la pestaña oculta pausa el confeti.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node juegos/memotest/tests/e2e.js */
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

async function probar(browser, url, viewport, capturas) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const tactil = viewport.width < 700;
  const contexto = await browser.newContext({ viewport, hasTouch: tactil, locale: "es-AR" });
  const page = await contexto.newPage();
  const errores = [], afuera = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) afuera.push(r.url()); });
  await page.goto(url);
  await esperar(600);

  const estado = () => page.evaluate(() => __memotest.estado());
  const caja = (i) => page.locator(".carta").nth(i).boundingBox();
  const centro = async (i) => { const c = await caja(i); return { x: c.x + c.width / 2, y: c.y + c.height / 2 }; };
  // Toca una carta como lo haría un dedo (o el mouse en la compu).
  const tocar = async (i) => { const p = await centro(i); if (tactil) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); };
  // Índices de una pareja y de dos cartas distintas, entre las que siguen cerradas.
  const elegir = async () => {
    const e = await estado();
    const cerradas = e.cartas.map((c, i) => ({ ...c, i })).filter((c) => !c.encontrada && !c.abierta);
    const a = cerradas[0];
    const par = cerradas.find((c) => c.i !== a.i && c.animal === a.animal);
    const otra = cerradas.find((c) => c.animal !== a.animal);
    return { a: a.i, par: par.i, otra: otra && otra.i };
  };

  // Tablero entero en pantalla, sin scroll, con cartas grandes, en los tres tamaños.
  const revisarTablero = async (pares) => {
    const e = await estado();
    assert.equal(e.cartas.length, pares * 2, `${pares * 2} cartas con ${pares} pares (${nombre})`);
    assert.ok(e.cartas.every((c) => !c.abierta && !c.encontrada), "todas arrancan boca abajo");
    const cuenta = {}; for (const c of e.cartas) cuenta[c.animal] = (cuenta[c.animal] || 0) + 1;
    assert.equal(Object.keys(cuenta).length, pares, "un animal distinto por par");
    assert.ok(Object.values(cuenta).every((n) => n === 2), "cada animal aparece dos veces");
    const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
    assert.ok(sinScroll, `sin scroll (${nombre}, ${pares} pares)`);
    for (let i = 0; i < pares * 2; i++) {
      const c = await caja(i);
      assert.ok(c.width >= 72 && c.height >= 72, `cartas de al menos 72 px (${nombre}, ${pares} pares: ${Math.round(c.width)}×${Math.round(c.height)})`);
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.width <= viewport.width + 1 && c.y + c.height <= viewport.height + 1, `la carta ${i} entra en la pantalla (${nombre})`);
    }
  };
  await revisarTablero(4);
  for (const b of await page.locator(".botones button").all()) {
    const c = await b.boundingBox();
    assert.ok(c.height >= 44 && c.width >= 44, "botones de al menos 44 px");
  }
  assert.equal(await page.getAttribute(".tamanos button[data-pares='4']", "aria-pressed"), "true", "arranca con 4 pares");
  if (capturas) await page.screenshot({ path: path.join(capturas, `memotest-${viewport.width}-inicio.png`) });

  // Los ocho animales tienen dibujo y sonido propios.
  const animales = await page.evaluate(() => __memotest.animales);
  assert.deepEqual(animales.slice().sort(), ["chancho", "gato", "leon", "oveja", "pajarito", "pato", "perro", "vaca"], "los ocho animales del issue");
  for (const a of animales) assert.ok(await page.evaluate((a) => __memotest.tieneSonido(a), a), `${a} tiene su sonido`);

  // Dar vuelta una carta: se abre y suena su animal.
  let { a, par, otra } = await elegir();
  await tocar(a);
  let e = await estado();
  assert.ok(e.cartas[a].abierta, "la carta tocada se da vuelta");
  assert.equal(e.sonidos.at(-1), e.cartas[a].animal, "suena el animal de la carta");
  assert.notEqual(e.audio, "sin crear", "el primer toque crea el audio");
  assert.match(await page.locator(".carta").nth(a).getAttribute("aria-label"), /^Carta \d+: /, "la etiqueta dice qué animal es");
  assert.ok(await page.locator("#ayuda").evaluate((el) => el.classList.contains("oculta")), "la ayuda se va con el primer toque");

  // Dos distintas: se cierran solas al segundo.
  await tocar(otra);
  e = await estado();
  assert.equal(e.abiertas.length, 2, "dos cartas abiertas");
  await esperar(700);
  assert.ok((await estado()).cartas[otra].abierta, "todavía abiertas antes del segundo");
  await esperar(600);
  e = await estado();
  assert.ok(!e.cartas[a].abierta && !e.cartas[otra].abierta && e.abiertas.length === 0, "se cierran solas al segundo");

  // Un par: quedan abiertas, festejan y salen chispas.
  await tocar(a); await tocar(par);
  e = await estado();
  assert.ok(e.cartas[a].encontrada && e.cartas[par].encontrada, "el par queda encontrado");
  await esperar(500);
  e = await estado();
  assert.ok(e.particulas > 0, "salen chispas");
  assert.equal(e.sonidos.at(-1), "par", "suena el festejo");
  assert.ok(await page.locator(".carta").nth(a).evaluate((el) => el.classList.contains("festeja")), "la carta festeja");
  await esperar(1300);
  e = await estado();
  assert.ok(e.cartas[a].abierta && e.cartas[par].abierta, "el par sigue abierto");
  // Tocar una ya encontrada la vuelve a hacer sonar, sin cerrarla.
  await tocar(a);
  e = await estado();
  assert.ok(e.cartas[a].encontrada && e.cartas[a].abierta && e.sonidos.at(-1) === e.cartas[a].animal, "una encontrada vuelve a sonar y sigue abierta");

  // Con dos distintas abiertas, un tercer toque no espera: cierra las dos y abre la nueva.
  ({ a, otra } = await elegir());
  await tocar(a); await tocar(otra);
  const tercera = (await estado()).cartas.findIndex((c, i) => !c.encontrada && i !== a && i !== otra);
  await tocar(tercera);
  e = await estado();
  assert.ok(!e.cartas[a].abierta && !e.cartas[otra].abierta && e.cartas[tercera].abierta, "el tercer toque cierra las dos y abre la nueva");
  assert.deepEqual(e.abiertas, [tercera]);
  await esperar(1200);
  assert.ok((await estado()).cartas[tercera].abierta, "la nueva no se cierra sola");

  // Terminar la partida: confeti, baile y botón grande para jugar de nuevo.
  const terminar = async () => {
    for (;;) {
      const s = await estado();
      const quedan = s.cartas.map((c, i) => ({ ...c, i })).filter((c) => !c.encontrada);
      if (!quedan.length) break;
      const x = quedan[0], y = quedan.find((c) => c.i !== x.i && c.animal === x.animal);
      if (!x.abierta) await tocar(x.i);
      await tocar(y.i);
    }
  };
  await terminar();
  e = await estado();
  assert.ok(e.terminado, "partida terminada");
  await esperar(1500);
  e = await estado();
  assert.ok(e.particulas > 40 && e.corriendo, `confeti al terminar (${e.particulas})`);
  assert.equal(e.sonidos.at(-1), "final", "suena el festejo final");
  await page.locator("#otraVez").waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  assert.ok(await page.locator("#otraVez").isVisible(), "aparece el botón para jugar de nuevo");
  const bOtra = await page.locator("#otraVez").boundingBox();
  assert.ok(bOtra.height >= 90 && bOtra.width >= 200, `el botón es grande (${Math.round(bOtra.width)}×${Math.round(bOtra.height)})`);
  assert.equal((await page.locator(".carta.baila").count()), 8, "las cartas bailan");
  if (capturas) await page.screenshot({ path: path.join(capturas, `memotest-${viewport.width}-final.png`) });

  // Pestaña oculta: el confeti se pausa; al volver sigue.
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await esperar(100);
  const t0 = (await estado()).tiempo;
  await esperar(300);
  assert.equal((await estado()).tiempo, t0, "con la pestaña oculta el confeti se pausa");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await esperar(300);
  assert.ok((await estado()).tiempo > t0, "al volver sigue");

  await page.click("#otraVez");
  e = await estado();
  assert.ok(!e.terminado && e.cartas.every((c) => !c.abierta), "jugar de nuevo reparte cartas nuevas boca abajo");
  assert.ok(await page.locator("#final").isHidden(), "el botón se va");

  // Tamaños: 6 y 8 pares, con cartas grandes; el elegido se recuerda al recargar.
  await page.click(".tamanos button[data-pares='6']");
  await esperar(1000); // que termine la animación de repartir
  await revisarTablero(6);
  await page.click(".tamanos button[data-pares='8']");
  await esperar(1000);
  await revisarTablero(8);
  if (capturas) {
    await tocar(0); await tocar(1); await tocar(2);
    await esperar(500);
    await page.screenshot({ path: path.join(capturas, `memotest-${viewport.width}-8pares.png`) });
  }
  await page.reload();
  await esperar(600);
  assert.equal((await estado()).pares, 8, "el tamaño se recuerda al recargar");
  // Con 8 pares salen los ocho animales y cada uno suena al terminar.
  await terminar();
  e = await estado();
  for (const an of animales) assert.ok(e.sonidos.includes(an), `sonó ${an}`);
  await page.keyboard.press("4");
  await esperar(1000);
  await revisarTablero(4);

  // Teclado: flechas para moverse, Enter da vuelta la carta enfocada.
  await page.locator(".carta").nth(0).focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.i), "1", "la flecha mueve el foco");
  await page.keyboard.press("Enter");
  assert.ok((await estado()).cartas[1].abierta, "Enter da vuelta la carta enfocada");
  await page.keyboard.press("ArrowDown");
  const cols = (await estado()).cols;
  if (cols < 8) assert.equal(await page.evaluate(() => document.activeElement.dataset.i), String(1 + cols), "la flecha abajo baja una fila");

  // Sonido: se apaga, queda guardado al recargar y la tecla M lo vuelve a prender.
  await page.click("#sonido");
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "sonido apagado");
  await page.reload();
  await esperar(500);
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "false", "el sonido apagado se recuerda");
  ({ a } = await elegir());
  await tocar(a);
  e = await estado();
  assert.equal(e.conSonido.at(-1), false, "apagado no suena");
  assert.equal(e.audio, "sin crear", "apagado ni siquiera crea el audio");
  await page.keyboard.press("m");
  assert.equal(await page.getAttribute("#sonido", "aria-pressed"), "true", "la M lo vuelve a prender");

  // Varios dedos a la vez (solo táctil): dos dedos sobre una pareja la encuentran; sobre dos distintas, las dan vuelta.
  if (tactil) {
    await page.click(".tamanos button[data-pares='6']");
    await esperar(500);
    const cdp = await contexto.newCDPSession(page);
    const dedos = async (i, j) => {
      const p = await centro(i), q = await centro(j);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...p, id: 1 }, { ...q, id: 2 }] });
      await esperar(60);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await esperar(60);
    };
    ({ a, par, otra } = await elegir());
    await dedos(a, otra);
    e = await estado();
    assert.ok(e.cartas[a].abierta && e.cartas[otra].abierta, "dos dedos dan vuelta dos cartas a la vez");
    await esperar(1300);
    e = await estado();
    assert.ok(!e.cartas[a].abierta && !e.cartas[otra].abierta, "y se cierran solas");
    await dedos(a, par);
    e = await estado();
    assert.ok(e.cartas[a].encontrada && e.cartas[par].encontrada, "dos dedos sobre una pareja la encuentran");
  }

  assert.deepEqual(afuera, [], `sin pedidos afuera (${nombre})`);
  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  const capturas = process.env.CAPTURAS;
  try {
    await probar(browser, url, { width: 360, height: 740 }, capturas);
    await probar(browser, url, { width: 1280, height: 720 }, capturas);
    console.log("Memotest: todo ok");
  } finally {
    await browser.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
