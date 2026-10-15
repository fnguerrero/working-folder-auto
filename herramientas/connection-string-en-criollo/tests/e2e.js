/* Prueba de extremo a extremo en Chromium headless con Playwright, a 360×740 y a 1280×720: carga sin errores,
   los ejemplos se analizan con el proveedor correcto, aparecen los avisos y la tabla, la contraseña va tapada y
   se destapa con el checkbox, el proveedor forzado cambia el análisis, la URI de Postgres se arma, los
   snippets se generan, y nada desborda a 360 px.

   Cómo correrla (desde la raíz del repo):
     npx --yes playwright@1.56.1 install chromium      # una sola vez
     node herramientas/connection-string-en-criollo/tests/e2e.js */
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

async function probar(browser, url, viewport, capturaEn) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const contexto = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR" });
  const page = await contexto.newPage();
  const errores = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  await page.goto(url);
  await esperar(200);
  const requests = [];
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });

  assert.ok(await page.locator("#salida").isHidden(), "sin cadena no hay salida");
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);

  // Ejemplo de SQL Server: detectado, resumen, avisos rojos, tabla, contraseña tapada.
  await page.click("#ejemplos button:nth-child(1)");
  await esperar(150);
  assert.ok(await page.locator("#salida").isVisible());
  assert.match(await page.textContent("#detectado"), /SQL Server/);
  assert.match(await page.textContent("#resumen"), /^Te conectás a SQL Server en «srv-sql01\\PROD,1433», base «Ventas», como «sa»/);
  assert.ok((await page.locator(".aviso.peligro").count()) >= 3, "hay avisos de peligro");
  assert.match(await page.textContent(".aviso.peligro h3"), /escáner|TrustServerCertificate|sa/);
  const filas = await page.locator("#tabla tbody tr:not(.cat)").count();
  assert.equal(filas, 9, `una fila por clave (${filas})`);
  const valorPass = await page.textContent("#tabla tr.secreta td.valor");
  assert.match(valorPass, /^•+$/, "la contraseña va tapada");
  assert.ok(!(await page.textContent("#normalizada")).includes("P@ssw0rd"), "la cadena normalizada no muestra la contraseña");
  assert.ok((await page.textContent("#appsettings")).includes("<SECRETO>"), "appsettings sin contraseña");
  await page.check("#mostrarSecretos");
  await esperar(100);
  assert.equal(await page.textContent("#tabla tr.secreta td.valor"), "P@ssw0rd", "con el checkbox se ve");
  assert.ok((await page.textContent("#userSecrets")).includes("P@ssw0rd"), "user-secrets con la real");
  await page.uncheck("#mostrarSecretos");
  await esperar(100);
  assert.ok((await page.textContent("#userSecrets")).includes("<SECRETO>"), "user-secrets tapado de nuevo");
  assert.ok(await sinScroll(), `sin scroll horizontal con resultados (${nombre})`);
  assert.ok(await page.locator("#bloqueUri").isHidden(), "SQL Server no tiene URI");

  // Postgres como URI: se traduce, y la URI de vuelta se arma.
  await page.click("#ejemplos button:nth-child(4)");
  await esperar(150);
  assert.match(await page.textContent("#detectado"), /PostgreSQL/);
  assert.match(await page.textContent("#resumen"), /«db.interno:5432», base «ventas», como «ventas_app», cifrado/);
  assert.ok(await page.locator("#bloqueUri").isVisible());
  assert.match(await page.textContent("#uri"), /^postgresql:\/\/ventas_app:<SECRETO>@db\.interno:5432\/ventas\?sslmode=require&application_name=api-ventas$/);
  assert.ok((await page.locator("#tabla tbody tr:not(.cat)").count()) >= 6);

  // Redis.
  await page.click("#ejemplos button:nth-child(6)");
  await esperar(150);
  assert.match(await page.textContent("#detectado"), /Redis/);
  assert.match(await page.textContent("#resumen"), /^Te conectás a Redis/);
  assert.ok((await page.textContent("#avisos")).includes("Azure Cache for Redis sin TLS"));

  // Escribir a mano, con el proveedor forzado.
  await page.fill("#entrada", "Server=db;Database=x;User=u;Password=p;SslMode=None;Zarasa=1");
  await esperar(250);
  assert.match(await page.textContent("#detectado"), /MySQL/);
  assert.ok((await page.locator("#tabla tr.desconocida").count()) === 1, "Zarasa queda marcada como desconocida");
  await page.selectOption("#proveedor", "sqlserver");
  await esperar(150);
  assert.match(await page.textContent("#detectado"), /^SQL Server/);
  assert.ok((await page.locator("#tabla tr.desconocida").count()) >= 2, "SslMode y Zarasa no son de SQL Server");
  await page.selectOption("#proveedor", "");

  // Algo que no es una cadena.
  await page.fill("#entrada", "hola qué tal");
  await esperar(250);
  assert.match(await page.textContent("#resumen"), /No reconozco el formato/);

  // Limpiar.
  await page.click("#limpiar");
  await esperar(100);
  assert.ok(await page.locator("#salida").isHidden(), "limpiar oculta la salida");

  // Nada salió a la red.
  assert.deepEqual(requests, [], "no hubo pedidos a otros dominios");

  if (capturaEn) { await page.click("#ejemplos button:nth-child(1)"); await esperar(200); await page.screenshot({ path: capturaEn }); }
  assert.deepEqual(errores, [], `sin errores de consola (${nombre})`);
  await contexto.close();
  console.log(`ok ${nombre}`);
}

(async () => {
  const { srv, url } = await servir();
  const browser = await chromium.launch();
  const capturas = process.env.CAPTURAS;
  try {
    await probar(browser, url, { width: 360, height: 740 }, capturas && path.join(capturas, "cs-360.png"));
    await probar(browser, url, { width: 1280, height: 720 }, capturas && path.join(capturas, "cs-1280.png"));
    console.log("Connection string en criollo: todo ok");
  } finally { await browser.close(); srv.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
