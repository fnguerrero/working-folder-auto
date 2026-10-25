/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular) y a 1280 px.
   Con el reloj fijo en el domingo 25/10/2026 recorre: estado y próximo feriado, las tres calculadoras con plazos
   calculados a mano, las opciones de puentes y Jueves Santo, el error fuera de rango, el calendario (años, tocar
   un día, usarlo en la calculadora), la lista, el C# y el JSON (copiar y bajar), la recarga con lo guardado,
   el tamaño de los controles, el modo oscuro, que no haya pedidos afuera y que no haya errores de consola.

   Cómo correrla (desde la raíz del repo):
     npm i -D playwright && npx playwright install chromium   # una sola vez
     node herramientas/feriados-y-habiles/tests/e2e.js */
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
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".cs": "text/plain; charset=utf-8" };

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
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires",
    permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  await pagina.clock.setFixedTime(new Date("2026-10-25T12:00:00-03:00"));
  const errores = [], afuera = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  pagina.on("request", (r) => { if (!r.url().startsWith(url) && !r.url().startsWith("data:")) afuera.push(r.url()); });
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const ejemplo = async (i) => { await pagina.click(`#ejemplos button[data-ej="${i}"]`); };
  const sumar = async (desde, n) => {
    await pagina.click('#modos [data-modo="sumar"]');
    await pagina.fill("#desde", desde);
    await pagina.fill("#n", String(n));
  };

  await pagina.goto(url);
  await pagina.waitForSelector("#resFecha");
  assert.match(await texto("#estadoTexto"), /Confirmado hasta 2026 entero\. 2027: están los feriados de la ley; faltan los puentes/);
  assert.match(await texto("#estadoTexto"), /Próximo feriado: lun 23\/11\/2026, Día de la Soberanía Nacional \(faltan 29 días\)/);
  assert.equal(await pagina.locator("#estado .sello").count(), 4);
  assert.equal(await texto("#estado .sello.medio"), "2027 a medias");
  assert.equal(await texto("#resFecha"), "viernes 6 de noviembre de 2026", "10 hábiles desde el domingo 25/10/2026");
  assert.equal(await pagina.locator(".mes").count(), 12);
  assert.equal(await pagina.getAttribute(".dia.hoy", "data-fecha"), "2026-10-25");
  assert.equal(await pagina.getAttribute('#anios [aria-pressed="true"]', "data-anio"), "2026");
  assert.ok((await pagina.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width, "sin scroll horizontal");
  paso("carga con hoy, estado y próximo feriado");

  await ejemplo(0);
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "jueves 29 de octubre de 2026");
  assert.match(await texto("#resultado"), /14 días corridos/);
  assert.equal(await pagina.getAttribute(".dia.desde", "data-fecha"), "2026-10-15");
  assert.equal(await pagina.getAttribute(".dia.hasta", "data-fecha"), "2026-10-29");
  paso("10 hábiles después del 15/10/2026");

  await ejemplo(1);
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "miércoles 25 de noviembre de 2026");
  assert.match(await texto("#salteados"), /lun 23\/11\/2026 · Día de la Soberanía Nacional/);
  assert.match(await texto("#salteados"), /Caía viernes 20\/11 y pasa al lunes siguiente/);
  assert.equal(await pagina.locator(".dia.marca").count(), 1);
  paso("3 hábiles desde el 19/11/2026, salteando Soberanía");

  await ejemplo(2);
  await pagina.waitForSelector("#resDia");
  assert.equal(await texto("#resDia"), "Es día hábil.");
  assert.match(await texto("#resultado"), /Acá caía el Día de la Soberanía Nacional, que se pasó al lun 23\/11\/2026/);
  assert.ok(await pagina.isVisible("#f-que"));
  paso("¿el 20/11/2026 es feriado?");

  await ejemplo(3);
  await pagina.waitForSelector("#resHabiles");
  assert.equal(await texto("#resHabiles"), "21 días hábiles");
  assert.match(await texto("#noHabiles"), /lun 12\/10\/2026 · Día del Respeto a la Diversidad Cultural/);
  paso("hábiles de octubre 2026");

  await ejemplo(5);
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "lunes 29 de marzo de 2027");
  assert.match(await texto("#resultado"), /pasa por 2027, que todavía no está completo/);
  assert.equal(await pagina.getAttribute('#anios [aria-pressed="true"]', "data-anio"), "2027");
  await pagina.check("#opJueves");
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "martes 30 de marzo de 2027");
  await pagina.uncheck("#opJueves");
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "lunes 29 de marzo de 2027");
  paso("Semana Santa 2027 con y sin Jueves Santo, aviso de año incompleto");

  await sumar("2026-03-20", 1);
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "miércoles 25 de marzo de 2026");
  await pagina.uncheck("#opPuentes");
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "lunes 23 de marzo de 2026");
  await pagina.check("#opPuentes");
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "miércoles 25 de marzo de 2026");
  await sumar("2026-07-13", -1);
  await pagina.waitForFunction(() => document.getElementById("resFecha").textContent === "miércoles 8 de julio de 2026");
  assert.match(await texto("#resultado"), /1 día hábil antes del lun 13\/07\/2026/);
  paso("puentes como hábiles o no, y para atrás");

  await sumar("2027-12-30", 3);
  await pagina.waitForSelector("#resError");
  assert.match(await texto("#resError"), /se pasa de 31\/12\/2027/);
  await pagina.fill("#n", "2.5");
  await pagina.waitForFunction(() => /número entero/.test(document.getElementById("resultado").textContent));
  await sumar("2026-12-30", 2);
  await pagina.waitForFunction(() => document.getElementById("resFecha") && document.getElementById("resFecha").textContent === "lunes 4 de enero de 2027");
  paso("errores: fuera de rango y cantidad rara; cambio de año");

  await pagina.click('#anios [data-anio="2027"]');
  await pagina.waitForSelector("#avisoAnio:not(.oculto)");
  assert.match(await texto("#avisoAnio"), /2027 todavía no está completo/);
  assert.equal(await texto("#tituloTabla"), "La lista de 2027");
  assert.equal(await pagina.locator("#tabla tr").count(), 17);
  assert.ok(await pagina.locator('.dia.confirmar[data-fecha="2027-11-20"]').count());
  await pagina.click('#anios [data-anio="2025"]');
  await pagina.waitForFunction(() => document.getElementById("tituloTabla").textContent === "La lista de 2025");
  assert.ok(await pagina.isHidden("#avisoAnio"));
  assert.equal(await pagina.locator("#tabla tr").count(), 20);
  assert.match(await texto("#tabla"), /vie 10\/10\/2025.*caía dom 12\/10\/2025.*Resolución 139\/2025/);
  assert.ok(await pagina.locator('.dia.original[data-fecha="2025-10-12"]').count());
  paso("calendario y lista por año");

  await pagina.click('#anios [data-anio="2026"]');
  await pagina.click('.dia[data-fecha="2026-11-23"]');
  await pagina.waitForSelector("#detDia");
  assert.equal(await texto("#detDia"), "Es feriado: Día de la Soberanía Nacional.");
  assert.match(await texto("#detalle"), /Ley 27\.399, art\. 6/);
  await pagina.click('#modos [data-modo="que"]');
  await pagina.click('.dia[data-fecha="2026-03-23"]');
  await pagina.click("#usarDia");
  await pagina.waitForFunction(() => document.getElementById("resDia") && /con fines turísticos/.test(document.getElementById("resDia").textContent));
  assert.equal(await pagina.inputValue("#dia"), "2026-03-23");
  assert.match(await texto("#resultado"), /Resolución 164\/2025/);
  paso("tocar un día y usarlo en la calculadora");

  assert.match(await texto("#codigo"), /public sealed class CalendarioArgentino/);
  assert.equal(await texto("#copiar"), "Copiar C#");
  if (!movil) {
    await pagina.click("#copiar");
    await pagina.waitForSelector("#copiado:not(.oculto)");
    const cs = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.equal(cs, fs.readFileSync(path.join(RAIZ, "csharp", "CalendarioArgentino.cs"), "utf8"));
  }
  await pagina.click('#pestanias [data-pes="json"]');
  assert.equal(await texto("#copiar"), "Copiar JSON");
  assert.equal(await pagina.getAttribute("#bajar", "href"), "feriados.json");
  if (!movil) {
    await pagina.click("#copiar");
    const j = JSON.parse(await pagina.evaluate(() => navigator.clipboard.readText()));
    assert.equal(j.feriados.length, 77);
    assert.equal(j.completoHasta, 2026);
  }
  for (const archivo of ["feriados.json", "csharp/CalendarioArgentino.cs"]) {
    const r = await pagina.request.get(url + archivo);
    assert.equal(r.status(), 200, archivo);
  }
  paso(movil ? "C# y JSON (bajar)" : "C# y JSON (copiar y bajar)");

  await pagina.click('#modos [data-modo="entre"]');
  await pagina.uncheck("#opPuentes");
  await pagina.reload();
  await pagina.waitForSelector("#resHabiles");
  assert.equal(await pagina.getAttribute('#modos [aria-pressed="true"]', "data-modo"), "entre");
  assert.equal(await pagina.isChecked("#opPuentes"), false);
  assert.equal(await pagina.inputValue("#a"), "2026-10-25");
  assert.equal(await pagina.inputValue("#b"), "2026-11-24");
  assert.equal(await texto("#resHabiles"), "21 días hábiles", "del 25/10 al 24/11/2026, sin el 23/11");
  await pagina.check("#opPuentes");
  paso("recarga con lo guardado");

  const chicos = await pagina.evaluate(() => [...document.querySelectorAll("button, select, input, label.check")]
    .filter((e) => e.offsetParent !== null && e.type !== "checkbox" && e.getBoundingClientRect().height < 40).map((e) => e.id || e.textContent));
  assert.deepEqual(chicos, [], "controles de al menos 40 px");
  paso("tamaño de los controles");

  await pagina.emulateMedia({ colorScheme: "dark" });
  assert.equal(await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor), "rgb(19, 20, 18)");
  assert.ok((await pagina.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width, "sin scroll horizontal");
  paso("modo oscuro");

  assert.deepEqual(afuera, [], "sin pedidos a otros dominios");
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
