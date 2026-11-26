/* Prueba e2e de Pintar con el dedo, headless y sin audio por los parlantes (--mute-audio y ?mudo).
   Correr desde la raíz del repo:  node juegos/pintar-con-el-dedo/tests/e2e.js
   Opcionales: CANAL=msedge (usar Edge instalado), CAPTURAS=<carpeta> (guardar capturas). */
"use strict";
const http = require("node:http"), fs = require("node:fs"), path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("Falta Playwright."); process.exit(2); }
const RAIZ = path.join(__dirname, "..");
const srv = http.createServer((req, res) => {
  if (req.url === "/antes") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<p>antes</p>"); }
  const r = req.url.split("?")[0], f = path.join(RAIZ, r === "/" ? "/index.html" : r);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); fs.createReadStream(f).pipe(res);
});
const CAPTURAS = process.env.CAPTURAS;
// píxel del lienzo en coordenadas CSS
const pixel = (page, x, y) => page.evaluate(([x, y]) => {
  const c = document.getElementById("lienzo"), k = c.width / parseFloat(c.style.width);
  return Array.from(c.getContext("2d").getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data).join(",");
}, [x, y]);
const pintados = (page) => page.evaluate(() => {
  const c = document.getElementById("lienzo"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 253 || d[i + 2] !== 245) n++;
  return n;
});
const FONDO = "255,253,245,255", ROJO = "230,57,70,255", AZUL = "37,70,199,255";

(async () => {
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}/`, url = base + "?mudo&ventana";
  const browser = await chromium.launch({ headless: true, channel: process.env.CANAL || undefined,
    executablePath: process.env.CHROME_PATH || undefined, args: ["--mute-audio"] });
  async function abrir(w, h, touch, destino = url) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, acceptDownloads: true });
    const page = await ctx.newPage(), errores = [], externos = [];
    page.on("console", (m) => { // el aviso de willReadFrequently lo provocan las lecturas de píxeles de esta prueba
      if (["error", "warning"].includes(m.type()) && !m.text().includes("willReadFrequently")) errores.push(m.text()); });
    page.on("pageerror", (e) => errores.push(String(e)));
    page.on("request", (r) => { if (!/^(data:|blob:|file:)/.test(r.url()) && !r.url().startsWith(base)) externos.push(r.url()); });
    await page.goto(destino); await page.waitForFunction(() => __pizarra.listo);
    return { ctx, page, errores, externos };
  }
  // force: el botón de borrar armado tiembla y Playwright esperaría a que se quede quieto
  const tocar = (page, sel, touch) => touch ? page.tap(sel, { force: sel === "#borrar" }) : page.click(sel, { force: sel === "#borrar" });

  // ---- disposición: botones de 56 px o más, dentro de la pantalla y sin pisarse ----
  for (const [w, h] of [[360, 740], [360, 640], [320, 568], [412, 915], [640, 360], [740, 360], [768, 1024], [1280, 720]]) {
    const { ctx, page } = await abrir(w, h, w < 1000);
    const cajas = await page.$$eval("button", (bs) => bs.map((b) => {
      const r = b.getBoundingClientRect(); return { n: b.getAttribute("aria-label"), x: r.x, y: r.y, w: b.offsetWidth, h: b.offsetHeight, d: r.right, a: r.bottom };
    }));
    assert.equal(cajas.length, 19);
    for (const c of cajas) {
      assert.ok(c.w >= 56 && c.h >= 56, `${w}x${h}: ${c.n} mide ${c.w}x${c.h}`);
      assert.ok(c.x >= -0.5 && c.y >= -0.5 && c.d <= w + 0.5 && c.a <= h + 0.5, `${w}x${h}: ${c.n} se sale`);
      for (const o of cajas) if (o !== c)
        assert.ok(c.d <= o.x + 0.5 || o.d <= c.x + 0.5 || c.a <= o.y + 0.5 || o.a <= c.y + 0.5, `${w}x${h}: ${c.n} pisa ${o.n}`);
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), "sin scroll");
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `inicio-${w}x${h}.png`) });
    await ctx.close();
  }
  console.log("ok disposición en 8 tamaños");

  for (const [w, h, touch] of [[360, 740, true], [1280, 720, false]]) {
    const { ctx, page, errores, externos } = await abrir(w, h, touch);
    assert.equal(await pintados(page), 0, "empieza en blanco");
    if (touch) {
      // tres dedos a la vez
      const cdp = await ctx.newCDPSession(page);
      const dedos = (x) => [150, 250, 350].map((y, id) => ({ x, y, id }));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: dedos(40) });
      for (let x = 60; x <= 240; x += 20) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: dedos(x) });
      assert.equal(await page.evaluate(() => __pizarra.trazos.size), 3, "tres trazos simultáneos");
      // un cuarto dedo cambia de color mientras los otros siguen apoyados
      const b = await page.locator(".color").nth(5).boundingBox();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [...dedos(240), { x: b.x + 28, y: b.y + 28, id: 3 }] });
      assert.equal(await page.evaluate(() => __pizarra.color), 5, "segundo dedo elige color");
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(100);
      for (const y of [150, 250, 350]) for (const x of [40, 145, 238]) assert.equal(await pixel(page, x, y), ROJO, `trazo en ${x},${y}`);
      assert.equal(await pixel(page, 145, 200), FONDO, "los dedos no se unen entre sí");
      assert.equal(await page.evaluate(() => __pizarra.trazos.size), 0);
    } else {
      await page.mouse.move(100, 200); await page.mouse.down(); await page.mouse.move(600, 200, { steps: 6 }); await page.mouse.up();
      assert.equal(await pixel(page, 350, 200), ROJO, "dibuja con mouse");
      await page.mouse.move(100, 300); await page.mouse.move(600, 300, { steps: 4 });
      assert.equal(await pixel(page, 350, 300), FONDO, "mover sin apretar no dibuja");
      await page.mouse.click(300, 400, { button: "right" });
      assert.equal(await pixel(page, 300, 400), FONDO, "botón derecho no dibuja");
      for (let i = 1; i <= 8; i++) { await page.keyboard.press(String(i)); assert.equal(await page.evaluate(() => __pizarra.color), i - 1); }
      for (const [tecla, g] of [["+", 2], ["+", 2], ["-", 1], ["-", 0], ["-", 0], ["+", 1]]) {
        await page.keyboard.press(tecla); assert.equal(await page.evaluate(() => __pizarra.grosor), g, "tecla " + tecla);
      }
      await page.keyboard.press("6"); await page.mouse.click(200, 450);
      assert.equal(await pixel(page, 200, 450), AZUL, "la tecla 6 pinta azul");
      await page.focus(".grosor >> nth=2"); await page.keyboard.press("Enter");
      assert.equal(await page.evaluate(() => __pizarra.grosor), 2, "botón con Enter");
    }
    // grosores: el grueso cubre más
    await tocar(page, ".grosor >> nth=0", touch); await tocar(page, ".color >> nth=0", touch);
    const n0 = await pintados(page);
    if (touch) await page.touchscreen.tap(80, 450); else await page.mouse.click(800, 450);
    const n1 = await pintados(page);
    await tocar(page, ".grosor >> nth=2", touch);
    if (touch) await page.touchscreen.tap(200, 450); else await page.mouse.click(950, 450);
    assert.ok((await pintados(page)) - n1 > (n1 - n0) * 4, "el grueso es bastante más grande");
    // los cinco sellos
    await tocar(page, ".grosor >> nth=0", touch);
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(120);
      await tocar(page, `.sello >> nth=${i}`, touch);
      assert.equal(await page.evaluate(() => __pizarra.sello), i);
      assert.equal(await page.$$eval('.color[aria-pressed="true"]', (e) => e.length), 0, "con sello no queda color marcado");
      const x = 60 + (i % 3) * 90, y = 530 - (touch ? 0 : 20) + Math.floor(i / 3) * 40;
      const antes = await pintados(page), s = await page.evaluate(() => __sonidos.length);
      await page.waitForTimeout(120);
      if (touch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      assert.ok((await pintados(page)) > antes + 300, "estampa el sello " + i);
      assert.equal(await page.evaluate((s) => __sonidos.slice(s).length, s), 1, "el sello suena");
    }
    assert.deepEqual(await page.evaluate(() => ["sol", "estrella", "corazón", "auto", "flor"].filter((n) => !__sonidos.includes(n))), []);
    await tocar(page, ".sello >> nth=4", touch);
    assert.equal(await page.evaluate(() => __pizarra.sello), null, "tocar el sello elegido vuelve al lápiz");
    await tocar(page, ".grosor >> nth=2", touch); await tocar(page, ".sello >> nth=0", touch);
    if (touch) await page.touchscreen.tap(160, 200); else await page.mouse.click(700, 330);
    await page.waitForTimeout(2400);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `dibujo-${w}x${h}.png`) });

    // guardar: PNG del tamaño de la pantalla, con el fondo pintado (opaco)
    const [descarga] = await Promise.all([page.waitForEvent("download"), tocar(page, "#guardar", touch)]);
    assert.match(descarga.suggestedFilename(), /^dibujo-\d{8}-\d{6}\.png$/);
    const png = fs.readFileSync(await descarga.path());
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h]);
    const esquina = await page.evaluate(async (b64) => {
      const i = new Image(); i.src = "data:image/png;base64," + b64; await i.decode();
      const c = document.createElement("canvas"); c.width = i.width; c.height = i.height;
      const x = c.getContext("2d"); x.drawImage(i, 0, 0); return Array.from(x.getImageData(0, 0, 1, 1).data).join(",");
    }, png.toString("base64"));
    assert.equal(esquina, FONDO);
    if (CAPTURAS) fs.writeFileSync(path.join(CAPTURAS, `guardado-${w}x${h}.png`), png);
    await tocar(page, "#guardar", touch); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __pizarra.guardados), 1, "manotazos seguidos no descargan de nuevo");

    // autoguardado: recargar no pierde el dibujo
    const antesDeRecargar = await pintados(page);
    await page.waitForTimeout(1200); await page.reload(); await page.waitForFunction(() => __pizarra.listo);
    assert.equal(await pintados(page), antesDeRecargar, "el dibujo vuelve al recargar");

    // girar la pantalla no recorta
    await page.setViewportSize({ width: h, height: w }); await page.waitForTimeout(300);
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(300);
    assert.equal(await pintados(page), antesDeRecargar, "girar ida y vuelta conserva todo");

    // borrar: un toque no, ráfaga no, dos toques separados sí
    await tocar(page, "#borrar", touch); await page.waitForTimeout(100); await tocar(page, "#borrar", touch);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __pizarra.borrados), 0, "la ráfaga no borra");
    assert.equal(await page.locator("#borrar.armado").count(), 1);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `confirmar-${w}x${h}.png`) });
    await page.waitForTimeout(3700);
    assert.equal(await page.locator("#borrar.armado").count(), 0, "la confirmación vence sola");
    assert.equal(await pintados(page), antesDeRecargar);
    await tocar(page, "#borrar", touch);
    if (touch) await page.touchscreen.tap(30, 150); else await page.mouse.click(30, 150);
    assert.equal(await page.locator("#borrar.armado").count(), 0, "dibujar cancela la confirmación");
    await tocar(page, "#borrar", touch); await page.waitForTimeout(600); await tocar(page, "#borrar", touch);
    await page.waitForTimeout(400);
    if (CAPTURAS) await page.screenshot({ path: path.join(CAPTURAS, `barriendo-${w}x${h}.png`) });
    await page.waitForFunction(() => __pizarra.borrados === 1 && !__pizarra.barriendo);
    assert.equal(await pintados(page), 0, "queda todo limpio");
    await page.reload(); await page.waitForFunction(() => __pizarra.listo);
    assert.equal(await pintados(page), 0, "después de borrar, recargar no lo trae de vuelta");

    // silencio se recuerda (sin ?mudo)
    await page.goto(base + "?ventana"); await tocar(page, "#mute", touch); await page.reload();
    assert.equal(await page.getAttribute("#mute", "aria-pressed"), "true", "recuerda el silencio");
    assert.deepEqual(errores, []); assert.deepEqual(externos, []);
    await ctx.close();
    console.log(`ok juego ${w}x${h} ${touch ? "táctil" : "mouse"}`);
  }

  // ---- «Atrás»: el primero se absorbe, el segundo sale ----
  {
    const c = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true }), p = await c.newPage();
    await p.goto(base + "antes"); await p.goto(url); await p.waitForFunction(() => __pizarra.listo);
    await p.touchscreen.tap(100, 300); await p.waitForTimeout(100);
    await p.goBack(); await p.waitForTimeout(300);
    assert.equal(p.url(), url, "el primer atrás no sale");
    await p.goBack(); await p.waitForTimeout(500);
    assert.equal(p.url(), base + "antes", "el segundo atrás sale");
    await c.close(); console.log("ok atrás");
  }
  // ---- con audio activado (salida muteada) y pantalla completa; y abierto como archivo ----
  {
    const { ctx, page, errores } = await abrir(360, 740, true, base);
    await page.tap(".sello >> nth=3"); await page.touchscreen.tap(150, 300); await page.waitForTimeout(500);
    console.log("pantalla completa tras el primer toque:", await page.evaluate(() => !!document.fullscreenElement));
    for (const i of [0, 1, 2, 4]) { await page.tap(`.sello >> nth=${i}`); await page.waitForTimeout(150); }
    assert.deepEqual(errores, []); await ctx.close();
    const f = await abrir(360, 740, true, pathToFileURL(path.join(RAIZ, "index.html")).href + "?mudo&ventana");
    await f.page.tap(".sello >> nth=0"); await f.page.touchscreen.tap(150, 300);
    const [d] = await Promise.all([f.page.waitForEvent("download"), f.page.tap("#guardar")]);
    assert.ok(fs.statSync(await d.path()).size > 1000, "guarda también abierto como archivo");
    assert.deepEqual(f.errores, []); await f.ctx.close();
    console.log("ok audio y file://");
  }
  await browser.close(); srv.close(); console.log("TODO OK");
})().catch((e) => { console.error(e); process.exit(1); });
