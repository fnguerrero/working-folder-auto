/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular) y a escritorio.
   Recorre: ejemplo, generación en vivo, opciones, pestaña TypeScript, error con línea y columna,
   formatear, copiar, descargar, recarga con lo guardado y tamaño de los botones.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node herramientas/json-a-csharp/tests/e2e.js */
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

async function recorrido(navegador, url, viewport, movil) {
  const contexto = await navegador.newContext({ viewport, isMobile: movil, hasTouch: movil, locale: "es-AR",
    acceptDownloads: true, permissions: movil ? [] : ["clipboard-read", "clipboard-write"] });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log(`  ✓ [${viewport.width}px] ${n}`);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const codigo = () => pagina.locator("#codigo").innerText();

  await pagina.goto(url);
  await pagina.waitForSelector("#btn-ejemplo");
  assert.match(await texto("#estado-entrada"), /Pegá un JSON/);
  paso("carga vacía");

  await pagina.click("#btn-ejemplo");
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("public class Pedido"));
  assert.match(await texto("#estado-salida"), /4 clases, \d+ propiedades/);
  assert.match(await codigo(), /public required Dictionary<string, double> TotalesPorMes/);
  assert.equal(await pagina.inputValue("#op-nombreRaiz"), "Pedido");
  assert.ok((await pagina.locator("#codigo .kw").count()) > 10, "resaltado");
  paso("ejemplo genera 4 clases con resaltado");

  await pagina.selectOption("#op-estilo", "record");
  await pagina.selectOption("#op-atributos", "newtonsoft");
  await pagina.selectOption("#op-decimales", "decimal");
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("public record Pedido("));
  assert.match(await codigo(), /\[property: JsonProperty\("razon_social"\)\] string RazonSocial/);
  assert.match(await codigo(), /decimal PrecioUnitario/);
  paso("cambiar opciones regenera en vivo");

  await pagina.click("#tab-ts");
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("export interface Pedido"));
  assert.match(await texto("#estado-salida"), /4 interfaces/);
  assert.ok(await pagina.locator("#op-estilo").isDisabled(), "opciones de C# deshabilitadas en TS");
  await pagina.click("#tab-cs");
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("public record Pedido("));
  paso("pestaña TypeScript");

  await pagina.fill("#entrada", '{\n  "a": 1,\n  "b": tru\n}');
  await pagina.waitForFunction(() => document.getElementById("estado-entrada").classList.contains("error"));
  assert.match(await texto("#estado-entrada"), /línea 3, columna 8/);
  assert.equal(await codigo(), "");
  paso("error con línea y columna");

  await pagina.fill("#entrada", '{"a":[1,{"b":null}]}');
  await pagina.click("#btn-formatear");
  assert.equal(await pagina.inputValue("#entrada"), '{\n  "a": [\n    1,\n    {\n      "b": null\n    }\n  ]\n}');
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("[property: JsonProperty(\"a\")] List<JToken> A"));
  paso("formatear");

  if (!movil) {
    await pagina.click("#btn-copiar");
    await pagina.waitForSelector("#aviso.visible");
    assert.equal(await texto("#aviso"), "Copiado");
    const portapapeles = await pagina.evaluate(() => navigator.clipboard.readText());
    assert.match(portapapeles, /public record Pedido\(/);
    paso("copiar al portapapeles");
  }

  const [descarga] = await Promise.all([pagina.waitForEvent("download"), pagina.click("#btn-descargar")]);
  assert.equal(descarga.suggestedFilename(), "Pedido.cs");
  const contenido = fs.readFileSync(await descarga.path(), "utf8");
  assert.match(contenido, /public record Pedido\(/);
  paso("descargar .cs");

  await pagina.reload();
  await pagina.waitForFunction(() => document.getElementById("codigo").textContent.includes("public record Pedido("));
  assert.equal(await pagina.inputValue("#op-estilo"), "record");
  assert.match(await pagina.inputValue("#entrada"), /"b": null/);
  paso("recarga con JSON y opciones guardadas");

  await pagina.click("#btn-limpiar");
  assert.equal(await pagina.inputValue("#entrada"), "");
  assert.match(await texto("#estado-entrada"), /Pegá un JSON/);
  paso("limpiar");

  const chicos = await pagina.evaluate(() => [...document.querySelectorAll("button, select, input[type=text]")]
    .map((b) => ({ id: b.id || b.textContent.trim(), h: b.getBoundingClientRect().height }))
    .filter((b) => b.h < 40));
  assert.deepEqual(chicos, [], "todos los controles miden al menos 40 px");
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(ancho, "sin scroll horizontal");
  paso("controles de 40 px y sin scroll horizontal");

  assert.deepEqual(errores, [], "sin errores de consola");
  await contexto.close();
}

async function main() {
  const { srv, url } = await servir();
  const navegador = await chromium.launch();
  try {
    await recorrido(navegador, url, { width: 360, height: 740 }, true);
    await recorrido(navegador, url, { width: 1280, height: 800 }, false);
    console.log("Todo OK");
  } finally {
    await navegador.close();
    srv.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
