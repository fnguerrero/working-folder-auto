/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular) y a 1280 px.
   Recorre: carga, ejemplos, hallazgos, árbol con detalle, resaltado desde un hallazgo, pestañas de sentencias,
   pegar un XML inválido, abrir un .sqlplan por archivo, copiar, recarga con lo guardado, glosario, modo oscuro
   y tamaño de los controles. Sin errores de consola.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node herramientas/plan-en-criollo/tests/e2e.js */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) { console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium"); process.exit(2); }

const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".md": "text/markdown", ".sqlplan": "application/xml" };
const CAPTURAS = process.env.CAPTURAS || "";

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const limpia = req.url.split("?")[0];
      const ruta = limpia === "/" ? "/index.html" : decodeURIComponent(limpia);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end("no está"); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function recorrido(navegador, url, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR", permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const sinScrollH = async () => assert.ok((await pagina.evaluate(() => document.documentElement.scrollWidth)) <= viewport.width + 1, "sin scroll horizontal");
  const captura = async (n) => { if (CAPTURAS) await pagina.screenshot({ path: path.join(CAPTURAS, `${n}-${viewport.width}.png`), fullPage: true }); };

  await pagina.goto(url);
  await pagina.waitForSelector("#ejemplos button");
  assert.equal(await pagina.locator("#ejemplos button").count(), 12);
  assert.ok(await pagina.locator("#resultado").isHidden());
  assert.ok((await pagina.locator("#glosario details").count()) > 40);
  await sinScrollH();
  paso("carga vacía con ejemplos y glosario");

  await pagina.click("#ejemplos button[data-ejemplo='sniffing']");
  await pagina.waitForSelector("#resultado:not(.oculto)");
  assert.match(await texto("#frase"), /devolvió 100\.000 filas \(estimaba 6\), serial/);
  assert.match(await texto("#veredicto"), /4 problemas serios/);
  const titulos = await pagina.locator("#hallazgos h3").allInnerTexts();
  assert.match(titulos[0], /Key Lookup sobre dbo\.Pedidos: 100\.000 veces/);
  assert.ok(titulos.some((t) => /derramó a tempdb/.test(t)));
  assert.ok(titulos.some((t) => /se compiló con @ClienteId = \(4242\) y corrió con \(1\)/.test(t)));
  assert.equal(await pagina.locator("#arbol .nodo").count(), 4);
  assert.match(await texto("#pesados tr:first-child"), /Key Lookup/);
  assert.match(await texto("#parametros"), /@ClienteId.*int.*\(4242\).*\(1\)/);
  assert.match(await texto("#esperas"), /IO_COMPLETION/);
  assert.match(await texto("#hallazgos pre"), /CREATE NONCLUSTERED INDEX \[IX_Pedidos_ClienteId\]/);
  await sinScrollH();
  await captura("sniffing");
  paso("ejemplo de parameter sniffing: frase, hallazgos, árbol, parámetros, esperas y script");

  // Detalle de un nodo y resaltado desde un hallazgo
  assert.ok(await pagina.locator("#arbol .detalle").first().isHidden());
  await pagina.click("#arbol .nodo >> nth=0");
  assert.ok(await pagina.locator("#arbol .detalle").first().isVisible());
  assert.match(await texto("#arbol .detalle >> nth=0"), /Ordena por p\.Fecha desc/);
  await pagina.click("#hallazgos .ver-op >> nth=0");
  await pagina.waitForSelector(".nodo.resaltado");
  assert.match(await texto(".nodo.resaltado"), /Key Lookup/);
  assert.match(await texto(".nodo.resaltado + .detalle"), /Busca por p\.PedidoId/);
  await pagina.click("#btn-expandir");
  assert.equal(await pagina.locator("#arbol .detalle.abierto").count(), 4);
  assert.equal(await texto("#btn-expandir"), "Cerrar todos los detalles");
  paso("detalle de operador, resaltado desde el hallazgo y abrir todos");

  // Plan paralelo con rama no ejecutada
  await pagina.click("#ejemplos button[data-ejemplo='paralelo']");
  await pagina.waitForFunction(() => /4 hilos/.test(document.getElementById("frase").textContent));
  assert.equal(await pagina.locator("#arbol .nodo.apagado").count(), 1);
  assert.match(await texto("#arbol .nodo.apagado"), /no se ejecutó/);
  assert.match(await texto("#datos"), /4 hilos/);
  assert.ok(!/erró las filas/.test((await pagina.locator("#hallazgos").innerText())));
  await sinScrollH();
  await captura("paralelo");
  paso("plan paralelo: rama alternativa apagada, sin falso desvío");

  // Plan estimado y conversión
  await pagina.click("#ejemplos button[data-ejemplo='estimado']");
  await pagina.waitForFunction(() => /estima 6 filas/.test(document.getElementById("frase").textContent));
  assert.match((await pagina.locator("#hallazgos h3").allInnerTexts())[0], /plan estimado/);
  assert.match(await texto("#datos"), /plan estimado/);
  await pagina.click("#ejemplos button[data-ejemplo='conversion']");
  await pagina.waitForFunction(() => /Conversión implícita/.test(document.getElementById("hallazgos").textContent));
  assert.match(await texto("#hallazgos .hallazgo.alta"), /IsAnsi = true/);
  paso("plan estimado y conversión implícita");

  // XML inválido y vacío
  await pagina.fill("#xml", "<html><body>esto no es un plan</body></html>");
  await pagina.click("#btn-analizar");
  await pagina.waitForSelector("#error:not(.oculto)");
  assert.match(await texto("#error"), /No parece un plan/);
  assert.ok(await pagina.locator("#resultado").isHidden());
  await pagina.fill("#xml", "<ShowPlanXML><BatchSequence>");
  await pagina.click("#btn-analizar");
  assert.match(await texto("#error"), /sin cerrar/);
  await pagina.click("#btn-limpiar");
  assert.equal(await pagina.inputValue("#xml"), "");
  assert.ok(await pagina.locator("#error").isHidden());
  paso("errores con mensaje y limpiar");

  // Abrir archivo .sqlplan
  await pagina.setInputFiles("#archivo", path.join(__dirname, "planes", "timeout.sqlplan"));
  await pagina.waitForFunction(() => /sin tiempo/.test(document.getElementById("hallazgos").textContent));
  assert.match(await texto("#estado-archivo"), /timeout\.sqlplan/);
  assert.equal(await pagina.locator("#arbol .nodo").count(), 30);
  await sinScrollH();
  await captura("timeout");
  paso("abrir un .sqlplan desde archivo (30 operadores, sin scroll horizontal)");

  // Recarga: queda el último plan
  await pagina.reload();
  await pagina.waitForSelector("#resultado:not(.oculto)");
  assert.match(await texto("#estado-archivo"), /Último plan analizado/);
  assert.equal(await pagina.locator("#arbol .nodo").count(), 30);
  paso("recarga con el último plan guardado");

  // Copiar (solo escritorio, con permisos de portapapeles)
  if (!movil) {
    await pagina.click("#btn-copiar-arbol");
    const arbol = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(arbol, /^\[\s*\d+ %\] Top/);
    await pagina.click("#btn-copiar-informe");
    const informe = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(informe, /PLAN EN CRIOLLO/);
    assert.match(informe, /\[MEDIA\] El optimizador se quedó sin tiempo/);
    await pagina.waitForSelector("#toast.visible");
    paso("copiar árbol y diagnóstico");
  }

  // Glosario
  await pagina.fill("#glos-filtro", "spool");
  assert.equal(await pagina.locator("#glosario details").count(), 4);
  await pagina.fill("#glos-filtro", "zzz");
  assert.match(await texto("#glosario"), /Ningún operador/);
  await pagina.fill("#glos-filtro", "");
  paso("glosario con filtro");

  // Controles de 40 px y modo oscuro
  const alturas = await pagina.$$eval("button:not(.chico):not(.ver-op), .boton-archivo", (els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height));
  assert.ok(alturas.every((h) => h >= 36), `controles chicos: ${alturas.filter((h) => h < 36)}`);
  await pagina.emulateMedia({ colorScheme: "dark" });
  const bg = await pagina.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, "rgb(17, 17, 20)");
  await captura("oscuro");
  paso("controles táctiles y modo oscuro");

  assert.deepEqual(errores, [], "sin errores de consola");
  await contexto.close();
}

(async () => {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try {
    await recorrido(navegador, url, { width: 360, height: 740 }, true);
    await recorrido(navegador, url, { width: 1280, height: 900 }, false);
    console.log("E2E OK");
  } catch (e) {
    console.error("E2E FALLÓ:", e);
    process.exitCode = 1;
  } finally {
    await navegador.close();
    srv.close();
  }
})();
