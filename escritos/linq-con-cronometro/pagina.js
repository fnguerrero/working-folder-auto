/* Índice, sección activa y botones de copiar. */
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
})();
