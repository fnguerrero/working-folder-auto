/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 (celular, táctil)
   y a 1280×800 (compu): eventos, personas, gastos en los cuatro modos, cuentas, transferencias
   hechas, redondeo, copiar el resumen, exportar, borrar, importar, recarga, PWA.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node apps/dividir-gastos/tests/e2e.js

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
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };

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

async function probar(navegador, url, viewport) {
  const celu = viewport.width < 700;
  const nombre = viewport.width + "×" + viewport.height;
  console.log(nombre + ":");
  const contexto = await navegador.newContext({ viewport, isMobile: celu, hasTouch: celu, locale: "es-AR",
    acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  const afuera = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  pagina.on("request", (r) => { if (!r.url().startsWith(url)) afuera.push(r.url()); });

  const paso = (t) => console.log("  ✓ " + t);
  // El texto visible, con un espacio entre cada pedazo (innerText pega los elementos flex).
  const texto = (sel) => pagina.locator(sel).evaluate((el) => {
    const partes = [];
    const recorrer = (n) => {
      if (n.nodeType === 3) { partes.push(n.textContent); return; }
      if (n.nodeType !== 1 || getComputedStyle(n).display === "none") return;
      if (n.tagName === "INPUT" || n.tagName === "SELECT") return;
      partes.push(" ");
      n.childNodes.forEach(recorrer);
      partes.push(" ");
    };
    recorrer(el);
    return partes.join("").replace(/\s+/g, " ").trim();
  });
  // Las tablas, una fila por renglón y las celdas separadas por un espacio.
  const tablaSaldos = () => pagina.locator("#tabla-saldos tr").evaluateAll((trs) =>
    trs.map((tr) => Array.from(tr.cells).map((c) => c.textContent.trim()).join(" ")).join("\n"));
  // En el celular hay solapas; en la compu están las tres secciones a la vista.
  const ir = async (tab) => {
    if (!celu) return;
    await pagina.click("#tab-" + tab);
    await pagina.waitForSelector(`#tab-${tab}[aria-selected=true]`);
  };
  const sinScroll = async (donde) => {
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(ancho <= viewport.width, `sin scroll horizontal en ${donde} (${ancho} px)`);
  };
  const botonesChicos = async (donde) => {
    const chicos = await pagina.locator("button:visible").evaluateAll((bs) =>
      bs.map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
    assert.deepEqual(chicos, [], `botones de menos de 44 px en ${donde}`);
  };

  await pagina.goto(url);
  await pagina.waitForSelector("#lista-eventos li");
  assert.match(await texto("#lista-eventos"), /Todavía no hay eventos/);
  await sinScroll("la lista vacía");
  paso("carga vacía");

  /* 1. Evento nuevo y personas. */
  await pagina.click("#btn-crear");
  assert.match(await texto("#ev-error"), /Ponele un nombre/);
  await pagina.fill("#ev-nombre", "Asado del sábado");
  await pagina.fill("#ev-fecha", "2026-10-24");
  await pagina.click("#btn-crear");
  await pagina.waitForSelector("#vista-evento:not(.oculto)");
  assert.match(await texto("#titulo"), /Asado del sábado 24\/10\/2026 · 0 personas/);
  assert.match(pagina.url(), /#\/e\/[^/]+\/personas$/);
  for (const [n, alias] of [["Nico", "nico.mp"], ["Juan", ""], ["Ana", ""], ["Pedro", ""], ["Lu", ""], ["Sofi", ""]]) {
    await pagina.fill("#p-nombre", n);
    await pagina.fill("#p-alias", alias);
    await pagina.press("#p-nombre", "Enter");
  }
  assert.equal(await pagina.locator("#lista-personas li[data-persona]").count(), 6);
  await pagina.fill("#p-nombre", "nico");
  await pagina.click("#btn-persona");
  assert.match(await texto("#p-error"), /Ya hay alguien que se llama nico/);
  await pagina.fill("#p-nombre", "");
  paso("evento con 6 personas, sin nombres repetidos");

  /* 2. Gastos. */
  await ir("gastos");
  const agregarGasto = async (desc, monto, pagador, ajustar) => {
    await pagina.click("#btn-nuevo-gasto");
    await pagina.fill("#g-desc", desc);
    await pagina.fill("#g-monto", monto);
    await pagina.selectOption("#g-pagador", { label: pagador });
    if (ajustar) await ajustar();
    await pagina.click("#btn-guardar-gasto");
    await pagina.waitForSelector("#form-gasto.oculto", { state: "attached" });
  };
  // Validación con el formulario vacío.
  await pagina.click("#btn-nuevo-gasto");
  await pagina.click("#btn-guardar-gasto");
  assert.ok(await pagina.locator("#form-gasto .campo.invalido").count() >= 2, "marca los campos vacíos");
  await pagina.click("#btn-cancelar-gasto");

  await agregarGasto("Carne y achuras", "30.000", "Nico");
  await agregarGasto("Bebidas", "12000", "Juan", async () => {
    await pagina.locator(".rp", { hasText: "Sofi" }).locator("input").uncheck();
    assert.match(await texto("#estado-reparto"), /entre 5 personas\. Cada uno: \$ 2\.400/);
    assert.equal(await texto(".rp:has-text('Sofi') .parte"), "");
    assert.equal(await texto(".rp:has-text('Ana') .parte"), "$ 2.400");
  });
  await agregarGasto("Carbón y pan", "6.000", "Ana");
  const gastos = await texto("#lista-gastos");
  assert.match(gastos, /Bebidas Pagó Juan · todos menos Sofi/);
  assert.match(gastos, /Carne y achuras Pagó Nico · entre todos/);
  assert.match(await texto("#cant-gastos"), /3 · \$ 48\.000/);
  paso("tres gastos, uno sin Sofi");

  /* 3. Cuentas: saldos y las 5 transferencias. */
  await ir("cuentas");
  assert.equal(await texto("#total"), "$ 48.000");
  const tabla = await tablaSaldos();
  assert.match(tabla, /Nico \$ 30\.000 \$ 8\.400 \+\$ 21\.600/);
  assert.match(tabla, /Sofi \$ 0 \$ 6\.000 -\$ 6\.000/);
  assert.equal(await pagina.locator(".transf").count(), 5);
  const transf = await texto("#transferencias");
  assert.match(transf, /Pedro le pasa a Nico Alias: nico\.mp \$ 8\.400/);
  assert.match(transf, /Ana le pasa a Juan \$ 2\.400/);
  assert.match(transf, /no hay forma de hacerlo con menos/);
  await sinScroll("cuentas");
  paso("saldos y 5 transferencias");

  /* 4. Copiar el resumen. */
  await pagina.click("#btn-copiar");
  await pagina.waitForSelector("#copiado:not(.oculto)");
  const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
  assert.match(copiado, /^\*Asado del sábado\* \(24\/10\/2026\)\nTotal: \$ 48\.000 entre 6 personas/);
  assert.match(copiado, /• Sofi → Nico: \$ 4\.800 \(alias nico\.mp\)/);
  assert.match(copiado, /\*Para quedar a mano\* \(5 transferencias\)/);
  paso("copiar el resumen para WhatsApp");

  /* 5. Transferencia hecha y deshacer. */
  await pagina.locator(".transf", { hasText: "Pedro le pasa a Nico" }).locator("button").click();
  assert.equal(await pagina.locator(".transf").count(), 4);
  assert.match(await texto("#pagos"), /Pedro → Nico .*\$ 8\.400 Deshacer/);
  assert.match(await tablaSaldos(), /Pedro \$ 0 \$ 8\.400 \$ 8\.400 \/ \$ 0 a mano/);
  await pagina.click("#pagos button[data-deshacer]");
  assert.equal(await pagina.locator(".transf").count(), 5);
  paso("marcar una transferencia como hecha y deshacerla");

  /* 6. Porcentaje y montos. */
  await ir("gastos");
  await agregarGasto("Regalo de Ana", "10.000", "Lu", async () => {
    // Sin Ana (es para ella), y al pasar a porcentaje se reparte parejo entre los 5 que quedan.
    await pagina.locator(".rp", { hasText: "Ana" }).locator("input").uncheck();
    await pagina.click(".modos label:has(input[value=porcentaje])");
    assert.equal(await pagina.locator(".rp", { hasText: "Nico" }).locator("input").inputValue(), "20");
    assert.equal(await pagina.locator(".rp", { hasText: "Ana" }).locator("input").inputValue(), "");
    await pagina.locator(".rp", { hasText: "Nico" }).locator("input").fill("40");
    assert.match(await texto("#estado-reparto"), /Los porcentajes suman 120 %: sobra 20 %/);
    await pagina.click("#btn-guardar-gasto");
    assert.match(await texto("#g-error"), /sobra 20 %/);
    await pagina.locator(".rp", { hasText: "Juan" }).locator("input").fill("0");
    assert.match(await texto("#estado-reparto"), /entre 4 personas/);
    assert.equal(await texto(".rp:has-text('Nico') .parte"), "$ 4.000");
  });
  await agregarGasto("Helado", "3.000", "Sofi", async () => {
    await pagina.click(".modos label:has(input[value=montos])");
    await pagina.locator(".rp", { hasText: "Sofi" }).locator("input").fill("1000");
    await pagina.locator(".rp", { hasText: "Lu" }).locator("input").fill("500");
    assert.match(await texto("#estado-reparto"), /faltan \$ 1\.500/);
    await pagina.click("[data-atajo=resto]");
    assert.equal(await pagina.locator(".rp", { hasText: "Nico" }).locator("input").inputValue(), "1500");
  });
  assert.match(await texto("#lista-gastos"), /Regalo de Ana Pagó Lu · todos menos Juan y Ana \(por porcentaje\)/);
  assert.match(await texto("#lista-gastos"), /Helado Pagó Sofi · entre Nico, Lu y Sofi \(por montos\)/);
  await ir("cuentas");
  assert.equal(await texto("#total"), "$ 61.000");
  // Nico: 30.000 - 8.400 - 4.000 - 1.500 = +16.100. Lu: 10.000 - 8.400 - 2.000 - 500 = -900.
  assert.match(await tablaSaldos(), /Nico \$ 30\.000 \$ 13\.900 \+\$ 16\.100/);
  assert.match(await tablaSaldos(), /Lu \$ 10\.000 \$ 10\.900 -\$ 900/);
  paso("gastos por porcentaje y por montos");

  /* 7. Editar un gasto y borrarlo con dos toques. */
  await ir("gastos");
  await pagina.locator("li[data-gasto]", { hasText: "Helado" }).locator("button[data-accion=editar]").click();
  assert.equal(await pagina.inputValue("#g-monto"), "3000");
  assert.ok(await pagina.isChecked("input[name=modo][value=montos]"));
  assert.equal(await pagina.locator(".rp", { hasText: "Nico" }).locator("input").inputValue(), "1500");
  await pagina.click("#btn-cancelar-gasto");
  await pagina.locator("li[data-gasto]", { hasText: "Helado" }).locator("button[data-accion=editar]").click();
  await pagina.click("#btn-borrar-gasto");
  assert.match(await pagina.innerText("#btn-borrar-gasto"), /Seguro/);
  await pagina.click("#btn-borrar-gasto");
  await pagina.waitForSelector("#form-gasto.oculto", { state: "attached" });
  assert.doesNotMatch(await texto("#lista-gastos"), /Helado/);
  await pagina.click("#btn-nuevo-gasto");
  assert.ok(!(await pagina.isVisible("#btn-borrar-gasto")), "un gasto nuevo no se borra");
  assert.equal(await pagina.inputValue("#g-desc"), "");
  await pagina.click("#btn-cancelar-gasto");
  // No se puede sacar a alguien que aparece en gastos.
  await ir("personas");
  await pagina.locator("li[data-persona]", { hasText: "Sofi" }).locator("button[data-accion=borrar]").click();
  assert.match(await texto("#p-error"), /Sofi aparece en 3 gastos: sacá a Sofi de ahí antes/);
  paso("editar, borrar y no dejar sacar a quien tiene gastos");

  if (celu) {
    for (const t of ["personas", "gastos", "cuentas"]) { await ir(t); await sinScroll(t); await botonesChicos(t); }
    paso("360 px sin scroll horizontal y botones de 44 px");
  } else {
    for (const t of ["personas", "gastos", "cuentas"]) assert.ok(await pagina.isVisible("#sec-" + t), "se ve " + t);
    assert.ok(!(await pagina.isVisible("#tabs")), "sin solapas en la compu");
    const [a, b, c] = await Promise.all(["personas", "gastos", "cuentas"].map((t) => pagina.locator("#sec-" + t).boundingBox()));
    assert.ok(a.x < b.x && b.x < c.x && Math.abs(a.y - c.y) < 2, "tres columnas");
    await sinScroll("el evento");
    paso("1280 px: las tres secciones en columnas");
  }

  /* 8. Redondeo en pesos: $1.000 entre 3. */
  await pagina.click("#btn-volver");
  await pagina.fill("#ev-nombre", "Pizza");
  await pagina.click("#btn-crear");
  for (const n of ["A", "B", "C"]) { await pagina.fill("#p-nombre", n); await pagina.press("#p-nombre", "Enter"); }
  await ir("gastos");
  await agregarGasto("Pizzas", "1000", "A");
  await ir("cuentas");
  assert.match(await tablaSaldos(), /A \$ 1\.000 \$ 333,34 \+\$ 666,66/);
  assert.match(await texto("#transferencias"), /B le pasa a A \$ 333 Ya la hizo C le pasa a A \$ 333 /);
  assert.match(await texto("#transferencias"), /Redondeado a pesos enteros: nadie pone ni recibe más de \$ 0,66/);
  await pagina.uncheck("#chk-redondear");
  assert.match(await texto("#transferencias"), /B le pasa a A \$ 333,33/);
  await pagina.check("#chk-redondear");
  // Después de las dos transferencias redondeadas, quedan todos a mano.
  await pagina.locator(".transf").first().locator("button").click();
  await pagina.locator(".transf").first().locator("button").click();
  assert.match(await texto("#transferencias"), /Están todos a mano/);
  paso("redondeo a pesos y a mano después de transferir");

  /* 9. Exportar, borrar e importar. */
  await pagina.click("#btn-volver");
  await pagina.locator("[data-evento]", { hasText: "Asado del sábado" }).click();
  await ir("cuentas");
  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btn-exportar")]);
  assert.equal(descarga.suggestedFilename(), "dividir-asado-del-sabado.json");
  const archivo = await descarga.path();
  const json = JSON.parse(fs.readFileSync(archivo, "utf8"));
  assert.equal(json.evento.gastos.length, 4);
  await pagina.click("#btn-borrar-evento");
  assert.match(await texto("#btn-borrar-evento"), /Tocá de nuevo/);
  await pagina.click("#btn-borrar-evento");
  await pagina.waitForSelector("#vista-eventos:not(.oculto)");
  assert.doesNotMatch(await texto("#lista-eventos"), /Asado/);
  await pagina.setInputFiles("#in-importar", archivo);
  await pagina.waitForSelector("#vista-evento:not(.oculto)");
  await ir("cuentas");
  assert.equal(await texto("#total"), "$ 58.000");
  assert.equal(await pagina.locator(".transf").count(), 5);
  await pagina.click("#btn-volver");
  await pagina.setInputFiles("#in-importar", { name: "x.json", mimeType: "application/json", buffer: Buffer.from("{roto") });
  await pagina.waitForFunction(() => /no es un JSON válido/.test(document.querySelector("#import-estado").textContent));
  paso("exportar, eliminar con dos toques e importar");

  /* 10. Recarga y el ejemplo. */
  await pagina.reload();
  await pagina.waitForSelector("#lista-eventos li");
  const lista = await texto("#lista-eventos");
  assert.match(lista, /Asado del sábado 24\/10\/2026 · 6 personas · 5 transferencias pendientes \$ 58\.000/);
  assert.match(lista, /Pizza .* todos a mano \$ 1\.000/);
  await pagina.click("#btn-ejemplo");
  await pagina.waitForSelector("#vista-evento:not(.oculto)");
  await ir("cuentas");
  assert.equal(await texto("#total"), "$ 48.000");
  await pagina.goBack();
  await pagina.waitForSelector("#vista-eventos:not(.oculto)");
  assert.equal(await pagina.locator("[data-evento]").count(), 3);
  paso("persiste al recargar, el ejemplo y el botón atrás");

  /* 11. PWA. */
  const manifest = await pagina.evaluate(() => fetch("manifest.json").then((r) => r.json()));
  assert.equal(manifest.name, "Dividir gastos");
  await pagina.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => Boolean(r)));
  paso("manifest y service worker");

  assert.deepEqual(afuera, [], "no pide nada afuera");
  assert.deepEqual(errores, [], "sin errores de consola");
  await contexto.close();
}

(async () => {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try {
    await probar(navegador, url, { width: 360, height: 740 });
    await probar(navegador, url, { width: 1280, height: 800 });
    console.log("Todo en orden.");
  } finally {
    await navegador.close();
    srv.close();
  }
})().catch((e) => { console.error("FALLÓ:", e.message || e); process.exit(1); });
