/* Renderiza el corto a .mp4 (1280×720, 30 fps) con Chromium headless (WebGL por software) y ffmpeg, de a una escena,
   porque por software cada cuadro tarda varios segundos y una noche no alcanza para todo:
     node render.js escena <n> [procesos]        renderiza la escena n a video/escena-NN.mp4 (sin audio), partida en procesos
     node render.js cuadros <n> <desde> <hasta> <dir>   (interno) renderiza los cuadros [desde, hasta) de la escena n a <dir>
     node render.js armar                        concatena los segmentos que haya en video/ (en orden, solo escenas seguidas desde la 0),
                                                 renderiza el audio de ese tramo con OfflineAudioContext y arma sudestada-el-corto.mp4
   Siempre con NODE_PATH=/opt/node-tools/node_modules. */
"use strict";
const http = require("node:http"); const fs = require("node:fs"); const path = require("node:path"); const os = require("node:os"); const { execFileSync, spawn } = require("node:child_process");
const { chromium } = require("playwright");
const RAIZ = path.join(__dirname, "..", ".."); const FPS = 30;
const modo = process.argv[2] || "armar";
const nn = (n) => String(n).padStart(2, "0");
function servir() { return new Promise((res) => { const srv = http.createServer((req, r) => { let ruta = decodeURIComponent(req.url.split("?")[0]); if (ruta.endsWith("/")) ruta += "index.html"; const a = path.join(RAIZ, ruta); if (!fs.existsSync(a) || fs.statSync(a).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(a).pipe(r); }); srv.listen(0, "127.0.0.1", () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/experimentos/sudestada-el-corto/` })); }); }
async function abrir(url) {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(url + "?t=0"); await page.waitForFunction(() => window.__listo === true, null, { timeout: 120000 });
  await page.evaluate(() => { document.querySelector(".controles").style.display = "none"; document.getElementById("escenas").style.display = "none"; document.querySelectorAll("p.meta").forEach((e) => { e.style.display = "none"; }); document.body.style.padding = "0"; document.getElementById("marco").style.cssText = "width:1280px;height:720px;border-radius:0;box-shadow:none"; document.getElementById("barra").remove(); document.getElementById("cargando").remove(); });
  const escenas = await page.evaluate(() => window.__escenas());
  return { browser, page, escenas };
}
(async () => {
  if (modo === "cuadros") {
    const n = parseInt(process.argv[3], 10), desde = parseInt(process.argv[4], 10), hasta = parseInt(process.argv[5], 10), dir = process.argv[6];
    fs.mkdirSync(dir, { recursive: true });
    const { srv, url } = await servir(); const { browser, page, escenas } = await abrir(url); const e = escenas[n];
    for (let i = desde; i < hasta; i++) {
      const f = path.join(dir, `f${String(i).padStart(5, "0")}.png`); if (fs.existsSync(f)) continue;
      await page.evaluate((tg) => window.__render(tg), e.inicio + i / FPS);
      await page.locator("#marco").screenshot({ path: f + ".tmp.png", timeout: 600000 }); fs.renameSync(f + ".tmp.png", f);
      if (i % 30 === 0) console.log(`escena ${n}: cuadro ${i}/${Math.round(e.dur * FPS)}`);
    }
    await browser.close(); srv.close(); return;
  }
  if (modo === "escena") {
    const n = parseInt(process.argv[3], 10), procesos = parseInt(process.argv[4] || "3", 10);
    const { srv, url } = await servir(); const { browser, page, escenas } = await abrir(url); await browser.close(); srv.close();
    const e = escenas[n]; if (!e.propia) { console.log(`la escena ${n} (${e.nombre}) todavía no tiene shader propio`); return; }
    const total = Math.round(e.dur * FPS); const dir = path.join(os.tmpdir(), `corto-escena-${nn(n)}`); fs.mkdirSync(dir, { recursive: true });
    console.log(`escena ${n} (${e.nombre}): ${total} cuadros en ${procesos} procesos → ${dir}`); const t0 = Date.now();
    await Promise.all(Array.from({ length: procesos }, (_, k) => new Promise((res, rej) => { const a = Math.round(total * k / procesos), b = Math.round(total * (k + 1) / procesos); const p = spawn(process.execPath, [__filename, "cuadros", String(n), String(a), String(b), dir], { stdio: "inherit", env: process.env }); p.on("exit", (c) => c === 0 ? res() : rej(new Error("proceso " + k + " salió con " + c))); })));
    for (let i = 0; i < total; i++) if (!fs.existsSync(path.join(dir, `f${String(i).padStart(5, "0")}.png`))) throw new Error("falta el cuadro " + i);
    fs.mkdirSync(path.join(__dirname, "video"), { recursive: true });
    const salida = path.join(__dirname, "video", `escena-${nn(n)}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "f%05d.png"), "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", salida]);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`listo: ${salida}, ${Math.round(fs.statSync(salida).size / 1024)} KB, ${Math.round((Date.now() - t0) / 60000)} min`);
    return;
  }
  /* armar: concatena los segmentos seguidos desde la escena 0 y les pega el audio */
  const { srv, url } = await servir(); const { browser, page, escenas } = await abrir(url);
  const segs = []; for (let i = 0; i < escenas.length; i++) { const f = path.join(__dirname, "video", `escena-${nn(i)}.mp4`); if (!fs.existsSync(f)) break; segs.push(f); }
  if (!segs.length) { console.log("no hay segmentos en video/"); await browser.close(); srv.close(); return; }
  const hasta = escenas[segs.length - 1].inicio + escenas[segs.length - 1].dur;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "corto-armar-"));
  const wav = await page.evaluate((h) => window.__wav(0, h), hasta); fs.writeFileSync(path.join(tmp, "audio.wav"), Buffer.from(wav, "base64"));
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(tmp, "lista.txt"), segs.map((f) => `file '${f}'`).join("\n"));
  const salida = path.join(__dirname, "sudestada-el-corto.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(tmp, "lista.txt"), "-i", path.join(tmp, "audio.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", salida]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`listo: ${salida}, ${segs.length} escenas, ${Math.round(hasta)} s, ${Math.round(fs.statSync(salida).size / 1024)} KB`);
})().catch((e) => { console.error(e); process.exit(1); });
