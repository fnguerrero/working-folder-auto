"""Prueba de punta a punta en un navegador headless, sin sonido.

Uso:  py -3 tests/e2e.py [carpeta-para-capturas]
La voz se reemplaza por una de mentira y los sonidos se generan en un contexto
fuera de línea (se calculan, no salen por los parlantes).
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = (Path(__file__).resolve().parent.parent / "index.html").as_uri()
CAPTURAS = Path(sys.argv[1]) if len(sys.argv) > 1 else None

DOBLES = """
window.__dichas = [];
window.__sonados = 0;
Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
  speak(u) { window.__dichas.push(u); }, cancel() {}, getVoices() { return []; } } });
window.SpeechSynthesisUtterance = function (t) { this.text = t; };
window.AudioContext = function () {
  window.__sonados++;
  const c = new OfflineAudioContext(1, 44100, 44100);
  c.resume = () => Promise.resolve();
  return c;
};
"""

fallas = []


def ver(condicion, mensaje):
    if not condicion:
        fallas.append(mensaje)
        print("FALLA:", mensaje)


MEDIR = """() => {
  const afuera = [];
  for (const s of ['#casa', '#texto', '#anterior', '#leer', '#siguiente', '#op-sonidos', '#escena', '#otra-vez', '#otro']) {
    const e = document.querySelector(s);
    if (!e || !e.offsetParent) continue;
    const r = e.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) afuera.push(s);
  }
  const t = document.querySelector('#texto');
  const escena = document.querySelector('#escena').getBoundingClientRect();
  return { afuera, ancho: document.documentElement.scrollWidth - innerWidth,
           cortado: t.scrollHeight - t.clientHeight, escena: Math.min(escena.width, escena.height * 1.25) };
}"""

with sync_playwright() as p:
    # usa el Chromium de Playwright y, si no está descargado, el Chrome instalado
    try:
        navegador = p.chromium.launch(headless=True, args=["--mute-audio"])
    except Exception:
        navegador = p.chromium.launch(headless=True, channel="chrome", args=["--mute-audio"])
    for nombre, tam, tactil in [("360", (360, 640), True), ("escritorio", (1366, 768), False), ("acostado", (740, 360), True)]:
        ctx = navegador.new_context(viewport={"width": tam[0], "height": tam[1]}, has_touch=tactil)
        ctx.add_init_script(DOBLES)
        pag = ctx.new_page()
        errores = []
        pag.on("pageerror", lambda e: errores.append(str(e)))
        pag.on("console", lambda m: errores.append(m.text) if m.type == "error" else None)
        pag.goto(URL)
        ver(pag.evaluate("document.documentElement.scrollWidth - innerWidth") <= 0, f"{nombre}: portada se desborda")
        ver(pag.locator(".tarjeta").count() == 5, f"{nombre}: faltan tarjetas")
        ver(pag.locator("#lista .toca").count() == 0, f"{nombre}: miniaturas tocables")
        if CAPTURAS:
            pag.screenshot(path=str(CAPTURAS / f"{nombre}-portada.png"), full_page=True)
        slugs = pag.evaluate("CUENTOS.map(c => [c.slug, c.paginas.length])")
        for slug, total in slugs:
            pag.locator(f'a[href="#{slug}"]').click()
            for n in range(total + 1):
                pag.wait_for_timeout(340)
                m = pag.evaluate(MEDIR)
                donde = f"{nombre} {slug} {n + 1}"
                ver(not m["afuera"], f"{donde}: fuera de pantalla {m['afuera']}")
                ver(m["ancho"] <= 0, f"{donde}: desborde horizontal")
                ver(m["cortado"] <= 1, f"{donde}: texto cortado {m['cortado']}px")
                ver(m["escena"] >= 180, f"{donde}: dibujo chico {m['escena']:.0f}px")
                if CAPTURAS and nombre != "acostado":
                    pag.screenshot(path=str(CAPTURAS / f"{nombre}-{slug}-{n + 1}.png"))
                elif CAPTURAS and n in (0, total):
                    pag.screenshot(path=str(CAPTURAS / f"{nombre}-{slug}-{n + 1}.png"))
                if n < total:
                    # cada cosa tocable tiene que poder alcanzarse con un toque (no quedar tapada entera)
                    tapadas = pag.evaluate("""() => [...document.querySelectorAll('#lienzo .toca')].filter(g => {
                      const r = g.getBoundingClientRect();
                      for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
                        const e = document.elementFromPoint(r.left + r.width * i / 10, r.top + r.height * j / 10);
                        if (e && e.closest('.toca') === g) return false;
                      }
                      return true; }).map(g => g.getAttribute('aria-label'))""")
                    ver(not tapadas, f"{donde}: no se pueden tocar {tapadas}")
                    pag.locator("#siguiente").click()
            ver(pag.locator("#fin").is_visible() and pag.locator("#siguiente").is_disabled(), f"{nombre} {slug}: no llega al Fin")
            pag.locator("#otro").click()
            pag.wait_for_selector("#portada", state="visible")

        # interacción: toque, deslizar, teclado, lectura con pausa, volver
        pag.locator('a[href="#quien-hace-muuu"]').click()
        pag.keyboard.press("ArrowRight")
        vaca = pag.locator('#lienzo .toca[data-son="vaca"]')
        caja = vaca.bounding_box()
        x, y = caja["x"] + caja["width"] * 0.55, caja["y"] + caja["height"] * 0.55
        pag.mouse.click(x, y)
        ver(pag.locator(".globo").inner_text() == "¡Muuu!", f"{nombre}: la vaca no hace muuu")
        ver(pag.evaluate("window.__sonados") == 1, f"{nombre}: no pidió sonido")
        pag.mouse.move(x, y)
        pag.mouse.down()
        pag.mouse.move(x - 130, y + 5, steps=6)
        pag.mouse.up()
        ver(pag.url.endswith("/3"), f"{nombre}: deslizar no avanza ({pag.url})")
        pag.mouse.move(x - 130, y)
        pag.mouse.down()
        pag.mouse.move(x, y, steps=6)
        pag.mouse.up()
        ver(pag.url.endswith("/2"), f"{nombre}: deslizar no retrocede")
        vaca.focus()
        pag.keyboard.press("Enter")
        ver(pag.locator(".globo").count() == 1, f"{nombre}: Enter sobre el dibujo no suena")
        pag.locator("#leer").click()
        ver(pag.locator("#leer-texto").inner_text() == "Pausa", f"{nombre}: no pasa a Pausa")
        pag.locator("#leer").click()
        ver(pag.locator("#leer-texto").inner_text() == "Seguir", f"{nombre}: no pasa a Seguir")
        pag.locator("#leer").click()
        ver(pag.evaluate("window.__dichas.length") == 2, f"{nombre}: seguir no vuelve a leer")
        pag.locator("#siguiente").click()
        ver(pag.locator("#leer-texto").inner_text() == "Leer", f"{nombre}: al pasar de página no se calla")
        antes = pag.evaluate("window.__dichas.length")
        pag.locator("#op-leer").click()
        pag.locator("#siguiente").click()
        ver(pag.evaluate("window.__dichas.length") == antes + 2, f"{nombre}: no lee sola al pasar")
        pag.locator("#op-leer").click()
        pag.locator("#op-sonidos").click()
        pag.locator("#lienzo").click(position={"x": 20, "y": 120})
        ver(pag.locator("#op-sonidos").get_attribute("aria-pressed") == "false", f"{nombre}: no apaga sonidos")
        pag.go_back()
        pag.wait_for_selector("#portada", state="visible")
        pag.goto(URL + "#hasta-maniana/3")
        pag.reload()
        ver("ovillo" in pag.locator("#texto").inner_text(), f"{nombre}: el link directo no abre la página")
        pag.locator("#casa").click()
        ver(pag.locator("#portada").is_visible(), f"{nombre}: casa no vuelve a la portada")

        # modo mudo: nunca llama a la voz ni crea audio
        pag.goto(URL + "?mudo#la-pelota-roja")
        pag.locator("#leer").click()
        pag.locator("#lienzo").click(position={"x": 100, "y": 120})
        ver(pag.evaluate("window.__dichas.length + window.__sonados") == 0, f"{nombre}: ?mudo no es mudo")

        if nombre == "360":
            picos = pag.evaluate("""async () => {
              const r = {};
              for (const n of Sonidos.nombres) {
                const c = new OfflineAudioContext(1, 44100 * 4, 44100);
                Sonidos.tocar(n, c, c.destination);
                const d = (await c.startRendering()).getChannelData(0);
                let max = 0; for (const v of d) max = Math.max(max, Math.abs(v));
                r[n] = +max.toFixed(3);
              }
              return r; }""")
            print("picos de los sonidos:", picos)
            for n, v in picos.items():
                ver(0.03 < v <= 1.0, f"sonido {n}: pico {v}")
        ver(not errores, f"{nombre}: errores {errores}")
        ctx.close()
    navegador.close()

print("OK" if not fallas else f"{len(fallas)} fallas")
sys.exit(1 if fallas else 0)
