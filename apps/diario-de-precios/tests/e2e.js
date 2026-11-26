/* Prueba de punta a punta en un navegador sin ventana (Playwright) a 360×740 táctil y 1280×800:
   alta, carga rápida, deshacer, ficha con gráfico, canasta, oficial, exportar e importar, borrar y sin conexión.
     node tests/e2e.js
   Opcionales: CANAL=msedge (usa el Edge instalado) y CAPTURAS=<carpeta> para guardar imágenes. */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".svg": "image/svg+xml" };

let caido = false; // simula que no hay red, también para el service worker
function servir() {
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      if (caido) { req.socket.destroy(); return; }
      let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html";
      const a = path.join(RAIZ, ruta);
      if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { "Content-Type": TIPOS[path.extname(a)] || "application/octet-stream" }); fs.createReadStream(a).pipe(r);
    });
    srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function probar(browser, url, viewport, esquema) {
  const nombre = `${viewport.width}×${viewport.height} ${esquema}`;
  const celu = viewport.width < 700;
  const ctx = await browser.newContext({ viewport, hasTouch: celu, isMobile: celu, locale: "es-AR", colorScheme: esquema, acceptDownloads: true });
  const page = await ctx.newPage(); const errores = []; const afuera = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  ctx.on("request", (r) => { if (!r.url().startsWith(url) && !/^(blob|edge|chrome):/.test(r.url())) afuera.push(r.url()); }); // edge: es la interfaz de descargas del propio navegador
  const tocar = (sel) => celu ? page.locator(sel).first().tap() : page.locator(sel).first().click();
  const texto = () => page.locator("#vista").innerText();
  const sinDesborde = async (donde) => {
    const d = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, ventana: document.documentElement.clientWidth,
      tablas: [...document.querySelectorAll(".tabla")].filter((t) => t.scrollWidth > t.clientWidth + 1).length }));
    assert.ok(d.ancho <= viewport.width + 1, `${donde}: scroll horizontal (${d.ancho})`);
    assert.equal(d.tablas, 0, `${donde}: tablas que desbordan`);
  };
  const captura = async (n) => { if (process.env.CAPTURAS) await page.screenshot({ path: path.join(process.env.CAPTURAS, `${n}-${viewport.width}-${esquema}.png`), fullPage: true }); };
  const hoy = await page.evaluate(() => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); });

  await page.goto(url); await page.waitForSelector("text=Tu primer producto"); await sinDesborde("inicio"); await captura("1-inicio");

  // Alta con error y alta válida.
  await tocar("button:text('Agregar producto')"); assert.ok((await texto()).includes("Poné el nombre"));
  await page.fill("input[name=nombre]", "<img src=x onerror=alert(1)>"); await page.fill("input[name=unidad]", "litro");
  await page.fill("input[name=cantidad]", "1,125"); await page.fill("input[name=precio]", "1.234,50"); await tocar("button:text('Agregar producto')");
  await page.waitForSelector(".producto"); assert.ok((await page.locator(".producto").innerText()).includes("<img src=x"), "el nombre se muestra como texto");
  assert.equal(await page.locator("#vista img").count(), 0);
  assert.ok(/1\.234,5/.test(await page.locator(".producto b").innerText()));
  await sinDesborde("nombre hostil");

  // Carga rápida: tocar, escribir, Enter. Después deshacer.
  await tocar(".producto"); assert.equal(await page.evaluate(() => document.activeElement.name), "precio", "el foco queda en el precio");
  await page.keyboard.press("Escape"); assert.equal(await page.locator(".rapida").count(), 0, "Esc cierra");
  await tocar(".producto"); await page.fill(".rapida input[name=precio]", "0"); await page.keyboard.press("Enter");
  assert.ok((await page.locator(".rapida .error").innerText()).includes("mayor que cero"));
  await page.fill(".rapida input[name=precio]", "1300"); await page.keyboard.press("Enter");
  assert.ok(/1\.300/.test(await page.locator(".producto b").innerText()), "se corrige el precio del día");
  await tocar("#deshacer"); assert.ok(/1\.234,5/.test(await page.locator(".producto b").innerText()), "deshacer vuelve atrás");

  // Persistencia.
  await page.reload(); await page.waitForSelector(".producto"); assert.ok(/1\.234,5/.test(await page.locator(".producto b").innerText()), "queda guardado");

  // Ficha: editar sin perder decimales.
  await tocar(".producto"); await tocar(".rapida a"); await page.waitForSelector("#lienzo svg"); await tocar("#editar summary");
  assert.equal(await page.inputValue("#editar input[name=cantidad]"), "1,125");
  await page.fill("#editar input[name=nombre]", "Leche"); await tocar("#editar button[type=submit]"); await page.waitForSelector("h2:text('Leche')");
  await tocar("#editar summary"); await tocar("#borrarProducto"); await page.waitForSelector("text=Tu primer producto"); await tocar("#deshacer"); await page.waitForSelector(".producto");

  // Ejemplo.
  await tocar("nav a[data-vista=datos]"); await tocar("#borrarTodo"); await tocar("button:text('Cargar datos de ejemplo')");
  await tocar("nav a[data-vista=anotar]"); await page.waitForSelector(".producto"); assert.equal(await page.locator(".producto").count(), 5);
  assert.ok((await texto()).includes("Para mirar") && /Yerba subió \d+ % en dos meses/.test(await texto()), "alerta de la yerba");
  await tocar(".producto:has-text('Nafta')"); await sinDesborde("carga rápida"); await captura("2-anotar");
  await tocar(".rapida button:text('Sigue igual')"); assert.equal(await page.locator(".rapida").count(), 0);

  // Canasta y oficial.
  await tocar("nav a[data-vista=canasta]"); await page.waitForSelector("#historia");
  const propias = await page.locator(".cifra.propia b").allInnerTexts(); assert.equal(propias.length, 2); assert.ok(propias.every((t) => /^\+\d+,\d %$/.test(t)), `variaciones: ${propias}`);
  assert.equal(await page.locator("#historia tbody tr").count(), 12);
  await page.selectOption("select[name=mesOficial]", hoy.slice(0, 7)); await page.fill("input[name=mensual]", "2,5"); await page.fill("input[name=interanual]", "31,2");
  await tocar("button:text('Guardar oficial')"); assert.deepEqual(await page.locator(".cifra.oficial b").allInnerTexts(), ["+2,5 %", "+31,2 %"]);
  assert.ok(/puntos por (encima|debajo)/.test(await texto()));
  await tocar("[data-plazo='12']"); assert.equal(await page.locator("[data-plazo='12']").getAttribute("aria-pressed"), "true");
  await sinDesborde("canasta"); await captura("3-canasta");
  const meses = await page.locator("select[name=mes] option").count(); await page.selectOption("select[name=mes]", { index: meses - 1 });
  assert.ok((await texto()).includes("Todavía no hay productos"), "el primer mes no inventa un 0 %");

  // Ficha con gráfico.
  await tocar("nav a[data-vista=anotar]"); await tocar(".producto:has-text('Yerba')"); await tocar(".rapida a"); await page.waitForSelector("#lienzo svg");
  assert.equal(await page.locator("#lienzo circle").count(), 14);
  const dentro = await page.evaluate(() => { const s = document.querySelector("#lienzo svg").getBoundingClientRect(); return [...document.querySelectorAll("#lienzo text")].every((t) => { const r = t.getBoundingClientRect(); return r.left >= s.left - 1 && r.right <= s.right + 1; }); });
  assert.ok(dentro, "los rótulos del gráfico entran");
  assert.equal(await page.locator(".cifra b").count(), 2);
  await sinDesborde("ficha"); await captura("4-ficha");
  await tocar("#precios button"); assert.equal(await page.locator("#precios tr").count(), 13); await tocar("#deshacer"); assert.equal(await page.locator("#precios tr").count(), 14);

  // Exportar, borrar, importar.
  await tocar("nav a[data-vista=datos]"); await sinDesborde("datos"); await captura("5-datos");
  const bajarArchivo = async (sel) => { const [d] = await Promise.all([page.waitForEvent("download"), tocar(sel)]); return { nombre: d.suggestedFilename(), contenido: fs.readFileSync(await d.path()) }; };
  const json = await bajarArchivo("#bajarJSON"); const csv = await bajarArchivo("#bajarCSV");
  assert.ok(json.nombre.endsWith(".json") && csv.nombre.endsWith(".csv"));
  assert.equal(JSON.parse(json.contenido).productos.length, 5);
  await tocar("#borrarTodo"); assert.equal(await page.locator("#borrarTodo").count(), 0);
  await page.setInputFiles("#archivo", { name: "copia.json", mimeType: "application/json", buffer: json.contenido }); await page.waitForSelector("#borrarTodo");
  assert.ok((await page.locator("#avisoTexto").innerText()).includes("5 productos"));
  await tocar("#borrarTodo"); await page.setInputFiles("#archivo", { name: "precios.csv", mimeType: "text/csv", buffer: csv.contenido }); await page.waitForSelector("#borrarTodo");
  assert.ok((await page.locator("#avisoTexto").innerText()).includes("5 productos nuevos"));
  await page.setInputFiles("#archivo", { name: "roto.json", mimeType: "application/json", buffer: Buffer.from("{nada") });
  await page.waitForFunction(() => document.getElementById("avisoTexto").textContent.includes("JSON válido"));

  // Datos dañados: avisa, respalda y no rompe.
  await page.evaluate(() => localStorage.setItem("diario-de-precios:v1", "{roto")); await page.reload(); await page.waitForSelector("text=No se pudieron leer");
  assert.equal(await page.evaluate(() => localStorage.getItem("diario-de-precios:respaldo")), "{roto");
  await sinDesborde("aviso");

  assert.deepEqual(errores, [], `errores en consola: ${errores.join(" | ")}`);

  // Sin conexión.
  await tocar("nav a[data-vista=anotar]");
  await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  caido = true; await ctx.setOffline(true); await page.reload(); await page.waitForSelector("h1:text('Diario de precios')"); await page.waitForSelector("text=Tu primer producto");
  caido = false; await ctx.setOffline(false);

  assert.deepEqual(afuera, [], "no pide nada afuera");
  await ctx.close(); console.log(`ok ${nombre}`);
}

// Abierta como archivo local (sin servidor) también tiene que andar.
async function probarArchivo(browser) {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const errores = [];
  page.on("pageerror", (e) => errores.push(String(e))); page.on("console", (m) => { if (m.type() === "error" && !/manifest/i.test(m.text() + m.location().url)) errores.push(m.text()); });
  await page.goto(require("node:url").pathToFileURL(path.join(RAIZ, "index.html")).href);
  await page.click("text=Probar con datos de ejemplo"); assert.equal(await page.locator(".producto").count(), 5);
  assert.deepEqual(errores, []); await ctx.close(); console.log("ok abierta como archivo");
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch(process.env.CANAL ? { channel: process.env.CANAL } : {});
  try {
    await probar(browser, url, { width: 360, height: 740 }, "light");
    await probar(browser, url, { width: 1280, height: 800 }, "dark");
    await probarArchivo(browser);
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
