/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 y a 1280×720: carga sin errores, los
   ejemplos se analizan, aparecen diagnóstico, dónde, avisos, cadena y traza; los filtros cambian los frames; se copia
   en Markdown; pegar texto escapado funciona; no sale ningún pedido a otro dominio; sin scroll horizontal.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node herramientas/stack-trace-en-criollo/tests/e2e.js */
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

async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const contexto = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  const requests = [];
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url);
  await esperar(200);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await page.locator("#salida").isHidden(), "sin texto no hay salida");
  assert.equal(await page.locator("#ejemplos button").count(), 14, "14 ejemplos");
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);

  // Ejemplo 2: EF Core + SQL 2627.
  await page.click("#ejemplos button:nth-child(2)");
  await esperar(300);
  assert.ok(await page.locator("#salida").isVisible());
  assert.match(await page.textContent("#resumen"), /DbUpdateException que envuelve una SqlException 2627/);
  assert.match(await page.textContent("#diag h3"), /Clave duplicada/);
  assert.ok((await page.locator("#diag li").count()) >= 2, "hay acciones");
  assert.match(await page.textContent("#donde .principal"), /Program\.cs, línea 193/);
  assert.equal(await page.locator("#cadena .ex").count(), 2, "dos excepciones en la cadena");
  assert.ok(await page.locator("#cadena .ex.causa").isVisible());
  assert.match(await page.textContent("#cadena .ex.causa .extras"), /Error Number 2627/);
  const sinRuido = await page.locator("#traza .frames li:not(.omitidos):not(.marcador)").count();
  await page.click("[data-filtro=tuyos]");
  await esperar(100);
  const tuyos = await page.locator("#traza .frames li.tuyo").count();
  assert.ok(tuyos >= 2 && tuyos < sinRuido, `solo lo tuyo (${tuyos} < ${sinRuido})`);
  assert.ok((await page.locator("#traza .frames li.omitidos").count()) >= 1, "se avisa lo omitido");
  await page.click("[data-filtro=todo]");
  await esperar(100);
  const todo = await page.locator("#traza .frames li:not(.omitidos):not(.marcador)").count();
  assert.ok(todo >= sinRuido, `todo muestra al menos lo mismo (${todo} >= ${sinRuido})`);
  assert.ok((await page.locator("#traza .frames li .etq.tuyo").count()) >= 2, "etiquetas tuyo");
  assert.ok((await page.locator("#traza .frames li .etq.libreria").count()) >= 1, "etiqueta de librería");
  assert.ok(await sinScroll(), `sin scroll horizontal con la traza completa (${nombre})`);
  await page.check("#verCrudo");
  await esperar(100);
  assert.ok(await page.locator("#traza .frames li .crudo").first().isVisible(), "se ve el frame crudo");
  await page.uncheck("#verCrudo");
  await page.click("[data-filtro='sin-ruido']");

  // Copiar en Markdown.
  await page.click("#copiarMd");
  await esperar(200);
  if (viewport.width >= 700) {
    const md = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(md, /^\*\*Una DbUpdateException/);
    assert.match(md, /Causa probable: Clave duplicada/);
  }
  assert.ok(await page.locator("#copiado").isVisible(), "aviso de copiado");

  // Ejemplo 3: HttpClient timeout, cinco niveles.
  await page.click("#ejemplos button:nth-child(3)");
  await esperar(300);
  assert.equal(await page.locator("#cadena .ex").count(), 5);
  assert.match(await page.textContent("#diag h3"), /Timeout de HttpClient/);
  assert.ok((await page.locator("#avisos .aviso").count()) >= 2);

  // Ejemplo 9: JSON de Serilog.
  await page.click("#ejemplos button:nth-child(9)");
  await esperar(300);
  assert.match(await page.textContent("#avisos"), /Era un JSON de log/);
  assert.match(await page.textContent("#diag h3"), /Nadie escucha en ese host:puerto/);

  // Ejemplo 10: .NET Framework en español.
  await page.click("#ejemplos button:nth-child(10)");
  await esperar(300);
  assert.match(await page.textContent("#avisos"), /Traza en español/);
  assert.match(await page.textContent("#donde"), /PedidosRepositorio\.cs, línea 58/);
  assert.match(await page.textContent("#donde ol"), /ReportesController/);
  assert.match(await page.textContent("#traza"), /relanzada después de un await/);
  await page.check("#rutasCompletas");
  await esperar(100);
  assert.match(await page.textContent("#donde .principal"), /C:\\Proyectos\\Tienda/);
  await page.uncheck("#rutasCompletas");

  // Ejemplo 14: WhenAll con dos internas.
  await page.click("#ejemplos button:nth-child(14)");
  await esperar(300);
  assert.equal(await page.locator("#cadena .ex").count(), 3);
  assert.match(await page.textContent("#cadena"), /interna #1/);

  // Texto escapado pegado a mano.
  await page.fill("#entrada", "System.NullReferenceException: Object reference not set to an instance of an object.\\r\\n   at Tienda.Api.Servicios.ServicioClientes.ArmarSaludo(Int32 id) in C:\\\\src\\\\Tienda\\\\ServicioClientes.cs:line 21\\r\\n   at Tienda.Api.Controllers.ClientesController.Get(Int32 id) in C:\\\\src\\\\Tienda\\\\ClientesController.cs:line 40");
  await esperar(400);
  assert.match(await page.textContent("#avisos"), /Venía escapada/);
  assert.match(await page.textContent("#donde .principal"), /ServicioClientes\.cs, línea 21/);
  assert.match(await page.textContent("#donde ol"), /ClientesController\.Get/);

  // Texto que no es una traza, y limpiar.
  await page.fill("#entrada", "esto no es una traza");
  await esperar(400);
  assert.ok(await page.locator("#nada").isVisible());
  assert.ok(await page.locator("#salida").isHidden());
  await page.click("#limpiar");
  await esperar(100);
  assert.equal(await page.inputValue("#entrada"), "");
  assert.ok(await page.locator("#nada").isHidden());

  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, [], "ningún pedido a otro dominio");
  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  try {
    await probar(browser, url, { width: 360, height: 740 });
    await probar(browser, url, { width: 1280, height: 720 });
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
