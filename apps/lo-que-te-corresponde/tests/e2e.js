/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360 px (celular)
   y a 1280 px (escritorio). Correr desde la raíz del repo:
     node apps/lo-que-te-corresponde/tests/e2e.js
   Si Playwright está instalado en otro lado, apuntá NODE_PATH a su node_modules. */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

let chromium;
try { ({ chromium } = require("playwright")); } catch (e) {
  console.error("Falta Playwright. Instalalo con: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}
const L = require("../logica.js");
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };
const CAPTURAS = process.env.CAPTURAS || "";

function servir() {
  return new Promise((resolver) => {
    const srv = http.createServer((req, res) => {
      const ruta = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
      const archivo = path.normalize(path.join(RAIZ, ruta));
      if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      fs.createReadStream(archivo).pipe(res);
    });
    srv.listen(0, "127.0.0.1", () => resolver({ srv, url: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

async function recorrido(navegador, { ancho, alto, movil }) {
  console.log(`\n== ${ancho} px ==`);
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto }, isMobile: movil, hasTouch: movil, locale: "es-AR" });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  pagina.on("pageerror", (e) => errores.push(String(e)));
  const paso = (n) => console.log("  ✓ " + n);
  const texto = async (sel) => (await pagina.locator(sel).innerText()).replace(/\s+/g, " ").trim();
  const visible = (sel) => pagina.locator(sel).isVisible();

  await pagina.goto(url);
  await pagina.waitForSelector("#liq-vacio");
  assert.ok(await visible("#liq-vacio"));
  assert.ok(!(await visible("#liq-con-datos")));
  assert.ok(!(await pagina.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "sin scroll horizontal");
  paso("carga sin resultado y sin scroll horizontal");

  // Liquidación: el caso de los tests unitarios.
  await pagina.fill("#liq-ingreso", "2019-05-15");
  await pagina.fill("#liq-egreso", "2024-10-13");
  await pagina.fill("#liq-sueldo", "1.000.000");
  await pagina.dispatchEvent("#liq-sueldo", "input");
  await pagina.waitForSelector("#liq-con-datos:not(.oculto)");
  const esperado = L.liquidacionFinal({ ingreso: "2019-05-15", egreso: "2024-10-13", sueldo: 1000000, motivo: "despido" });
  assert.equal(await texto("#liq-neto"), L.fmt(esperado.totales.neto));
  assert.equal(await texto("#liq-bruto"), L.fmt(esperado.totales.bruto));
  assert.equal(await pagina.locator("#liq-conceptos tr").count(), 9);
  assert.ok((await texto("#liq-antiguedad")).includes("5 años, 4 meses, 29 días"));
  assert.ok((await texto("#liq-antiguedad")).includes("6 años"));
  assert.ok((await texto("#liq-conceptos")).includes("Integración del mes de despido"));
  paso("despido sin causa: neto, bruto y nueve conceptos");

  await pagina.locator("#liq-sueldo").blur();
  assert.equal(await pagina.inputValue("#liq-sueldo"), "1.000.000");
  paso("el sueldo se reescribe con puntos de miles");

  await pagina.check("#liq-preaviso");
  await pagina.waitForFunction(() => document.querySelectorAll("#liq-conceptos tr").length === 5);
  assert.ok((await texto("#liq-avisos")).includes("preaviso se otorgó"));
  paso("con preaviso otorgado desaparecen preaviso e integración");
  await pagina.uncheck("#liq-preaviso");

  await pagina.selectOption("#liq-motivo", "renuncia");
  await pagina.waitForFunction(() => document.querySelectorAll("#liq-conceptos tr").length === 4);
  assert.ok(!(await visible("#liq-mejor")));
  assert.ok((await texto("#liq-avisos")).includes("renuncia"));
  paso("renuncia: cuatro conceptos y se esconden los campos de despido");
  await pagina.selectOption("#liq-motivo", "despido");
  await pagina.waitForFunction(() => document.querySelectorAll("#liq-conceptos tr").length === 9);

  // Período de prueba.
  await pagina.fill("#liq-ingreso", "2024-08-01");
  await pagina.waitForFunction(() => (document.querySelector("#liq-avisos").textContent || "").includes("período de prueba"));
  assert.ok((await texto("#liq-conceptos")).includes("15 días"));
  assert.ok(!(await texto("#liq-conceptos")).includes("Indemnización por antigüedad"));
  paso("período de prueba: 15 días de preaviso y sin antigüedad");

  // Tope con Vizzoti.
  await pagina.fill("#liq-ingreso", "2014-01-01");
  await pagina.locator("details.solo-despido summary").click();
  await pagina.fill("#liq-tope", "100000");
  await pagina.dispatchEvent("#liq-tope", "input");
  await pagina.waitForFunction(() => (document.querySelector("#liq-conceptos").textContent || "").includes("Vizzoti"));
  paso("tope bajo: se aplica el piso del 67 % (Vizzoti)");
  await pagina.fill("#liq-tope", "");
  await pagina.dispatchEvent("#liq-tope", "input");

  // Errores.
  await pagina.fill("#liq-egreso", "2010-01-01");
  await pagina.waitForFunction(() => document.querySelector("#liq-egreso").closest(".campo").classList.contains("invalido"));
  assert.ok((await texto("#liq-egreso + .error")).includes("antes del ingreso"));
  assert.ok(!(await visible("#liq-con-datos")));
  paso("egreso anterior al ingreso: error visible y sin resultado");
  await pagina.fill("#liq-egreso", "2024-10-13");
  await pagina.fill("#liq-sueldo", "un millón");
  await pagina.dispatchEvent("#liq-sueldo", "input");
  await pagina.waitForFunction(() => (document.querySelector("#liq-sueldo + .ayuda + .error").textContent || "").includes("No entiendo"));
  paso("sueldo ilegible: error");
  await pagina.fill("#liq-sueldo", "1000000,50");
  await pagina.dispatchEvent("#liq-sueldo", "input");
  await pagina.waitForSelector("#liq-con-datos:not(.oculto)");

  // Copiar.
  await contexto.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await pagina.click("#liq-copiar");
  const copiado = await pagina.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (copiado) {
    assert.ok(copiado.includes("Liquidación final") && copiado.includes("Neto estimado"));
    paso("copiar el detalle deja texto en el portapapeles");
  } else paso("copiar el detalle (portapapeles no disponible acá, se omitió el chequeo)");

  // Persistencia.
  await pagina.reload();
  await pagina.waitForSelector("#liq-con-datos:not(.oculto)");
  assert.equal(await pagina.inputValue("#liq-ingreso"), "2014-01-01");
  assert.equal(await pagina.inputValue("#liq-sueldo"), "1000000,50");
  paso("al recargar quedan los datos");

  // Aguinaldo.
  await pagina.click("#tab-aguinaldo");
  assert.ok(await visible("#aguinaldo"));
  await pagina.fill("#sac-sueldo", "2.000.000");
  await pagina.dispatchEvent("#sac-sueldo", "input");
  await pagina.fill("#sac-fecha", "2024-06-30");
  await pagina.waitForSelector("#sac-con-datos:not(.oculto)");
  assert.equal(await texto("#sac-bruto"), L.fmt(1000000));
  assert.equal(await texto("#sac-neto"), L.fmt(830000));
  assert.ok((await texto("#sac-pago")).includes("30 de junio de 2024"));
  await pagina.fill("#sac-ingreso", "2024-04-01");
  await pagina.waitForFunction(() => (document.querySelector("#sac-detalle").textContent || "").includes("91 de 182"));
  paso("aguinaldo completo y proporcional");

  // Vacaciones.
  await pagina.click("#tab-vacaciones");
  await pagina.fill("#vac-ingreso", "2016-03-01");
  await pagina.fill("#vac-anio", "2024");
  await pagina.fill("#vac-sueldo", "1.500.000");
  await pagina.dispatchEvent("#vac-sueldo", "input");
  await pagina.waitForSelector("#vac-con-datos:not(.oculto)");
  assert.equal(await texto("#vac-dias"), "21 días");
  assert.equal(await texto("#vac-bruto"), L.fmt(1260000));
  assert.ok(!(await visible("#vac-campo-reales")));
  await pagina.fill("#vac-ingreso", "2024-09-01");
  await pagina.waitForFunction(() => document.querySelector("#vac-dias").textContent.trim() === "4 días");
  assert.ok(await visible("#vac-campo-reales"));
  await pagina.fill("#vac-reales", "100");
  await pagina.waitForFunction(() => document.querySelector("#vac-dias").textContent.trim() === "5 días");
  paso("vacaciones por escala y por días trabajados");

  await pagina.click("#tab-como");
  assert.ok(await visible("#como"));
  assert.ok((await texto("#como")).includes("Vizzoti"));
  paso("pestaña de cómo se calcula");

  // Tamaño táctil.
  const chicos = await pagina.evaluate(() => Array.from(document.querySelectorAll("button, input, select"))
    .filter((el) => el.offsetParent !== null && el.type !== "checkbox")
    .map((el) => ({ id: el.id || el.textContent.trim(), h: el.getBoundingClientRect().height }))
    .filter((x) => x.h < 44));
  assert.deepEqual(chicos, [], "todo lo tocable mide al menos 44 px");
  paso("controles de al menos 44 px");

  if (CAPTURAS) {
    await pagina.click("#tab-liquidacion");
    await pagina.screenshot({ path: path.join(CAPTURAS, `liquidacion-${ancho}.png`), fullPage: true });
  }
  assert.deepEqual(errores, [], "sin errores de consola");
  paso("sin errores de consola");
  await contexto.close();
}

let url;
async function main() {
  const s = await servir();
  url = s.url;
  const navegador = await chromium.launch();
  try {
    await recorrido(navegador, { ancho: 360, alto: 740, movil: true });
    await recorrido(navegador, { ancho: 1280, alto: 900, movil: false });
    console.log("\nTodo bien.");
  } finally {
    await navegador.close();
    s.srv.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
