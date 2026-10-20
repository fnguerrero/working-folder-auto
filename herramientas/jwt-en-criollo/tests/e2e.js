/* E2e en Chromium headless (Playwright) a 360×740 y 1280×800: ejemplos, estado, claims, avisos, firma (secreto, PEM, JWKS, x5c), C# y memoria.
     node herramientas/jwt-en-criollo/tests/e2e.js */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const assert = require("node:assert/strict");
let chromium; try { ({ chromium } = require("playwright")); } catch { console.error("Falta Playwright: npm i -D playwright && npx playwright install chromium"); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const E = require("../ejemplos.js");
const AHORA = 1792477000; // 1000 s después del iat de los ejemplos estáticos
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { const ruta = req.url.split("?")[0] === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]); const a = path.normalize(path.join(RAIZ, ruta)); if (!a.startsWith(RAIZ) || !fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": a.endsWith(".js") ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/` })); }); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function probar(browser, url, viewport) {
  const nombre = `${viewport.width}×${viewport.height}`;
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 700, locale: "es-AR", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage(); const errores = []; const requests = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); }); page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => { if (!r.url().startsWith(url)) requests.push(r.url()); });
  await page.goto(url + "?ahora=" + AHORA); await esperar(600);
  const sinScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await sinScroll(), `sin scroll horizontal (${nombre})`);
  // Por defecto: la API propia, vigente, con sus claims y los avisos de mapeo.
  assert.match(await page.textContent("#estado"), /Vigente.*vence en 1 h/);
  assert.match(await page.textContent("#header"), /HS256.*la misma clave firma y verifica/);
  assert.match(await page.textContent("#claims"), /sub.*1042.*A quién identifica/s);
  assert.match(await page.textContent("#claims"), /ClaimTypes\.NameIdentifier/);
  assert.match(await page.textContent("#avisos"), /User\.Identity\.Name va a salir null/);
  assert.match(await page.textContent("#cs"), /ValidAudience = "ejemplo-web"/);
  assert.match(await page.textContent("#tamanio"), /caracteres: header/);
  assert.equal(await page.locator("#partes .h").count(), 1);
  // Verificar con el secreto del ejemplo: válida; con otro: no.
  await page.click("#usarEjemplo"); await esperar(400);
  assert.match(await page.textContent("#firma"), /✔ Firma válida con el secreto \(37 bytes\)/);
  await page.fill("#clave", "otra-clave"); await esperar(500);
  assert.match(await page.textContent("#firma"), /✘ La firma no coincide/);
  // Keycloak: vencido, roles anidados, PEM.
  await page.click("#ejemplos button:has-text('Keycloak')"); await esperar(500);
  assert.match(await page.textContent("#estado"), /Vencido: venció hace 11 min/);
  assert.match(await page.textContent("#claims"), /realm_access.*facturacion-admin/s);
  assert.match(await page.textContent("#avisos"), /Roles anidados/);
  assert.match(await page.textContent("#cs"), /o\.Authority = "https:\/\/sso\.empresa\.com\.ar/);
  await page.click("#usarEjemplo"); await esperar(500);
  assert.match(await page.textContent("#firma"), /✔ Firma válida con la clave pública/);
  // Entra: JWKS con kid.
  await page.click("#ejemplos button:has-text('Entra')"); await esperar(500);
  assert.match(await page.textContent("#claims"), /oid.*identificador estable/s);
  await page.click("#usarEjemplo"); await esperar(500);
  assert.match(await page.textContent("#firma"), /✔ Firma válida con la clave del JWK/);
  // ES256 con x5c: el botón del header.
  await page.click("#ejemplos button:has-text('ES256')"); await esperar(500);
  assert.match(await page.textContent("#estado"), /Vencido, en gracia/);
  assert.ok(await page.locator("#usarX5c").isVisible());
  await page.click("#usarX5c"); await esperar(500);
  assert.match(await page.textContent("#firma"), /✔ Firma válida con la clave pública del certificado/);
  assert.match(await page.textContent("#header"), /at\+jwt.*RFC 9068/);
  // alg none y el feo.
  await page.click("#ejemplos button:has-text('none')"); await esperar(400);
  assert.match(await page.textContent("#avisos"), /alg: none/);
  assert.match(await page.textContent("#partes"), /\(sin firma\)/);
  await page.click("#ejemplos button:has-text('datos que no van')"); await esperar(400);
  assert.match(await page.textContent("#avisos"), /Hay secretos en el payload.*Datos personales.*Fechas en milisegundos/s);
  assert.match(await page.textContent("#estado"), /No vence nunca/);
  // JWE.
  await page.click("#ejemplos button:has-text('JWE')"); await esperar(400);
  assert.match(await page.textContent("#estado"), /JWE: cifrado/);
  assert.match(await page.textContent("#claims"), /texto cifrado/);
  assert.ok(await page.locator("#usarEjemplo").isHidden());
  // Pegar a mano con Bearer y basura: anda. Un error: se muestra.
  const tok = E.EJEMPLOS.find((e) => e.id === "auth0").token;
  await page.fill("#token", "Authorization: Bearer " + tok); await esperar(400);
  assert.match(await page.textContent("#claims"), /permissions.*read:facturas/s);
  assert.match(await page.textContent("#avisos"), /Vigente: vence en 23 h/);
  await page.fill("#token", "hola.que.tal"); await esperar(300);
  assert.ok(await page.locator("#error").isVisible()); assert.match(await page.textContent("#error"), /header/);
  // C# emitir y copiar.
  await page.fill("#token", tok); await esperar(300);
  await page.click("#modoCs button[data-modo=emitir]"); await esperar(100);
  assert.match(await page.textContent("#cs"), /JsonWebTokenHandler/);
  await page.click("#copiar"); await esperar(200);
  assert.ok(await page.locator("#copiado").isVisible());
  if (viewport.width >= 700) assert.match(await page.evaluate(() => navigator.clipboard.readText()), /SecurityTokenDescriptor/);
  // Recargar: sigue el token pegado y el modo emitir; la clave no se guarda.
  await page.fill("#clave", "secreto-que-no-se-guarda");
  await page.reload(); await esperar(600);
  assert.equal(await page.inputValue("#token"), tok);
  assert.equal(await page.inputValue("#clave"), "");
  assert.equal(await page.getAttribute("#modoCs button[data-modo=emitir]", "aria-pressed"), "true");
  await page.click("#ejemplos button:has-text('Google')"); await esperar(500);
  await page.screenshot({ path: path.join(process.env.CAPTURAS || RAIZ, `captura-${viewport.width}.png`), fullPage: true });
  assert.ok(await sinScroll(), `sin scroll horizontal al final (${nombre})`);
  assert.deepEqual(requests, []); assert.deepEqual(errores, [], `sin errores (${nombre})`);
  await ctx.close(); console.log(`ok ${nombre}`);
}
(async () => { const { srv, url } = await servir(); const browser = await chromium.launch(); try { await probar(browser, url, { width: 360, height: 740 }); await probar(browser, url, { width: 1280, height: 800 }); } finally { await browser.close(); srv.close(); } })().catch((e) => { console.error(e); process.exit(1); });
