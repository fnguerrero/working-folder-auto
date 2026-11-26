/* Prueba de extremo a extremo en un Chromium headless con Playwright, a 360×740 (táctil) y a
   1280×800: ejemplo, pegar dos meses, carga a mano, comparación, borrar y deshacer, exportar,
   importar, recarga, PWA sin conexión y apertura como archivo local.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node apps/expensas-en-criollo/tests/e2e.js

   Variables opcionales:
     PLAYWRIGHT  ruta a un módulo playwright o playwright-core ya instalado
     CANAL       usar un navegador del sistema ("msedge" o "chrome") en lugar del de Playwright
     CAPTURAS    carpeta donde dejar capturas de pantalla */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");

let chromium;
try {
  ({ chromium } = require(process.env.PLAYWRIGHT || "playwright"));
} catch (e) {
  console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const pedido = decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.join(RAIZ, pedido === "/" ? "index.html" : pedido);
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
        res.writeHead(404); res.end("no está"); return;
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

const SEPTIEMBRE = `LIQUIDACIÓN DE PRUEBA - SEPTIEMBRE 2026
Sueldo encargado septiembre ........ $ 1.000.000,00
Luz espacios comunes\t200.000,00
Abono ascensores   150.000,00   10,0%
Fondo de reserva: 150.000
TOTAL $ 1.500.000,00`;
const OCTUBRE = `Sueldo encargado octubre   1.030.000,00
Luz espacios comunes   320.000,00
Abono ascensores   153.000,00
Reparación <img src=x onerror=alert(1)>   200.000,00
Fondo de reserva   150.000,00
TOTAL   1.900.000,00`;

async function probar(navegador, url, viewport) {
  const celu = viewport.width < 700;
  console.log(viewport.width + "×" + viewport.height + ":");
  const contexto = await navegador.newContext({ viewport, hasTouch: celu, isMobile: celu, locale: "es-AR", acceptDownloads: true });
  await contexto.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(url).origin });
  const pagina = await contexto.newPage();
  pagina.setDefaultTimeout(8000);
  const errores = [];
  const afuera = [];
  pagina.on("pageerror", (e) => errores.push(e.message));
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("dialog", (d) => { errores.push("diálogo inesperado: " + d.message()); d.dismiss(); });
  pagina.on("request", (r) => { if (!r.url().startsWith(url) && !r.url().startsWith("blob:")) afuera.push(r.url()); });

  const paso = (t) => console.log("  ok " + t);
  const texto = async (s) => (await pagina.locator(s).innerText()).replace(/\s+/g, " ").trim();
  const ir = (t) => pagina.click(`#tabs button[data-tab=${t}]`);
  const cerrarAviso = async () => { if (await pagina.isVisible("#toast")) await pagina.click("#btn-cerrar"); };
  const captura = async (nombre) => {
    if (process.env.CAPTURAS) await pagina.screenshot({ path: path.join(process.env.CAPTURAS, `${nombre}-${viewport.width}.png`), fullPage: true });
  };
  async function revisarPantalla(donde) {
    const sobra = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sobra <= 0, `scroll horizontal de ${sobra}px en ${donde}`);
    const chicos = await pagina.evaluate(() =>
      [...document.querySelectorAll("button, input, select, summary")]
        .filter((n) => n.offsetParent !== null)
        .map((n) => ({ n: (n.id || n.textContent || n.type).trim().slice(0, 30), r: n.getBoundingClientRect() }))
        .filter((x) => x.r.height < 43.5 || x.r.width < 43.5)
        .map((x) => `${x.n} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`));
    assert.deepEqual(chicos, [], "controles de menos de 44 px en " + donde);
  }

  /* 1. El ejemplo. */
  await pagina.goto(url);
  assert.ok(await pagina.isVisible("#banner-ejemplo"));
  assert.match(await texto("#criollo"), /Los gastos de octubre 2026 subieron 15,4 % \(\$ 524\.000\) contra septiembre 2026\./);
  assert.match(await texto("#criollo"), /La inflación fue 2,3 %: descontándola, subieron 12,8 %/);
  assert.equal(await pagina.locator("#saltos li").count(), 3);
  assert.equal(await pagina.locator("#preguntas li").count(), 3);
  assert.match(await texto("#cifras"), /Total del mes \$ 3\.918\.000/);
  await pagina.locator("#categorias summary", { hasText: "Servicios" }).click();
  assert.match(await texto("#categorias details[open]"), /Luz de espacios comunes \$ 306\.000 Antes \$ 219\.000/);
  await revisarPantalla("resumen");
  await captura("resumen");
  await pagina.click("#btn-copiar");
  await pagina.waitForSelector("#toast:not(.oculto)");
  assert.match(await pagina.evaluate(() => navigator.clipboard.readText()), /^Expensas de octubre 2026[\s\S]*Consultas:\s+1\. /);
  await cerrarAviso();
  await pagina.selectOption("#sel-mes", "2026-08");
  assert.match(await texto("#criollo"), /Cargá un mes anterior/);
  assert.ok(!(await pagina.isVisible("#caja-saltos")));
  paso("ejemplo: resumen, saltos, categorías y copiar");

  /* 2. Empezar con datos propios y pegar septiembre. */
  await pagina.click("#btn-empezar");
  await cerrarAviso();
  await pagina.click("#btn-guardar");
  assert.match(await texto("#c-error"), /Elegí el mes/);
  await pagina.fill("#c-mes", "2026-09");
  await pagina.fill("#c-texto", SEPTIEMBRE);
  await pagina.click("#btn-leer");
  assert.equal(await pagina.locator("#filas .f-nombre").count(), 4);
  assert.match(await texto("#c-lectura"), /4 rubros por \$ 1\.500\.000.*Coincide con el total/);
  await pagina.locator("#c-lectura summary").click();
  await revisarPantalla("cargar con rubros leídos");
  await captura("cargar");
  await pagina.click("#btn-guardar");
  assert.ok(!(await pagina.isVisible("#banner-ejemplo")));
  assert.match(await texto("#criollo"), /septiembre 2026 los gastos cargados suman \$ 1\.500\.000/);
  await cerrarAviso();
  paso("pegar un mes y controlar el total");

  /* 3. Octubre, con inflación y un nombre con HTML. */
  await ir("cargar");
  await pagina.fill("#c-mes", "2026-10");
  await pagina.fill("#c-inflacion", "dos");
  await pagina.fill("#c-texto", OCTUBRE);
  await pagina.click("#btn-leer");
  assert.match(await texto("#c-lectura"), /el total del texto es \$ 1\.900\.000 y no coincide/);
  await pagina.click("#btn-guardar");
  assert.match(await texto("#c-error"), /La inflación/);
  await pagina.fill("#c-inflacion", "2,5");
  /* Carga a mano y quitar con deshacer. */
  await pagina.click("#btn-agregar");
  await pagina.locator("#filas .f-nombre").last().fill("Seguro del edificio");
  assert.equal(await pagina.locator("#filas .f-cat").last().inputValue(), "seguros");
  await pagina.click("#btn-guardar");
  assert.match(await texto("#c-error"), /Revisá el importe de «Seguro del edificio»/);
  await pagina.locator("#filas .f-monto").last().fill("47.000");
  await pagina.locator("#filas li button").last().click();
  assert.equal(await pagina.locator("#filas .f-nombre").count(), 5);
  await pagina.click("#btn-deshacer");
  assert.equal(await pagina.locator("#filas .f-nombre").count(), 6);
  await pagina.click("#btn-guardar");
  assert.match(await texto("#criollo"), /subieron 26,7 % \(\$ 400\.000\) contra septiembre 2026\./);
  assert.match(await texto("#criollo"), /Reparación <img src=x onerror=alert\(1\)> \(\+\$ 200\.000\)/);
  assert.equal(await pagina.locator("main img").count(), 0);
  assert.match(await texto("#saltos"), /Reparación.*Luz espacios comunes/);
  assert.equal(await pagina.locator("#saltos li").count(), 3);
  await cerrarAviso();
  await revisarPantalla("resumen propio");
  paso("segundo mes, carga a mano y comparación");

  /* 4. Historial, ajustes, borrar y deshacer. */
  await ir("datos");
  await pagina.locator("#inflaciones input").fill("30");
  await pagina.locator("#inflaciones input").press("Tab");
  await pagina.fill("#a-coef", "5");
  await pagina.press("#a-coef", "Tab");
  await ir("resumen");
  assert.match(await texto("#criollo"), /bajaron 2,6 %/);
  assert.match(await texto("#cifras"), /Tu parte estimada \(5 %\) \$ 95\.000/);
  await ir("datos");
  await revisarPantalla("historial");
  await captura("historial");
  await pagina.locator("#meses li[data-mes='2026-09'] button", { hasText: "Borrar" }).click();
  assert.equal(await pagina.locator("#meses li[data-mes]").count(), 1);
  await pagina.click("#btn-deshacer");
  assert.equal(await pagina.locator("#meses li[data-mes]").count(), 2);
  await pagina.locator("#meses li[data-mes='2026-10'] button", { hasText: "Editar" }).click();
  assert.equal(await pagina.inputValue("#c-mes"), "2026-10");
  assert.equal(await pagina.inputValue("#c-inflacion"), "30");
  assert.ok(await pagina.isVisible("#c-existe"));
  await pagina.locator("#filas .f-monto").first().fill("1.130.000");
  await pagina.click("#btn-guardar");
  assert.match(await texto("#cifras"), /\$ 2\.000\.000/);
  await cerrarAviso();
  paso("inflación, coeficiente, borrar con deshacer y editar");

  /* 5. Exportar, borrar todo, importar y recargar. */
  await ir("datos");
  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btn-exportar")]);
  assert.equal(descarga.suggestedFilename(), "expensas-2026-10.json");
  const archivo = await descarga.path();
  assert.equal(JSON.parse(fs.readFileSync(archivo, "utf8")).meses.length, 2);
  await pagina.click("#btn-borrar");
  assert.match(await texto("#meses"), /Sin meses cargados/);
  await cerrarAviso();
  await ir("resumen");
  assert.ok(await pagina.isVisible("#vacio"));
  await revisarPantalla("vacío");
  await ir("datos");
  await pagina.setInputFiles("#in-importar", archivo);
  await pagina.waitForSelector("#meses li[data-mes='2026-10']");
  await cerrarAviso();
  await pagina.setInputFiles("#in-importar", { name: "x.json", mimeType: "application/json", buffer: Buffer.from("{roto") });
  await pagina.waitForFunction(() => /no es un JSON válido/.test(document.querySelector("#toast").textContent));
  assert.equal(await pagina.locator("#meses li[data-mes]").count(), 2);
  await pagina.reload();
  assert.match(await texto("#cifras"), /\$ 2\.000\.000/);
  assert.ok(!(await pagina.isVisible("#banner-ejemplo")));
  paso("exportar, borrar todo, importar y persistir");

  /* 6. Lo guardado roto no rompe la app. */
  await pagina.evaluate(() => localStorage.setItem("expensas-en-criollo:v1", "{roto"));
  await pagina.reload();
  assert.match(await texto("#aviso-guardado"), /No se pudo leer lo guardado/);
  assert.equal(await pagina.evaluate(() => localStorage.getItem("expensas-en-criollo:v1:roto")), "{roto");
  paso("datos guardados rotos: copia aparte y ejemplo");

  /* 7. PWA y sin conexión. */
  assert.equal((await pagina.evaluate(() => fetch("manifest.json").then((r) => r.json()))).name, "Expensas en criollo");
  await pagina.evaluate(() => navigator.serviceWorker.ready);
  await contexto.setOffline(true);
  await pagina.reload();
  assert.ok((await pagina.locator("#saltos li").count()) > 0);
  await contexto.setOffline(false);
  paso("manifest, service worker y recarga sin conexión");

  assert.deepEqual(afuera, [], "no pide nada afuera");
  assert.deepEqual(errores, [], "sin errores de consola");

  await pagina.emulateMedia({ colorScheme: "dark" });
  await captura("oscuro");
  await contexto.close();

  /* 8. Abierta como archivo local. */
  const local = await navegador.newContext({ viewport });
  const p2 = await local.newPage();
  const errores2 = [];
  p2.on("pageerror", (e) => errores2.push(e.message));
  await p2.goto(pathToFileURL(path.join(RAIZ, "index.html")).href);
  assert.equal(await p2.locator("#saltos li").count(), 3);
  assert.deepEqual(errores2, []);
  await local.close();
  paso("abre como archivo local");
}

(async () => {
  const { srv, url } = await servir();
  const navegador = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});
  try {
    await probar(navegador, url, { width: 360, height: 740 });
    await probar(navegador, url, { width: 1280, height: 800 });
    console.log("Todo en orden.");
  } finally {
    await navegador.close();
    srv.close();
  }
})().catch((e) => { console.error("FALLÓ:", e.message || e); process.exit(1); });
