/* Renderiza el corto a diez-segundos.mp4 (1280×720, 30 fps, con el sonido) usando Chromium headless con WebGL por software
   y ffmpeg. Por software cada cuadro tarda medio minuto, así que se puede partir en procesos:
     node render.js cuadros <dir> <desde> <hasta>   renderiza los cuadros [desde, hasta) a <dir>  (varios en paralelo)
     node render.js armar <dir>                      renderiza el audio y arma el .mp4 con los cuadros de <dir>
     node render.js                                  todo junto, en un solo proceso
   Siempre con NODE_PATH=/opt/node-tools/node_modules. */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os"); const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const RAIZ = path.join(__dirname, "..", ".."); const FPS = 30, DUR = 10;
const modo = process.argv[2] || "todo"; const tmp = modo === "todo" ? fs.mkdtempSync(path.join(os.tmpdir(), "diez-")) : process.argv[3]; if (modo !== "todo") fs.mkdirSync(tmp, { recursive: true });
const desde = modo === "cuadros" ? parseInt(process.argv[4], 10) : 0, hasta = modo === "cuadros" ? parseInt(process.argv[5], 10) : FPS * DUR;
const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.join(RAIZ, ruta); if (!fs.existsSync(a)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); });
srv.listen(0, "127.0.0.1", async () => {
  const url = `http://127.0.0.1:${srv.address().port}/experimentos/diez-segundos/`;
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(url + "?t=0"); await page.waitForFunction(() => window.__listo === true, null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelector(".controles").style.display = "none"; document.querySelectorAll("p.meta").forEach((e) => { e.style.display = "none"; }); document.body.style.padding = "0"; document.getElementById("marco").style.cssText = "width:1280px;height:720px;border-radius:0;box-shadow:none"; document.getElementById("tiempo").remove(); });
  const n = FPS * DUR;
  if (modo !== "armar") for (let i = desde; i < hasta; i++) {
    await page.evaluate((t) => window.__render(t), i / FPS);
    await page.locator("#marco").screenshot({ path: path.join(tmp, `f${String(i).padStart(4, "0")}.png`), timeout: 600000 });
    if (i % 30 === 0) console.log(`cuadro ${i}/${n}`);
  }
  if (modo === "cuadros") { await browser.close(); srv.close(); console.log("cuadros listos:", desde, hasta); return; }
  const wav = await page.evaluate(() => window.__wav()); fs.writeFileSync(path.join(tmp, "audio.wav"), Buffer.from(wav, "base64"));
  await browser.close(); srv.close();
  const salida = path.join(__dirname, "diez-segundos.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(tmp, "f%04d.png"), "-i", path.join(tmp, "audio.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", salida]);
  for (const [f, n] of [["f0040", "cuadro-noche"], ["f0276", "cuadro-amanecer"]]) execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(tmp, f + ".png"), "-q:v", "3", path.join(__dirname, n + ".jpg")]);
  if (modo === "todo") fs.rmSync(tmp, { recursive: true, force: true });
  console.log("listo:", salida, Math.round(fs.statSync(salida).size / 1024), "KB");
});
