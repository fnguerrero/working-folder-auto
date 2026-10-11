/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular) y a 1280 px.
   Recorre: carga, ejemplos, escribir una expresión, error con botón de arreglo, convertir entre dialectos,
   zona horaria, pestañas de código, parámetros por URL, recarga con lo guardado, copiar, modo oscuro
   y tamaño de los controles.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node herramientas/cron-en-criollo/tests/e2e.js */
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
      const limpia = req.url.split("?")[0];
      const ruta = limpia === "/" ? "/index.html" : decodeURIComponent(limpia);
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

async function recorrido(navegador, url, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR", timezoneId: "Europe/Madrid",
    permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const escribir = async (e) => { await pagina.fill("#expr", e); await pagina.waitForFunction((v) => document.getElementById("expr").value === v && document.title.includes("Cron en criollo") && !document.getElementById("frase").textContent.includes("…"), e); await pagina.waitForTimeout(250); };

  await pagina.goto(url);
  await pagina.waitForFunction(() => document.getElementById("proximas").children.length === 10);
  assert.equal(await texto("#frase"), "Cada 15 minutos, de 8 a 18 hs, de lunes a viernes.");
  assert.equal(await pagina.locator("#campos tr").count(), 5);
  assert.match(await texto("#prox-pie"), /America\/Argentina\/Buenos_Aires/);
  assert.match(await texto("#snippet"), /RecurringJob/);
  assert.ok((await pagina.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width, "sin scroll horizontal");
  paso("carga con la expresión inicial");

  await pagina.click("#ejemplos button:nth-child(7)");
  await pagina.waitForFunction(() => document.getElementById("frase").textContent.includes("último viernes"));
  assert.equal(await texto("#frase"), "A las 18:00, el último viernes del mes.");
  assert.match(await texto("#modo-texto"), /Quartz\.NET \(6 campos/);
  assert.equal(await pagina.locator("#campos tr").count(), 6);
  assert.match(await texto("#proximas tr:first-child td:nth-child(2)"), /^viernes \d\d\/\d\d\/\d{4} 18:00:00$/);
  assert.equal(await texto("#btn-convertir"), "Ver en estándar");
  paso("ejemplo Quartz: último viernes");

  await escribir("0 0 12 * * *");
  assert.match(await texto("#frase"), /Quartz exige "\?"/);
  assert.ok(await pagina.locator("#expr").evaluate((e) => e.classList.contains("error")));
  assert.equal(await pagina.locator("#proximas tr").count(), 0);
  await pagina.click("#btn-fix");
  await pagina.waitForFunction(() => document.getElementById("frase").textContent === "A las 12:00, todos los días.");
  assert.equal(await pagina.inputValue("#expr"), "0 0 12 * * ?");
  paso("error de Quartz con botón de arreglo");

  await pagina.click("#btn-convertir");
  await pagina.waitForFunction(() => document.getElementById("expr").value === "0 12 * * *");
  assert.equal(await texto("#frase"), "A las 12:00, todos los días.");
  assert.equal(await texto("#btn-convertir"), "Ver en Quartz");
  await pagina.click("#btn-convertir");
  await pagina.waitForFunction(() => document.getElementById("expr").value === "0 0 12 * * ?");
  paso("convertir ida y vuelta");

  await escribir("0 9 13 * FRI");
  assert.equal(await texto("#frase"), "A las 09:00, el día 13 de cada mes y también los viernes.");
  assert.match(await texto("#avisos"), /cualquiera de los dos/);
  await pagina.click("#btn-convertir");
  await pagina.waitForSelector("#aviso.visible");
  assert.match(await texto("#aviso"), /no tiene equivalente exacto/);
  assert.equal(await pagina.inputValue("#expr"), "0 9 13 * FRI", "no cambia si no se puede convertir");
  paso("aviso de doble restricción y conversión imposible");

  await escribir("*/7 * * * *");
  assert.match(await texto("#avisos"), /60 no es múltiplo de 7/);
  await escribir("0 3 * * *");
  const horaAr = await texto("#proximas tr:first-child td:nth-child(2)");
  assert.match(horaAr, / 03:00:00$/);
  await pagina.selectOption("#zona", "UTC");
  await pagina.waitForFunction(() => document.getElementById("prox-pie").textContent.includes("Hora de UTC"));
  assert.match(await texto("#snippet"), /TimeZoneInfo\.Utc/);
  await pagina.selectOption("#zona", "local");
  await pagina.waitForFunction(() => document.getElementById("prox-pie").textContent.includes("Europe/Madrid"));
  await pagina.selectOption("#zona", "America/Argentina/Buenos_Aires");
  await pagina.waitForFunction(() => document.getElementById("prox-pie").textContent.includes("Buenos_Aires"));
  paso("zonas horarias");

  await pagina.click("[data-tab=quartz]");
  assert.match(await texto("#snippet"), /necesita el campo de segundos/);
  await pagina.click("[data-tab=ncrontab]");
  assert.match(await texto("#snippet"), /CrontabSchedule\.Parse\("0 3 \* \* \*"\)/);
  await pagina.click("[data-tab=hangfire]");
  assert.match(await texto("#snippet"), /"0 3 \* \* \*"/);
  paso("pestañas de código");

  await pagina.selectOption("#modo", "quartz");
  await pagina.waitForFunction(() => document.getElementById("frase").textContent.includes("necesita el campo de segundos"));
  await pagina.selectOption("#modo", "auto");
  await pagina.waitForFunction(() => document.getElementById("frase").textContent === "A las 03:00, todos los días.");
  paso("dialecto forzado");

  await pagina.reload();
  await pagina.waitForFunction(() => document.getElementById("proximas").children.length === 10);
  assert.equal(await pagina.inputValue("#expr"), "0 3 * * *");
  assert.equal(await pagina.inputValue("#zona"), "America/Argentina/Buenos_Aires");
  paso("recarga con lo guardado");

  await pagina.goto(url + "?e=" + encodeURIComponent("0 0 10 ? * TUE#2") + "&m=auto&z=UTC");
  await pagina.waitForFunction(() => document.getElementById("proximas").children.length === 10);
  assert.equal(await texto("#frase"), "A las 10:00, el segundo martes del mes.");
  assert.equal(await pagina.inputValue("#zona"), "UTC");
  paso("parámetros por URL");

  await pagina.click("#btn-copiar");
  await pagina.waitForSelector("#aviso.visible");
  if (!movil) {
    assert.equal(await pagina.evaluate(() => navigator.clipboard.readText()), "0 0 10 ? * TUE#2");
    await pagina.click("#btn-link");
    await pagina.waitForFunction(() => /Link copiado/.test(document.getElementById("aviso").textContent));
    const link = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(link, /\?e=0\+0\+10\+%3F\+\*\+TUE%232&m=auto&z=UTC$/, link);
    await pagina.click("#btn-copiar-snippet");
    await pagina.waitForFunction(() => /Código copiado/.test(document.getElementById("aviso").textContent));
    assert.match(await pagina.evaluate(() => navigator.clipboard.readText()), /TriggerBuilder/);
    paso("copiar expresión, link y código");
  } else {
    paso("copiar (avisa)");
  }

  const chicos = await pagina.evaluate(() => [...document.querySelectorAll("button, select, input")]
    .filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 40).map((e) => e.id || e.textContent));
  assert.deepEqual(chicos, [], "controles de al menos 40 px");
  paso("tamaño de los controles");

  await pagina.emulateMedia({ colorScheme: "dark" });
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(17, 17, 20)");
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
