/* Índice, sección activa, botones de copiar y el gráfico del thread pool (los datos van embebidos en la página). */
(function () {
  "use strict";
  const secciones = [...document.querySelectorAll("main h2[id]")];
  const items = secciones.map((h) => {
    const titulo = h.childNodes[h.childNodes.length - 1].textContent.trim();
    const small = h.querySelector("small") ? h.querySelector("small").textContent.replace("Capítulo ", "") : "";
    const num = /^\d+$/.test(small) ? small : "";
    return `<li><a href="#${h.id}" data-id="${h.id}"><span class="num">${num}</span>${titulo}</a></li>`;
  }).join("");
  document.getElementById("toc-lateral").innerHTML = items;
  document.getElementById("toc-movil").innerHTML = items;
  const enlaces = [...document.querySelectorAll("nav.toc a")];
  let pendiente = false;
  const calcular = () => {
    pendiente = false;
    let actual = secciones[0].id;
    for (const s of secciones) { if (s.getBoundingClientRect().top <= 120) actual = s.id; else break; }
    enlaces.forEach((a) => a.classList.toggle("activo", a.dataset.id === actual));
  };
  window.addEventListener("scroll", () => { if (!pendiente) { pendiente = true; requestAnimationFrame(calcular); } }, { passive: true });
  window.addEventListener("hashchange", () => setTimeout(calcular, 50));
  calcular();

  const toast = document.getElementById("toast");
  for (const pre of document.querySelectorAll("pre")) {
    const b = document.createElement("button"); b.type = "button"; b.className = "copiar"; b.textContent = "Copiar";
    b.addEventListener("click", async () => {
      const texto = pre.querySelector("code").textContent;
      try { await navigator.clipboard.writeText(texto); }
      catch (e) { const ta = document.createElement("textarea"); ta.value = texto; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) { /* nada */ } ta.remove(); }
      toast.textContent = "Copiado"; toast.classList.add("visible"); setTimeout(() => toast.classList.remove("visible"), 1500);
    });
    pre.appendChild(b);
  }

  const datos = document.getElementById("datos-grafico");
  if (!datos) return;
  const D = JSON.parse(datos.textContent);
  const RITMOS = [100, 200, 400, 800];
  const $ = (id) => document.getElementById(id);
  const n = (x) => Math.round(x).toLocaleString("es-AR");

  // puntos: [segundo, valor]. La escala vertical es fija para cada gráfico, así se comparan variantes.
  function dibujar(svg, puntos, tope, referencia) {
    const X = (s) => 34 + (s / 10.5) * 278, Y = (v) => 130 - (Math.min(v, tope) / tope) * 118;
    let h = "";
    for (const f of [0, 0.5, 1]) h += `<line class="eje" x1="34" x2="312" y1="${Y(tope * f)}" y2="${Y(tope * f)}"/><text x="30" y="${Y(tope * f) + 3}" text-anchor="end">${n(tope * f)}</text>`;
    for (const s of [0, 5, 10]) h += `<text x="${X(s)}" y="144" text-anchor="middle">${s} s</text>`;
    if (referencia) h += `<line class="entra" x1="34" x2="312" y1="${Y(referencia)}" y2="${Y(referencia)}"/>`;
    h += `<polyline class="linea" points="${puntos.map(([s, v]) => `${X(s).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}"/>`;
    h += puntos.map(([s, v]) => `<circle cx="${X(s).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2"><title>${s} s: ${n(v)}</title></circle>`).join("");
    svg.innerHTML = h;
  }

  function actualizar() {
    const ritmo = RITMOS[Number($("g-ritmo").value)];
    const serie = D[$("g-rt").value][$("g-modo").value][ritmo];
    $("g-ritmo-v").textContent = ritmo;
    dibujar($("g-salida"), serie.map((p) => [p[0], p[2]]), 1000, ritmo);
    dibujar($("g-hilos"), serie.map((p) => [p[0], p[1]]), 140, 0);
    const ultimo = serie[serie.length - 1];
    $("g-resumen").textContent = `A los ${n(ultimo[0])} segundos: ${n(ultimo[1])} hilos en el pool y ${n(ultimo[3])} trabajos esperando en la cola.`;
  }
  for (const id of ["g-rt", "g-modo", "g-ritmo"]) $(id).addEventListener("input", actualizar);
  actualizar();
})();
