/* Prueba de extremo a extremo en Chromium headless con Playwright.
   Recorre alta, resumen, calendario, tope, inflación, simulador, export,
   recarga, borrado e importación, en un viewport de celular (360 px).

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node apps/cuotas-en-curso/tests/e2e.js

   Si Playwright está instalado en otro lado, apuntá NODE_PATH a su node_modules. */
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
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".css": "text/css" };

/* Servidor estático mínimo: con http:// se registra el service worker; con file:// no. */
function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
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

async function main() {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true,
    locale: "es-AR", acceptDownloads: true });
  const pagina = await contexto.newPage();
  const erroresConsola = [];
  pagina.on("console", (m) => { if (m.type() === "error") erroresConsola.push(m.text()); });
  pagina.on("pageerror", (e) => erroresConsola.push(String(e)));

  const paso = (nombre) => console.log("  ✓ " + nombre);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const ir = (tab) => pagina.click(`#tab-${tab}`);

  await pagina.goto(url);
  await pagina.waitForSelector("#este-mes h2");
  const mesActual = await pagina.evaluate(() => window.Cuotas.mesActual());
  assert.match(await texto("#este-mes"), /Todavía no cargaste/);
  paso("carga vacía sin errores");

  /* 1. Alta con validación. */
  await ir("compras");
  await pagina.click("#btn-nueva");
  await pagina.click("#btn-guardar");
  assert.ok(await pagina.locator("#form-compra .campo.invalido").count() >= 2, "marca los campos vacíos");
  await pagina.fill("#f-desc", "Heladera");
  await pagina.fill("#f-tienda", "Cetrogar");
  await pagina.fill("#f-total", "120.000");
  await pagina.fill("#f-cuotas", "6");
  await pagina.fill("#f-primera", mesActual);
  await pagina.fill("#f-tarjeta", "Visa");
  await pagina.click("#btn-guardar");
  await pagina.waitForSelector("#card-form.oculto", { state: "attached" });
  assert.match(await texto("#lista-compras"), /Heladera.*\$ 20\.000.*× 6/);
  paso("alta de una compra de $120.000 en 6");

  /* 2. Resumen y calendario (criterio 1). */
  await ir("resumen");
  assert.match(await texto("#este-mes"), /\$ 20\.000/);
  const columnas = pagina.locator("svg.calendario g.col");
  assert.equal(await columnas.count(), 12);
  const conCuota = await columnas.evaluateAll((gs) => gs.filter((g) => !/\$ 0$/.test(g.getAttribute("aria-label"))).length);
  assert.equal(conCuota, 6, "la compra ocupa 6 meses del calendario");
  await columnas.nth(5).click();
  assert.match(await texto("#detalle-mes"), /Heladera.*6\/6.*última/);
  await columnas.nth(6).click();
  assert.match(await texto("#detalle-mes"), /No cae ninguna cuota/);
  paso("resumen del mes y calendario de 12 meses");

  /* 3. Tope y segunda tarjeta (criterios 2 y 3). */
  await ir("ajustes");
  await pagina.fill("#a-tope", "100.000");
  await pagina.click("#form-ajustes button[type=submit]");
  await ir("compras");
  await pagina.click("#btn-nueva");
  await pagina.fill("#f-desc", "Celular");
  await pagina.fill("#f-total", "600000");
  await pagina.fill("#f-cuotas", "6");
  await pagina.fill("#f-primera", mesActual);
  await pagina.fill("#f-tarjeta", "Master");
  await pagina.click("#btn-guardar");
  await ir("resumen");
  const resumen = await texto("#este-mes");
  assert.match(resumen, /\$ 120\.000/);
  assert.match(resumen, /Te pasás del tope de \$ 100\.000 por \$ 20\.000/);
  assert.match(resumen, /Visa.*\$ 20\.000/);
  assert.match(resumen, /Master.*\$ 100\.000/);
  assert.ok(await pagina.locator("#este-mes .barra.mal").count() === 1, "la barra queda en rojo");
  assert.ok(await pagina.locator("svg.calendario line[stroke-dasharray]").count() === 1, "línea de tope");
  assert.equal(await pagina.locator("svg.calendario g.col").first().locator("rect[fill^='#']").count(), 2,
    "dos tarjetas apiladas en el mes actual");
  paso("tope excedido y desglose por tarjeta");

  /* 4. Pesos de hoy (criterio 4). */
  await ir("ajustes");
  await pagina.fill("#a-inflacion", "0");
  await pagina.click("#form-ajustes button[type=submit]");
  await ir("resumen");
  assert.match(await texto("#pesos-hoy"), /\$ 720\.000 ?nominal \$ 720\.000 en pesos de hoy/);
  await ir("ajustes");
  await pagina.fill("#a-inflacion", "3");
  await pagina.click("#form-ajustes button[type=submit]");
  await ir("resumen");
  let esperado = 0;
  for (let k = 0; k < 6; k++) esperado += Math.round(20000_00 / Math.pow(1.03, k)) + Math.round(100000_00 / Math.pow(1.03, k));
  const esperadoTexto = await pagina.evaluate((c) => window.Cuotas.formatoPesos(c), esperado);
  assert.ok(esperado < 720000_00);
  assert.ok((await texto("#pesos-hoy")).includes("$ 720.000nominal " + esperadoTexto + " en pesos de hoy"),
    "el presente es la suma de cada cuota descontada: " + esperadoTexto);
  paso("pesos de hoy con 0 % y con 3 %");

  /* 5. Simulador (criterio 5). */
  await ir("simular");
  await pagina.fill("#s-total", "1.500.000");
  await pagina.fill("#s-cuotas", "12");
  await pagina.click("#btn-simular");
  await pagina.waitForSelector("#sim-salida:not(.oculto)");
  const sim = await texto("#sim-salida");
  assert.match(sim, /\$ 125\.000 por mes/);
  assert.match(sim, /Te pasarías del tope en 6 meses/);
  assert.ok(await pagina.locator("#sim-salida rect[fill='url(#rayas)']").count() >= 1, "la hipotética va rayada");
  const guardadas = await pagina.evaluate(() => JSON.parse(localStorage.getItem("cuotas-en-curso.v1")).compras.length);
  assert.equal(guardadas, 2, "simular no guarda nada");
  paso("simulador sin tocar los datos");

  /* 6. Export JSON y CSV (criterio 6). */
  await ir("ajustes");
  const [descJson] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btn-exportar")]);
  const json = fs.readFileSync(await descJson.path(), "utf8");
  const exportado = JSON.parse(json);
  assert.equal(exportado.compras.length, 2);
  assert.equal(exportado.ajustes.tope, 100000_00);
  const [descCsv] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btn-csv")]);
  const csv = fs.readFileSync(await descCsv.path(), "utf8");
  assert.equal(csv.trim().split("\r\n").length, 13, "una fila por cuota más el encabezado");
  assert.match(csv, /^﻿mes;compra;tienda;tarjeta;cuota;de;importe/);
  paso("descarga de JSON y CSV");

  /* 7. Recarga, borrado e importación (criterios 6 y 7). */
  await pagina.reload();
  await pagina.waitForSelector("#este-mes h2");
  assert.match(await texto("#este-mes"), /\$ 120\.000/);
  await ir("ajustes");
  await pagina.click("#btn-borrar");
  await pagina.click("#btn-borrar");
  await ir("resumen");
  assert.match(await texto("#este-mes"), /Todavía no cargaste/);
  await ir("ajustes");
  await pagina.check("input[name=modo-import][value=reemplazar]");
  await pagina.evaluate((t) => window.cuotasImportarTexto(t), json);
  assert.match(await texto("#import-estado"), /Se reemplazó todo con 2 compras/);
  await ir("resumen");
  assert.match(await texto("#este-mes"), /Te pasás del tope de \$ 100\.000 por \$ 20\.000/);
  paso("recarga, borrar todo e importar dejan lo mismo");

  /* 8. Editar y eliminar. */
  await ir("compras");
  await pagina.locator(".compra", { hasText: "Celular" }).locator("button[data-accion=editar]").click();
  await pagina.fill("#f-cuotas", "12");
  await pagina.click("#btn-guardar");
  assert.match(await texto("#lista-compras"), /Celular.*\$ 50\.000.*× 12/);
  const eliminar = pagina.locator(".compra", { hasText: "Celular" }).locator("button[data-accion=eliminar]");
  await eliminar.click();
  assert.match(await eliminar.innerText(), /Seguro/);
  await eliminar.click();
  assert.doesNotMatch(await texto("#lista-compras"), /Celular/);
  paso("editar y eliminar con confirmación");

  /* 9. Celular: sin scroll horizontal y botones de 44 px (criterio 9). */
  for (const tab of ["resumen", "compras", "simular", "ajustes"]) {
    await ir(tab);
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= 360, `sin scroll horizontal en ${tab} (${ancho})`);
    const chicos = await pagina.locator("button:visible").evaluateAll((bs) =>
      bs.map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h < 44));
    assert.deepEqual(chicos, [], `botones menores a 44 px en ${tab}: ${chicos}`);
  }
  paso("360 px sin scroll horizontal y botones de 44 px");

  /* 10. PWA: manifest y service worker. */
  const manifest = await pagina.evaluate(() => fetch("manifest.json").then((r) => r.json()));
  assert.equal(manifest.name, "Cuotas en curso");
  const sw = await pagina.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r)));
  assert.ok(sw, "el service worker se registró");
  paso("manifest y service worker");

  assert.deepEqual(erroresConsola, [], "sin errores de consola");
  await navegador.close();
  srv.close();
  console.log("Todo en orden.");
}

main().catch((e) => { console.error("FALLÓ:", e.message || e); process.exit(1); });
