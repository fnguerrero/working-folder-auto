/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular) y a 1280 px.
   Recorre: carga con el preset inicial, cambio de preset, sliders, distribución, cola máxima, otra tirada,
   parámetros por URL, recarga con lo guardado, copiar link, modo oscuro y tamaño de los controles.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node experimentos/colas-p99/tests/e2e.js */
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
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".md": "text/markdown" };

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        res.writeHead(404); res.end("no está"); return;
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

const aMs = (t) => { const m = /([\d.]+)\s*(ms|s)/.exec(t); return m ? parseFloat(m[1]) * (m[2] === "s" ? 1000 : 1) : NaN; };

async function recorrido(navegador, url, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR",
    permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const listo = () => pagina.waitForFunction(() => document.getElementById("t-p99").textContent !== "–");
  const zona = () => pagina.getAttribute("#main", "class");

  await pagina.goto(url);
  await listo();
  assert.equal(await pagina.getAttribute("#presets button:first-child", "aria-pressed"), "true", "preset inicial marcado");
  assert.equal(await pagina.inputValue("#in-c"), "8");
  assert.equal(await pagina.inputValue("#in-d"), "lognormal");
  assert.ok(await pagina.locator("#ctl-cv").isVisible() && !(await pagina.locator("#ctl-prob").isVisible()), "controles según distribución");
  assert.equal(await zona(), "zona-amarilla");
  assert.match(await texto("#t-util"), /^7\d%$/);
  assert.match(await texto("#diag h3"), /Zona amarilla: 75%/);
  assert.equal(await pagina.locator("#cmp tr").count(), 5, "tabla teoría vs simulación");
  const scrollAncho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollAncho <= viewport.width, `sin scroll horizontal (${scrollAncho})`);
  paso("carga con el preset API típica");

  const p99Antes = aMs(await texto("#t-p99"));
  await pagina.click("#presets button:nth-child(5)");
  await pagina.waitForFunction(() => document.getElementById("t-rech").textContent !== "0");
  assert.equal(await pagina.inputValue("#in-q"), "10");
  assert.match(await texto("#t-rech"), /%$/);
  assert.equal(await zona(), "zona-inestable");
  assert.match(await texto("#diag"), /se rechazó el \d+(\.\d+)?%/);
  assert.match(await texto("#cmp"), /suponen cola infinita/);
  paso("preset con cola máxima: rechazos y aviso");

  await pagina.click("#presets button:nth-child(3)");
  await pagina.waitForFunction(() => document.getElementById("in-c").value === "1");
  assert.equal(await pagina.inputValue("#in-d"), "exponencial");
  assert.equal(await pagina.locator("#cmp tr").count(), 6, "fila extra del p99 de la espera con exponencial");
  assert.equal(await zona(), "zona-amarilla");
  const filas = await texto("#cmp");
  assert.match(filas, /Utilización ρ 80% (7[6-9]|8[0-4])%/, "teoría y simulación cerca: " + filas);
  paso("preset un consumidor: M/M/1 al 80%, teoría ≈ simulación");

  await pagina.fill("#in-l", "1");
  await pagina.press("#in-l", "Enter");
  await pagina.waitForFunction(() => document.getElementById("main").className === "zona-verde");
  assert.match(await texto("#diag h3"), /Holgado: 20%/);
  assert.equal(await pagina.getAttribute("#presets button:nth-child(3)", "aria-pressed"), "false", "se desmarca el preset al tocar");
  assert.equal(await texto("#v-l"), "1 /s");
  paso("cambiar pedidos por segundo a mano");

  await pagina.selectOption("#in-d", "bimodal");
  await pagina.waitForFunction(() => document.getElementById("ctl-prob").offsetParent !== null);
  assert.ok(await pagina.locator("#ctl-factor").isVisible());
  await pagina.fill("#in-factor", "50");
  await pagina.press("#in-factor", "Enter");
  await pagina.waitForFunction(() => document.getElementById("v-factor").textContent === "×50");
  assert.ok(aMs(await texto("#t-p999")) > 500, "con lentos ×50 el p99,9 es grande aunque la carga sea baja");
  paso("distribución bimodal con sus controles");

  await pagina.fill("#in-c", "4");
  await pagina.press("#in-c", "Enter");
  await pagina.fill("#in-l", "31");
  await pagina.press("#in-l", "Enter");
  await pagina.fill("#in-s", "120");
  await pagina.press("#in-s", "Enter");
  await pagina.selectOption("#in-d", "exponencial");
  await pagina.waitForFunction(() => document.getElementById("main").className === "zona-roja" && document.getElementById("in-d").value === "exponencial");
  const titulo1 = await pagina.title();
  assert.match(titulo1, /^p99 .* al 93% · Por qué explota el p99$/, titulo1);
  const p99a = aMs(await texto("#t-p99"));
  await pagina.click("#btn-tirada");
  await pagina.waitForFunction((t) => document.title !== t, titulo1);
  const p99b = aMs(await texto("#t-p99"));
  assert.ok(p99a !== p99b && Math.abs(p99a - p99b) / p99a < 0.6, `otra tirada cambia pero no tanto: ${p99a} vs ${p99b}`);
  paso("otra tirada con otra semilla");

  await pagina.reload();
  await listo();
  assert.equal(await pagina.inputValue("#in-c"), "4");
  assert.equal(await pagina.inputValue("#in-l"), "31");
  assert.equal(await pagina.inputValue("#in-d"), "exponencial");
  paso("recarga con lo guardado");

  await pagina.goto(url + "?c=10&l=180&s=50&d=bimodal&p=5&f=20&q=0&n=5000&seed=9");
  await listo();
  assert.equal(await pagina.inputValue("#in-c"), "10");
  assert.equal(await pagina.inputValue("#in-s"), "50");
  assert.equal(await pagina.inputValue("#in-d"), "bimodal");
  assert.equal(await pagina.inputValue("#in-n"), "5000");
  assert.match(await texto("#t-util"), /^9\d%$/);
  paso("parámetros por URL");

  await pagina.click("#btn-link");
  await pagina.waitForSelector("#aviso.visible");
  if (!movil) {
    const link = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(link, /\?c=10&l=180&s=50&d=bimodal&q=0&n=5000&seed=9&p=5&f=20$/, link);
    paso("copiar link");
  } else {
    assert.match(await texto("#aviso"), /Link copiado|barra de direcciones/);
    paso("copiar link (avisa)");
  }

  const chicos = await pagina.evaluate(() => [...document.querySelectorAll("button, select, input")]
    .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 40).map((e) => e.id || e.textContent));
  assert.deepEqual(chicos, [], "controles de al menos 40 px");
  paso("tamaño de los controles");

  await pagina.emulateMedia({ colorScheme: "dark" });
  await pagina.waitForTimeout(100);
  const fondo = await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(fondo, "rgb(17, 17, 20)");
  const pixel = await pagina.evaluate(() => {
    const c = document.getElementById("g-hockey"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n;
  });
  assert.ok(pixel > 1000, "el gráfico se repintó en oscuro");
  paso("modo oscuro");

  assert.deepEqual(errores, [], "sin errores de consola");
  await contexto.close();
}

(async () => {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try {
    await recorrido(navegador, url, { width: 360, height: 740 }, true);
    await recorrido(navegador, url, { width: 1280, height: 900 }, false);
    console.log("e2e OK");
  } finally {
    await navegador.close();
    srv.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
