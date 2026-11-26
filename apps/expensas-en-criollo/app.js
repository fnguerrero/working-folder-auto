/* Interfaz de «Expensas en criollo». La lógica está en logica.js. */
(function () {
  "use strict";
  const L = window.Logica;
  const LLAVE = "expensas-en-criollo:v1";
  const $ = (s) => document.querySelector(s);

  /* Crea un elemento. El texto siempre entra como texto, nunca como HTML. */
  function el(etiqueta, props, ...hijos) {
    const n = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") n.className = v;
      else if (k.startsWith("data-") || k.startsWith("aria-")) n.setAttribute(k, v);
      else n[k] = v;
    }
    for (const h of hijos) if (h !== null && h !== undefined && h !== false) n.append(h);
    return n;
  }
  const mostrar = (nodo, si) => nodo.classList.toggle("oculto", !si);
  const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const titulo = (m) => mayuscula(L.nombreMes(m));
  const numero = (n) => String(n).replace(".", ",");
  const copiaDe = (o) => JSON.parse(JSON.stringify(o));

  /* null si está vacío, NaN si no es un número. */
  function leerPorcentaje(texto) {
    const t = String(texto).replace(/[%\s]/g, "").replace("−", "-");
    if (!t) return null;
    return /^-?\d+([.,]\d+)?$/.test(t) ? Number(t.replace(",", ".")) : NaN;
  }

  let datos;
  let mesElegido = null;
  let tab = "resumen";
  let borrador = { filas: [] };
  let deshacer = null;
  let relojAviso = null;

  function alertaGuardado(texto) {
    const a = $("#aviso-guardado");
    a.textContent = texto || "";
    mostrar(a, Boolean(texto));
  }

  function cargar() {
    let crudo = null;
    try { crudo = localStorage.getItem(LLAVE); }
    catch (e) { alertaGuardado("Este navegador no deja guardar: lo que cargues se pierde al cerrar. Exportá una copia."); }
    if (crudo) {
      try { return L.validar(JSON.parse(crudo)); }
      catch (e) {
        try { localStorage.setItem(LLAVE + ":roto", crudo); } catch (e2) { /* sin lugar para la copia */ }
        alertaGuardado("No se pudo leer lo guardado (quedó una copia aparte en el navegador). Se muestra el ejemplo.");
      }
    }
    return L.ejemplo();
  }

  function guardar() {
    try { localStorage.setItem(LLAVE, JSON.stringify(datos)); }
    catch (e) { alertaGuardado("No se pudo guardar en este navegador. Exportá una copia para no perder los datos."); }
  }

  function avisar(texto, alDeshacer) {
    deshacer = alDeshacer || null;
    $("#toast span").textContent = texto;
    mostrar($("#btn-deshacer"), Boolean(deshacer));
    mostrar($("#toast"), true);
    clearTimeout(relojAviso);
    relojAviso = setTimeout(cerrarAviso, deshacer ? 12000 : 5000);
  }
  function cerrarAviso() {
    mostrar($("#toast"), false);
    deshacer = null;
  }

  /* Cambia los datos dejando la posibilidad de volver atrás. */
  function cambiar(nuevos, texto) {
    const antes = copiaDe(datos);
    const mesAntes = mesElegido;
    datos = nuevos;
    mesElegido = null;
    guardar();
    pintar();
    avisar(texto, () => { datos = antes; mesElegido = mesAntes; guardar(); pintar(); });
  }

  function ir(destino) {
    tab = destino;
    for (const t of ["resumen", "cargar", "datos"]) mostrar($("#sec-" + t), t === tab);
    for (const b of document.querySelectorAll("#tabs button")) {
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    window.scrollTo(0, 0);
  }

  const clase = (n) => (n === null || Math.round(n * 10) === 0 ? "" : n > 0 ? "sube" : "baja");

  /* ---------- Resumen ---------- */

  function cifra(nombre, valor, tono) {
    return el("div", { class: "cifra" }, el("span", null, nombre), el("strong", { class: tono || "" }, valor));
  }

  function detalleComparacion(r) {
    if (r.anterior === null) return "";
    if (r.estado === "nuevo") return "Nuevo este mes";
    if (r.estado === "no-esta") return "No está este mes (antes " + L.pesos(r.anterior) + ")";
    let t = "Antes " + L.pesos(r.anterior) + " · " + L.conSigno(r.diferencia, L.pesos);
    if (r.variacion !== null) t += " (" + L.conSigno(r.variacion, L.porcentaje) + ")";
    if (r.real !== null) t += " · contra inflación " + L.conSigno(r.real, L.porcentaje);
    return t;
  }

  function textoParaCopiar(a) {
    const partes = ["Expensas de " + L.nombreMes(a.mes), "", ...L.enCriollo(a)];
    const q = L.preguntas(a);
    if (q.length) partes.push("", "Consultas:", ...q.map((p, i) => i + 1 + ". " + p));
    return partes.join("\n");
  }

  function pintarResumen() {
    const hay = datos.meses.length > 0;
    mostrar($("#vacio"), !hay);
    mostrar($("#resumen"), hay);
    if (!hay) return;
    if (!datos.meses.some((m) => m.mes === mesElegido)) mesElegido = datos.meses[datos.meses.length - 1].mes;
    $("#sel-mes").replaceChildren(...[...datos.meses].reverse().map((m) => el("option", { value: m.mes }, titulo(m.mes))));
    $("#sel-mes").value = mesElegido;
    const a = L.analizar(datos, mesElegido);
    $("#contra").textContent = a.previo ? "contra " + L.nombreMes(a.previo) + (a.saltea ? " (hay meses salteados)" : "") : "sin mes anterior";
    $("#criollo").replaceChildren(...L.enCriollo(a).map((f) => el("p", null, f)));

    const cifras = [cifra("Total del mes", L.pesos(a.total))];
    if (a.previo) {
      cifras.push(cifra("Contra el mes anterior", a.variacion === null ? L.conSigno(a.diferencia, L.pesos) : L.conSigno(a.variacion, L.porcentaje), clase(a.variacion)));
      cifras.push(cifra(a.saltea ? "Inflación acumulada" : "Inflación", a.inflacion === null ? "sin dato" : L.porcentaje(a.inflacion)));
      cifras.push(cifra("Descontada la inflación", a.real === null ? "sin dato" : L.conSigno(a.real, L.porcentaje), clase(a.real)));
    }
    if (datos.coeficiente !== null) {
      const parte = (a.total * datos.coeficiente) / 100;
      const extra = a.previo ? " (" + L.conSigno((a.diferencia * datos.coeficiente) / 100, L.pesos) + ")" : "";
      cifras.push(cifra("Tu parte estimada (" + L.porcentaje(datos.coeficiente) + ")", L.pesos(parte) + extra));
    }
    $("#cifras").replaceChildren(...cifras);

    mostrar($("#caja-saltos"), Boolean(a.previo));
    if (a.previo) {
      const ref = a.tipoReferencia === "inflacion" ? "la inflación (" + L.porcentaje(a.referencia) + ")"
        : a.tipoReferencia === "mediana" ? "lo que subió el rubro del medio (" + L.porcentaje(a.referencia) + "), porque falta la inflación" : null;
      $("#regla").textContent = (ref
        ? "Rubros que subieron más de " + numero(a.ajustes.puntos) + " puntos por encima de " + ref + " y suman de más al menos el " + L.porcentaje(a.ajustes.peso) + " del total. "
        : "Sin inflación ni suficientes rubros en común no se pueden marcar subas. ")
        + "También los rubros nuevos que pesan al menos el " + L.porcentaje(a.ajustes.peso) + ".";
      const items = a.saltos.map((r) => {
        let t = detalleComparacion(r);
        if (r.salto === "suba") {
          t += ". Unos " + L.pesos(r.deMas) + " más que si hubiera acompañado la referencia";
          if (r.habitual !== null) t += ". Antes venía variando " + L.conSigno(r.habitual, L.porcentaje) + " por mes";
        }
        return el("li", null,
          el("div", { class: "renglon" }, el("strong", null, r.nombre), el("span", null, L.pesos(r.monto))),
          el("div", { class: "detalle" }, t));
      });
      $("#saltos").replaceChildren(...(items.length ? items : [el("li", null, "Ninguno con esta regla.")]));
    }
    const q = L.preguntas(a);
    mostrar($("#caja-preguntas"), Boolean(a.previo));
    $("#preguntas").replaceChildren(...(q.length ? q.map((p) => el("li", null, p)) : [el("li", null, "No saltó ningún rubro.")]));
    mostrar($("#copia-manual"), false);

    const abiertas = new Set([...document.querySelectorAll("#categorias details[open]")].map((d) => d.dataset.cat));
    $("#categorias").replaceChildren(...a.categorias.map((c) => {
      const barra = el("i");
      barra.style.width = Math.max(0, Math.min(100, c.peso)) + "%";
      let sub = L.porcentaje(c.peso) + " del total";
      if (c.anterior !== null) {
        sub += " · " + L.conSigno(c.diferencia, L.pesos);
        if (c.variacion !== null) sub += " (" + L.conSigno(c.variacion, L.porcentaje) + ")";
        if (c.real !== null) sub += " · contra inflación " + L.conSigno(c.real, L.porcentaje);
      }
      const rubros = a.rubros.filter((r) => r.categoria === c.id).map((r) => el("li", null,
        el("div", { class: "renglon" }, el("span", null, r.nombre), el("span", null, L.pesos(r.monto))),
        el("div", { class: "detalle" }, detalleComparacion(r))));
      return el("details", { "data-cat": c.id, open: abiertas.has(c.id) },
        el("summary", null,
          el("div", { class: "renglon" }, el("strong", { class: "nombre" }, c.nombre), el("span", null, L.pesos(c.monto))),
          el("div", { class: "pista" }, barra),
          el("div", { class: "detalle " + clase(c.real) }, sub)),
        el("ul", { class: "lista" }, ...rubros));
    }));
  }

  /* ---------- Cargar un mes ---------- */

  function categoriaConocida(nombre) {
    const k = L.clave(nombre);
    if (!datos.ejemplo) {
      for (let i = datos.meses.length - 1; i >= 0; i--) {
        const r = datos.meses[i].rubros.find((x) => L.clave(x.nombre) === k);
        if (r) return r.categoria;
      }
    }
    return L.categorizar(nombre);
  }

  const filaDe = (r) => ({ nombre: r.nombre, categoria: r.categoria, monto: numero(r.monto), tocada: true });

  function pintarSuma() {
    const montos = borrador.filas.map((f) => L.parsearMonto(f.monto)).filter((v) => v !== null);
    $("#c-suma").textContent = borrador.filas.length ? "Suma: " + L.pesos(montos.reduce((a, b) => a + b, 0)) + " en " + montos.length + (montos.length === 1 ? " rubro" : " rubros") : "";
  }

  function pintarFilas() {
    $("#filas").replaceChildren(...borrador.filas.map((f, i) => {
      const nombre = el("input", { class: "f-nombre", type: "text", value: f.nombre, placeholder: "Rubro", maxLength: 120, "aria-label": "Nombre del rubro " + (i + 1) });
      const cat = el("select", { class: "f-cat", "aria-label": "Categoría del rubro " + (i + 1) }, ...L.CATEGORIAS.map((c) => el("option", { value: c.id }, c.nombre)));
      cat.value = f.categoria;
      const monto = el("input", { class: "f-monto", type: "text", inputMode: "decimal", value: f.monto, placeholder: "Importe", "aria-label": "Importe del rubro " + (i + 1) });
      const quitar = el("button", { type: "button", "aria-label": "Quitar el rubro " + (i + 1) }, "×");
      nombre.addEventListener("input", () => {
        f.nombre = nombre.value;
        if (!f.tocada) { f.categoria = categoriaConocida(f.nombre); cat.value = f.categoria; }
      });
      cat.addEventListener("change", () => { f.categoria = cat.value; f.tocada = true; });
      monto.addEventListener("input", () => { f.monto = monto.value; pintarSuma(); });
      quitar.addEventListener("click", () => {
        borrador.filas.splice(i, 1);
        pintarFilas();
        avisar("Se quitó el rubro.", () => { borrador.filas.splice(i, 0, f); pintarFilas(); });
      });
      return el("li", null, nombre, cat, monto, quitar);
    }));
    if (!borrador.filas.length) $("#filas").append(el("li", { class: "suave" }, "Todavía no hay rubros."));
    pintarSuma();
  }

  function pintarExiste() {
    const m = $("#c-mes").value;
    const existe = !datos.ejemplo && datos.meses.some((x) => x.mes === m);
    mostrar($("#c-existe"), existe);
    if (existe) $("#c-existe span").textContent = titulo(m) + " ya está cargado: si guardás, se reemplaza.";
  }

  function mesCambiado() {
    const m = $("#c-mes").value.trim();
    const v = !datos.ejemplo && L.esMes(m) ? datos.inflacion[m] : undefined;
    $("#c-inflacion").value = v === undefined ? "" : numero(v);
    pintarExiste();
  }

  function limpiarFormulario() {
    borrador = { filas: [] };
    for (const s of ["#c-mes", "#c-inflacion", "#c-texto"]) $(s).value = "";
    $("#c-lectura").replaceChildren();
    $("#c-error").textContent = "";
    pintarFilas();
    pintarExiste();
  }

  function editar(mes) {
    const m = datos.meses.find((x) => x.mes === mes);
    if (!m) return;
    limpiarFormulario();
    $("#c-mes").value = mes;
    mesCambiado();
    borrador.filas = m.rubros.map(filaDe);
    pintarFilas();
    ir("cargar");
  }

  function leer() {
    const r = L.leerTexto($("#c-texto").value);
    const caja = $("#c-lectura");
    caja.replaceChildren();
    $("#c-error").textContent = "";
    if (!r.rubros.length) {
      caja.append(el("p", { class: "error" }, "No se encontró ningún rubro. Cada renglón tiene que terminar con el importe."));
      return;
    }
    const antes = borrador.filas;
    borrador.filas = r.rubros.map((x) => filaDe({ nombre: x.nombre, monto: x.monto, categoria: categoriaConocida(x.nombre) }));
    pintarFilas();
    caja.append(el("p", null, "Se leyeron " + r.rubros.length + (r.rubros.length === 1 ? " rubro" : " rubros") + " por " + L.pesos(r.suma) + ". Revisalos antes de guardar."));
    if (r.total !== null) {
      const dif = L.redondear(r.total - r.suma);
      caja.append(el("p", { class: Math.abs(dif) > 1 ? "error" : "baja" }, Math.abs(dif) > 1
        ? "Ojo: el total del texto es " + L.pesos(r.total) + " y no coincide (diferencia " + L.pesos(dif) + ")."
        : "Coincide con el total del texto."));
    }
    if (r.ignorados.length) {
      caja.append(el("details", null,
        el("summary", null, el("span", { class: "nombre" }, "Renglones que no se tomaron (" + r.ignorados.length + ")")),
        el("ul", { class: "lista" }, ...r.ignorados.map((t) => el("li", null, t)))));
    }
    if (antes.some((f) => f.nombre || f.monto)) {
      avisar("Se reemplazaron los rubros del formulario.", () => { borrador.filas = antes; pintarFilas(); });
    }
  }

  function guardarMes() {
    const error = (t) => { $("#c-error").textContent = t; };
    const mes = $("#c-mes").value.trim();
    if (!L.esMes(mes)) return error("Elegí el mes (año y mes, por ejemplo 2026-10).");
    const inflacion = leerPorcentaje($("#c-inflacion").value);
    if (inflacion !== null && !(inflacion >= -50 && inflacion <= 500)) return error("La inflación tiene que ser un número, por ejemplo 2,3.");
    const rubros = [];
    for (const [i, f] of borrador.filas.entries()) {
      if (!f.nombre.trim() && !String(f.monto).trim()) continue;
      const monto = L.parsearMonto(f.monto);
      if (!f.nombre.trim()) return error("Al rubro " + (i + 1) + " le falta el nombre.");
      if (monto === null) return error("Revisá el importe de «" + f.nombre.trim() + "».");
      rubros.push({ nombre: f.nombre.trim(), categoria: f.categoria, monto });
    }
    if (!rubros.length) return error("Cargá al menos un rubro.");

    const eraEjemplo = datos.ejemplo;
    const nuevos = eraEjemplo ? L.vacio() : copiaDe(datos);
    const existia = nuevos.meses.some((m) => m.mes === mes);
    nuevos.meses = L.ordenar([...nuevos.meses.filter((m) => m.mes !== mes), { mes, rubros }]);
    if (inflacion === null) delete nuevos.inflacion[mes];
    else nuevos.inflacion[mes] = inflacion;
    cambiar(nuevos, titulo(mes) + (existia ? " se reemplazó." : " quedó guardado.") + (eraEjemplo ? " Se sacó el ejemplo." : ""));
    mesElegido = mes;
    limpiarFormulario();
    pintarResumen();
    ir("resumen");
  }

  /* ---------- Historial y datos ---------- */

  function pintarDatos() {
    const meses = datos.meses;
    const analisis = meses.map((m) => L.analizar(datos, m.mes));
    const maximo = Math.max(1, ...analisis.map((a) => a.total));
    $("#barras").replaceChildren(...(meses.length ? analisis.map((a) => {
      const i = el("i");
      i.style.width = Math.max(0, (a.total / maximo) * 100) + "%";
      return el("div", { class: "barra" },
        el("div", { class: "renglon" }, el("span", null, titulo(a.mes)), el("span", null, L.pesos(a.total) + (a.variacion === null ? "" : " (" + L.conSigno(a.variacion, L.porcentaje) + ")"))),
        el("div", { class: "pista" }, i));
    }) : [el("p", null, "Sin meses cargados.")]));

    const tabla = $("#tabla");
    tabla.replaceChildren();
    if (meses.length) {
      const corto = (m) => m.slice(5) + "/" + m.slice(0, 4);
      tabla.append(el("thead", null, el("tr", null, el("th", { scope: "col" }, "Categoría"), ...meses.map((m) => el("th", { scope: "col" }, corto(m.mes))))));
      const filas = L.CATEGORIAS.filter((c) => meses.some((m) => m.rubros.some((r) => r.categoria === c.id)));
      tabla.append(el("tbody", null, ...filas.map((c) => el("tr", null, el("th", { scope: "row" }, c.nombre),
        ...meses.map((m) => el("td", null, L.pesos(L.sumar(m.rubros.filter((r) => r.categoria === c.id)))))))));
    }

    $("#meses").replaceChildren(...[...meses].reverse().map((m) => {
      const ed = el("button", { type: "button" }, "Editar");
      const borrar = el("button", { type: "button", class: "peligro" }, "Borrar");
      ed.addEventListener("click", () => editar(m.mes));
      borrar.addEventListener("click", () => {
        const nuevos = copiaDe(datos);
        nuevos.meses = nuevos.meses.filter((x) => x.mes !== m.mes);
        cambiar(nuevos, "Se borró " + L.nombreMes(m.mes) + ".");
      });
      return el("li", { "data-mes": m.mes }, el("span", null, el("strong", null, titulo(m.mes)), " · " + L.pesos(L.sumar(m.rubros))), el("span", { class: "botones" }, ed, borrar));
    }));
    if (!meses.length) $("#meses").append(el("li", null, "Sin meses cargados."));

    const rango = meses.length > 1 ? L.rangoMeses(L.mesSiguiente(meses[0].mes), meses[meses.length - 1].mes) : [];
    $("#inflaciones").replaceChildren(...rango.map((m) => {
      const v = datos.inflacion[m];
      const campo = el("input", { type: "text", inputMode: "decimal", value: v === undefined ? "" : numero(v), "data-mes": m });
      campo.addEventListener("change", () => {
        const n = leerPorcentaje(campo.value);
        if (n !== null && !(n >= -50 && n <= 500)) {
          campo.value = datos.inflacion[m] === undefined ? "" : numero(datos.inflacion[m]);
          avisar("La inflación tiene que ser un número, por ejemplo 2,3.");
          return;
        }
        if (n === null) delete datos.inflacion[m];
        else datos.inflacion[m] = n;
        guardar();
        pintarResumen();
      });
      return el("label", null, titulo(m), campo);
    }));
    if (!rango.length) $("#inflaciones").append(el("p", null, "Aparece cuando hay dos meses o más."));

    $("#a-coef").value = datos.coeficiente === null ? "" : numero(datos.coeficiente);
    $("#a-puntos").value = numero(datos.ajustes.puntos);
    $("#a-peso").value = numero(datos.ajustes.peso);
    $("#a-error").textContent = "";
  }

  function ajustar(campo, min, max, aplicar, opcional) {
    const n = leerPorcentaje($(campo).value);
    if ((n === null && !opcional) || (n !== null && !(n >= min && n <= max))) {
      $("#a-error").textContent = "Poné un número entre " + min + " y " + max + ".";
      return;
    }
    $("#a-error").textContent = "";
    aplicar(n);
    guardar();
    pintarResumen();
  }

  function pintar() {
    mostrar($("#banner-ejemplo"), datos.ejemplo);
    pintarResumen();
    pintarDatos();
    pintarExiste();
  }

  /* ---------- Eventos ---------- */

  for (const b of document.querySelectorAll("#tabs button")) b.addEventListener("click", () => ir(b.dataset.tab));
  for (const b of document.querySelectorAll("[data-ir]")) b.addEventListener("click", () => ir(b.dataset.ir));
  for (const b of document.querySelectorAll("[data-accion=ejemplo]")) {
    b.addEventListener("click", () => { cambiar(L.ejemplo(), "Se cargó el ejemplo en lugar de lo que había."); ir("resumen"); });
  }
  $("#btn-empezar").addEventListener("click", () => {
    cambiar(L.vacio(), "Se sacó el ejemplo.");
    limpiarFormulario();
    ir("cargar");
  });
  $("#sel-mes").addEventListener("change", (e) => { mesElegido = e.target.value; pintarResumen(); });
  $("#btn-copiar").addEventListener("click", async () => {
    const texto = textoParaCopiar(L.analizar(datos, mesElegido));
    try {
      await navigator.clipboard.writeText(texto);
      avisar("Copiado. Pegalo en un mensaje o un mail.");
    } catch (e) {
      const t = $("#copia-manual");
      t.value = texto;
      mostrar(t, true);
      t.select();
      avisar("No se pudo copiar solo: el texto quedó seleccionado abajo.");
    }
  });

  $("#c-mes").addEventListener("input", mesCambiado);
  $("#btn-traer").addEventListener("click", () => editar($("#c-mes").value));
  $("#btn-leer").addEventListener("click", leer);
  $("#btn-agregar").addEventListener("click", () => {
    borrador.filas.push({ nombre: "", categoria: "otros", monto: "", tocada: false });
    pintarFilas();
    const nuevos = document.querySelectorAll("#filas .f-nombre");
    nuevos[nuevos.length - 1].focus();
  });
  $("#btn-copiar-nombres").addEventListener("click", () => {
    if (datos.ejemplo || !datos.meses.length) { avisar("Todavía no hay un mes tuyo del que traer rubros."); return; }
    const antes = borrador.filas;
    borrador.filas = datos.meses[datos.meses.length - 1].rubros.map((r) => ({ nombre: r.nombre, categoria: r.categoria, monto: "", tocada: true }));
    pintarFilas();
    avisar("Completá los importes. Los que queden vacíos marcan error: quitá los que no estén.", () => { borrador.filas = antes; pintarFilas(); });
  });
  $("#btn-guardar").addEventListener("click", guardarMes);
  $("#btn-limpiar").addEventListener("click", () => {
    const antes = { borrador, campos: ["#c-mes", "#c-inflacion", "#c-texto"].map((s) => [s, $(s).value]) };
    limpiarFormulario();
    avisar("Formulario vacío.", () => {
      borrador = antes.borrador;
      for (const [s, v] of antes.campos) $(s).value = v;
      pintarFilas();
      pintarExiste();
    });
  });

  $("#a-coef").addEventListener("change", () => ajustar("#a-coef", 0, 100, (n) => { datos.coeficiente = n; }, true));
  $("#a-puntos").addEventListener("change", () => ajustar("#a-puntos", 0, 1000, (n) => { datos.ajustes.puntos = n; }));
  $("#a-peso").addEventListener("change", () => ajustar("#a-peso", 0, 100, (n) => { datos.ajustes.peso = n; }));

  $("#btn-exportar").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }));
    const ultimo = datos.meses.length ? "-" + datos.meses[datos.meses.length - 1].mes : "";
    const a = el("a", { href: url, download: "expensas" + ultimo + ".json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#btn-importar").addEventListener("click", () => $("#in-importar").click());
  $("#in-importar").addEventListener("change", async (e) => {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    try {
      if (archivo.size > 5e6) throw new Error("El archivo es demasiado grande.");
      let obj;
      try { obj = JSON.parse(await archivo.text()); }
      catch (x) { throw new Error("El archivo no es un JSON válido."); }
      const nuevos = L.validar(obj);
      limpiarFormulario();
      cambiar(nuevos, "Importado: " + nuevos.meses.length + (nuevos.meses.length === 1 ? " mes." : " meses.") + " Reemplazó lo que había.");
    } catch (x) {
      avisar("No se importó. " + x.message);
    }
  });
  $("#btn-borrar").addEventListener("click", () => { limpiarFormulario(); cambiar(L.vacio(), "Se borró todo."); });
  $("#btn-deshacer").addEventListener("click", () => {
    const f = deshacer;
    cerrarAviso();
    if (f) f();
  });
  $("#btn-cerrar").addEventListener("click", cerrarAviso);

  datos = cargar();
  pintar();
  pintarFilas();
  ir("resumen");

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sin conexión no anda, el resto sí */ });
  }
})();
