/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 y a 1280×720: la página
   carga sin errores, los presets cambian los resultados, el diagnóstico dice lo que tiene que decir en
   cada escenario, los gráficos se dibujan, "Otra tirada" cambia los números y el link copiado
   reproduce el escenario.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node experimentos/thread-pool-en-vivo/tests/e2e.js */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const RAIZ = path.join(__dirname, "..");
function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end("no está"); return; }
      res.writeHead(200, { "Content-Type": archivo.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" });
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
  await esperar(300);

  const sinScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(sinScroll, `sin scroll horizontal (${nombre})`);
  for (const b of await page.locator("button, select, input[type=number]").all()) {
    const c = await b.boundingBox(); if (c) assert.ok(c.height >= 36, "controles de al menos 36 px");
  }
  // La página recalcula en el próximo frame: se esperan dos antes de mirar.
  const estado = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => { const u = __sim(); return { zona: u.d.zona, titulo: u.d.titulo, p99: u.r.p99, hilosMax: u.r.hilosMax, colaMax: u.r.colaMax, tiles: document.getElementById("tP99").textContent }; }));

  // Arranca con el clásico: inanición.
  const e0 = await estado();
  assert.equal(e0.zona, "inanicion", "el preset inicial muestra inanición");
  assert.match(e0.titulo, /Inanición/);
  assert.equal(await page.getAttribute("button[data-preset=clasico]", "aria-pressed"), "true");
  assert.match(await page.textContent("#diag"), /gate thread/);
  assert.match(await page.textContent("#tRec"), /vuelve a cero/);

  // Async: ok y p99 chico.
  await page.click("button[data-preset=async]");
  const e1 = await estado();
  assert.equal(e1.zona, "ok"); assert.ok(e1.p99 < 150 && e1.hilosMax === 4, `async: p99 ${e1.p99}, hilos ${e1.hilosMax}`);
  assert.match(await page.textContent("#diag"), /punta a punta/);

  // .NET 8 con .Result: muchos hilos, p99 bajo.
  await page.click("button[data-preset=net8]");
  const e2 = await estado();
  assert.ok(e2.hilosMax >= 21 && e2.p99 < 400, `net8: hilos ${e2.hilosMax}, p99 ${e2.p99}`);
  assert.match(e2.titulo, /NET 6\+/);

  // Cambiar un control a mano desmarca el preset y recalcula.
  await page.fill("#ioMsN", "2000"); await page.dispatchEvent("#ioMsN", "input");
  await esperar(100);
  assert.equal(await page.getAttribute("button[data-preset=net8]", "aria-pressed"), "false", "el preset se desmarca");
  assert.equal(await page.textContent("#presetDesc"), "Escenario a medida.");
  const e3 = await estado();
  assert.ok(e3.hilosMax > e2.hilosMax, `con la base más lenta hacen falta más hilos (${e3.hilosMax} > ${e2.hilosMax})`);

  // Tráfico con ráfaga muestra el control; el pico bloqueando se traba.
  await page.click("button[data-preset=pico]");
  assert.ok(await page.isVisible("#ctlRafaga"), "aparece el control de la ráfaga");
  const e4 = await estado();
  assert.equal(e4.zona, "inanicion"); assert.match(e4.titulo, /ráfaga/i);
  assert.ok(e4.colaMax >= 290, `la ráfaga se encola (${e4.colaMax})`);
  await page.click("button[data-preset=clasico]");
  assert.ok(!(await page.isVisible("#ctlRafaga")), "se esconde el control de la ráfaga");

  // Gráficos dibujados (píxeles de color en los tres canvas).
  for (const id of ["gHilos", "gLat", "gGantt"]) {
    const pintado = await page.evaluate((id) => {
      const c = document.getElementById(id), ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 0 && Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2]) > 40) n++;
      return n;
    }, id);
    assert.ok(pintado > 200, `${id} tiene algo dibujado (${pintado})`);
  }
  const cajaGantt = await page.locator("#gGantt").boundingBox();
  assert.ok(cajaGantt.width <= viewport.width && cajaGantt.height >= 200, "el gantt entra en la pantalla");

  // Otra tirada cambia la semilla (y algún número).
  const antes = await estado();
  await page.click("#otraTirada");
  const despues = await estado();
  assert.ok(antes.p99 !== despues.p99 || antes.colaMax !== despues.colaMax, "otra tirada cambia los números");

  // Copiar link: el link reproduce el escenario.
  await contexto.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.click("#copiarLink");
  await esperar(100);
  const link = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
  if (link) {
    assert.match(link, /modoIo=result/);
    await page.goto(link); await esperar(200);
    const e5 = await estado();
    assert.equal(e5.p99, despues.p99, "el link reproduce la misma tirada");
  } else {
    await page.goto(url + "?nucleos=2&rps=100&ioMs=100&cpuMs=2&cpuDespuesMs=1&modoIo=sync&runtime=net6&minHilos=0&patron=constante&rafaga=300&duracionS=30&semilla=1");
    await esperar(200);
    assert.equal(await page.inputValue("#nucleosN"), "2", "la URL carga el escenario");
  }

  // Las cuentas de servilleta están.
  assert.ok((await page.locator("#cuentas tr").count()) >= 8, "tabla de cuentas");
  assert.ok((await page.locator(".fuentes a").count()) >= 6, "fuentes con links");

  if (capturaEn) await page.screenshot({ path: capturaEn, fullPage: false });
  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  const capturas = process.env.CAPTURAS;
  try {
    await probar(browser, url, { width: 360, height: 740 }, capturas && path.join(capturas, "tp-360.png"));
    await probar(browser, url, { width: 1280, height: 720 }, capturas && path.join(capturas, "tp-1280.png"));
    console.log("Thread pool en vivo: todo ok");
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
