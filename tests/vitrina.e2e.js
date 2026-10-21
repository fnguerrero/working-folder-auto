/* E2e de la vitrina (index.html) en Chromium headless (Playwright) a 375×740 y 1280×800: la barra superior muestra el cielo
   de esta noche (la luna, el signo de cada planeta y el regente del día) y cada astro abre su explicación; sin scroll horizontal,
   sin pedidos afuera ni errores en consola.
     NODE_PATH=/opt/node-tools/node_modules node tests/vitrina.e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript" };
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": TIPOS[path.extname(a)] || "application/octet-stream" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const proyectos = JSON.parse(fs.readFileSync(path.join(RAIZ, "proyectos.json"), "utf8")).filter((p) => p.estado !== "archivado");
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await ctx.newPage(); const errores = []; const afuera = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) afuera.push(r.url()); });
  await page.goto(url); await page.waitForSelector(".tarjeta"); await page.waitForTimeout(300);
  const barra = page.locator("#barra"); assert.ok(await barra.isVisible(), "la barra se ve");
  const caja = await barra.boundingBox(); const lateral = await page.locator("aside").boundingBox();
  if (viewport.width >= 960) { assert.ok(caja.y < 2 && Math.abs(caja.x - 250) < 2 && Math.abs(caja.x + caja.width - viewport.width) < 2, `la barra va arriba, solo sobre el contenido (${JSON.stringify(caja)})`); assert.ok(lateral.y < 2 && lateral.height >= viewport.height - 1, "el lateral sube hasta arriba"); }
  else assert.ok(caja.y < 2 && caja.width >= viewport.width - 1, `la barra va arriba y a lo ancho (${JSON.stringify(caja)})`);
  const ultimoItem = await page.locator("#barra > .tile").last().boundingBox(); if (viewport.width >= 960) assert.ok(Math.abs(ultimoItem.x + ultimoItem.width - (caja.x + caja.width)) < 24, "alineada a la derecha");
  assert.ok(caja.height < 60, `un solo renglón (${caja.height}px)`);
  if (viewport.width >= 960) { const primero = await page.locator("#barra > .tile").first().boundingBox(); assert.ok(primero.x >= caja.x - 1, "ningún tile queda recortado a la izquierda"); assert.ok(await page.locator("#barra").evaluate((e) => e.scrollWidth <= e.clientWidth + 1), "la barra entra entera en escritorio"); }
  const tiles = await page.locator("#barra > .tile").allInnerTexts(); assert.equal(tiles.length, 8, `ocho ítems: ${tiles}`);
  const SIGNO = "(Aries|Tauro|Géminis|Cáncer|Leo|Virgo|Libra|Escorpio|Sagitario|Capricornio|Acuario|Piscis)";
  assert.ok(new RegExp(`^[🌑🌒🌓🌔🌕🌖🌗🌘] ${SIGNO}$`, "u").test(await page.locator("#barra .tile[data-astro=luna] b").innerText()), "la luna con su signo");
  for (const k of ["sol", "mercurio", "venus", "marte", "jupiter", "saturno"]) assert.ok(new RegExp(`^\\S+ ${SIGNO}( ℞)?$`, "u").test(await page.locator(`#barra .tile[data-astro=${k}] b`).innerText()), `el signo de ${k}`);
  assert.ok(/(Sol|Luna|Marte|Mercurio|Júpiter|Venus|Saturno)$/.test(await page.locator("#barra .tile[data-astro=dia] b").innerText()), "el regente del día");
  const panel = page.locator("#astro"); assert.ok(await panel.isHidden());
  await page.click("#barra .tile[data-astro=venus]"); assert.ok(await panel.isVisible() && (await page.locator("#astroTitulo").innerText()).includes("Venus en "), "Venus abre su explicación");
  assert.ok((await page.locator("#astroTexto p").count()) >= 2 && (await page.locator("#barra .tile[data-astro=venus]").getAttribute("aria-expanded")) === "true");
  await page.click("#barra .tile[data-astro=dia]"); assert.ok((await page.locator("#astroTitulo").innerText()).includes("Hoy rige"), "cambia al regente del día");
  await page.keyboard.press("Escape"); assert.ok(await panel.isHidden(), "Esc cierra");
  await page.click("#barra .tile[data-astro=luna]"); await page.click("#astroCerrar"); assert.ok(await panel.isHidden(), "la cruz cierra");
  assert.ok((await page.locator("#bFraseTexto").innerText()).length > 15 && (await page.locator("#bFraseAutor").innerText()).length > 2, "la frase con su autor");
  assert.ok((await page.locator(".tarjeta .fechas").first().innerText()).startsWith("Creado el "), "las cards tienen fecha");
  assert.equal(await page.locator("#orden button[aria-pressed=true]").getAttribute("data-orden"), "actividad");
  await page.click("#orden button[data-orden=nombre]"); const nombres = await page.locator("#grilla .tarjeta h3").allInnerTexts(); assert.deepEqual(nombres, nombres.slice().sort((a, b) => a.localeCompare(b, "es")), "ordenado por nombre");
  assert.ok((await page.evaluate(() => location.hash)).includes("orden=nombre")); await page.click("#orden button[data-orden=actividad]");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal");
  assert.equal(await page.locator("#cuenta").count(), 0, "la cuenta ya no está en el lateral");
  const primera = page.locator("#grilla .tarjeta").first(); assert.ok(await primera.locator(".mas").isHidden()); await primera.locator(".ver-mas").click(); assert.ok(await primera.locator(".mas").isVisible(), "«Qué es» despliega el detalle"); await primera.locator(".ver-mas").click(); assert.ok(await primera.locator(".mas").isHidden());
  // Los tres temas: la barra toma el fondo de cada uno.
  const fondos = new Set();
  for (const t of ["claro", "oscuro", "nocturno"]) { await page.click(`#temas button[data-tema=${t}]`); fondos.add(await barra.evaluate((e) => getComputedStyle(e).backgroundColor)); assert.ok(await page.evaluate(() => document.documentElement.dataset.tema) === t); }
  assert.equal(fondos.size, 3, "un fondo por tema");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sin scroll horizontal después de los temas");
  assert.deepEqual(errores, [], `errores en consola: ${errores.join(" | ")}`);
  assert.deepEqual(afuera, [], "no pide nada afuera");
  await page.screenshot({ path: path.join(require("node:os").tmpdir(), `vitrina-${viewport.width}.png`), fullPage: false });
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => {
  const { srv, url } = await servir(); const browser = await chromium.launch();
  try {
    await probar(browser, url, { width: 375, height: 740 });
    await probar(browser, url, { width: 1280, height: 800 });
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
