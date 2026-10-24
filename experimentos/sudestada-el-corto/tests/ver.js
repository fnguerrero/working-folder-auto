/* Herramienta de desarrollo: renderiza uno o varios cuadros de una escena a PNG para mirarlos.
     NODE_PATH=/opt/node-tools/node_modules node tests/ver.js <escena> <t local>[,<t2>,<t3>…] [salida.png] [ancho]
   Con varios tiempos, la salida lleva el tiempo antes de la extensión (salida-12.5.png). Conviene pedir varios de una vez: por
   software, la primera vez que se dibuja un shader SwiftShader lo compila a código nativo y eso tarda de 50 a 110 s según la
   escena; los cuadros siguientes del mismo proceso cuestan solo el dibujo (8 a 30 s a 640 px). Imprime los errores de compilación
   del shader si los hay y cuánto tardó cada cuadro (medido con readPixels, que espera a que el dibujo termine de verdad). */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path");
const { chromium } = require("playwright");
const RAIZ = path.join(__dirname, "..", "..", "..");
const esc = parseInt(process.argv[2] || "0", 10), tiempos = (process.argv[3] || "1").split(",").map(parseFloat), salida = process.argv[4] || `/tmp/ver-${esc}.png`, ancho = parseInt(process.argv[5] || "640", 10);
const nombre = (t) => tiempos.length > 1 ? salida.replace(/\.png$/i, "") + `-${t}.png` : salida;
const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.join(RAIZ, ruta); if (!fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); });
srv.listen(0, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${srv.address().port}/experimentos/sudestada-el-corto/`;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: ancho, height: Math.round(ancho * 9 / 16) + 1 }, deviceScaleFactor: 1 });
  const errores = []; page.on("pageerror", (e) => errores.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  await page.goto(url + "?t=0");
  await page.waitForFunction(() => window.__listo === true, null, { timeout: 120000 });
  await page.evaluate(() => { document.querySelector(".controles").style.display = "none"; document.getElementById("escenas").style.display = "none"; document.querySelectorAll("p.meta").forEach((e) => { e.style.display = "none"; }); document.body.style.padding = "0"; document.getElementById("marco").style.cssText = `width:${innerWidth}px;height:${Math.round(innerWidth * 9 / 16)}px;border-radius:0;box-shadow:none`; document.getElementById("barra").remove(); });
  for (const t of tiempos) {
    const t0 = Date.now();
    const r = await page.evaluate(([e, tt]) => { try { const E = window.__escenas()[e]; window.__render(E.inicio + tt); const c = document.getElementById("c"); const gl = c.getContext("webgl"); gl.readPixels(c.width >> 1, c.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return { ok: true, propia: E.propia }; } catch (err) { return { ok: false, error: String(err.message || err) }; } }, [esc, t]);
    const ms = Date.now() - t0;
    if (!r.ok) { console.log("ERROR:", r.error.slice(0, 3000)); break; }
    await page.locator("#marco").screenshot({ path: nombre(t), timeout: 600000 });
    console.log(`escena ${esc} t=${t}${r.propia ? "" : " (sin shader propio)"}: ${nombre(t)} en ${ms} ms${errores.length ? " | consola: " + errores.join(" | ") : ""}`);
  }
  await browser.close(); srv.close();
});
