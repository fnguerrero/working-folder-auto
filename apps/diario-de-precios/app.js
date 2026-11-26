/* Interfaz de «Diario de precios». Los cálculos viven en logica.js; acá solo se dibuja y se guarda. */
(function () {
  "use strict";
  var L = window.Logica;
  var CLAVE = "diario-de-precios:v1", CLAVE_EJEMPLO = "diario-de-precios:ejemplo", CLAVE_RESPALDO = "diario-de-precios:respaldo";
  var vista = document.getElementById("vista"), aviso = document.getElementById("aviso");

  var estado = L.estadoVacio(), esEjemplo = false;
  var anterior = null;          // copia para «Deshacer» (un solo nivel)
  var problema = "";            // problema de guardado que hay que mostrar
  var soloLectura = false;      // no pisar datos que no se pudieron leer ni respaldar
  var abierto = null;           // producto con la carga rápida desplegada
  var filtro = "", mesElegido = null, plazo = 1;
  var reloj = null, redibujarGrafico = null;

  function hoy() { return L.fechaLocal(new Date()); }

  /* ---------- guardado ---------- */

  function cargar() {
    var crudo = null;
    try {
      crudo = localStorage.getItem(CLAVE);
      esEjemplo = localStorage.getItem(CLAVE_EJEMPLO) === "1";
    } catch (e) {
      problema = "El navegador no deja guardar datos acá: lo que anotes se pierde al cerrar. Exportá una copia desde Datos.";
      return;
    }
    estado = L.estadoVacio(); soloLectura = false; problema = "";
    if (!crudo) return;
    var leido = null;
    try { leido = L.importarJSON(crudo); estado = leido.estado; } catch (e) { leido = null; }
    if (leido && !leido.descartados) return;
    try {
      localStorage.setItem(CLAVE_RESPALDO, crudo);
      problema = (leido ? "Algunos datos guardados estaban dañados y se dejaron afuera." : "No se pudieron leer los datos guardados.") +
        " Quedó una copia sin tocar: la podés bajar desde Datos.";
    } catch (e) {
      soloLectura = true;
      problema = "Hay datos guardados que no se pueden leer ni respaldar. Para no pisarlos, esta vez no se guarda nada.";
    }
  }

  function persistir() {
    if (soloLectura) return;
    try {
      localStorage.setItem(CLAVE, L.exportarJSON(estado));
      localStorage.setItem(CLAVE_EJEMPLO, esEjemplo ? "1" : "0");
    } catch (e) {
      problema = "No se pudo guardar (sin espacio o almacenamiento bloqueado). Exportá una copia desde Datos.";
    }
  }

  function cambiar(nuevo, mensaje, ejemplo) {
    anterior = { estado: estado, ejemplo: esEjemplo };
    estado = nuevo;
    if (ejemplo !== undefined) esEjemplo = ejemplo;
    if (!estado.productos.length) esEjemplo = false;
    persistir();
    dibujar();
    avisar(mensaje, true);
  }

  function deshacer() {
    if (!anterior) return;
    estado = anterior.estado; esEjemplo = anterior.ejemplo; anterior = null;
    persistir(); dibujar(); avisar("Listo, se deshizo el último cambio.", false);
  }

  function avisar(mensaje, conDeshacer) {
    document.getElementById("avisoTexto").textContent = mensaje;
    document.getElementById("deshacer").hidden = !conDeshacer;
    aviso.hidden = false;
    clearTimeout(reloj);
    reloj = setTimeout(function () { aviso.hidden = true; }, conDeshacer ? 9000 : 4000);
  }

  /* ---------- ayudas de DOM y formato ---------- */

  function h(etiqueta, atributos) {
    var nodo = document.createElement(etiqueta);
    Object.keys(atributos || {}).forEach(function (k) {
      var v = atributos[k];
      if (v === null || v === undefined || v === false) return;
      if (k.slice(0, 2) === "on") nodo.addEventListener(k.slice(2), v);
      else if (k === "value") nodo.value = v;
      else nodo.setAttribute(k, v === true ? "" : v);
    });
    agregar(nodo, Array.prototype.slice.call(arguments, 2));
    return nodo;
  }
  function agregar(nodo, hijos) {
    hijos.forEach(function (x) {
      if (Array.isArray(x)) agregar(nodo, x);
      else if (x !== null && x !== undefined && x !== false) nodo.append(x);
    });
  }
  function panel(clase) { return h.apply(null, ["section", { class: "panel " + (clase || "") }].concat(Array.prototype.slice.call(arguments, 1))); }

  var fmtPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var fmtNumero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
  var fmtUno = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  function pesos(n) { return fmtPesos.format(n); }
  function signo(n) { var r = Math.round(n * 10) / 10; return (r > 0 ? "+" : r < 0 ? "−" : "") + fmtUno.format(Math.abs(r)); }
  function pct(n) { return n === null ? "—" : signo(n) + " %"; }
  function clasePct(n) { if (n === null) return ""; var r = Math.round(n * 10); return r > 0 ? "sube" : r < 0 ? "baja" : ""; }
  function fechaCorta(f) { return f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(2, 4); }
  function hace(f) {
    var d = L.diasEntre(f, hoy());
    return d <= 0 ? "hoy" : d === 1 ? "ayer" : d < 60 ? "hace " + d + " días" : "hace " + Math.floor(d / 30) + " meses";
  }

  function campo(titulo, control, ayuda) {
    return h("label", { class: "campo" }, h("span", {}, titulo), control, ayuda ? h("small", {}, ayuda) : null);
  }
  function entradaNumero(nombre, extra) {
    return h("input", Object.assign({ name: nombre, type: "text", inputmode: "decimal", autocomplete: "off" }, extra || {}));
  }
  // Formulario que muestra el error de validación al pie en vez de romperse.
  function formulario(alEnviar) {
    var error = h("p", { class: "error", role: "alert" });
    var form = h("form", { novalidate: true, onsubmit: function (ev) {
      ev.preventDefault(); error.textContent = "";
      try { alEnviar(form); } catch (e) { error.textContent = e.message; }
    } });
    agregar(form, Array.prototype.slice.call(arguments, 1));
    form.append(error);
    return form;
  }
  function selectorMes(nombre, meses, elegido, extra) {
    return h("select", Object.assign({ name: nombre }, extra || {}), meses.map(function (m) {
      return h("option", { value: m, selected: m === elegido }, L.nombreMes(m));
    }));
  }

  /* ---------- piezas compartidas ---------- */

  function formularioPrecio(producto, conHistorial) {
    var historial = L.preciosDe(estado, producto.id), ultimo = historial[historial.length - 1];
    var precio = entradaNumero("precio", { placeholder: ultimo ? fmtNumero.format(ultimo.precio) : "0", required: true, enterkeyhint: "done" });
    var fecha = h("input", { name: "fecha", type: "date", value: hoy(), max: hoy(), required: true });
    function guardar(valor) {
      var nuevo = L.anotarPrecio(estado, producto.id, valor, fecha.value, hoy());
      var lista = L.preciosDe(nuevo, producto.id);
      var i = lista.findIndex(function (p) { return p.fecha === fecha.value; });
      var previo = lista[i - 1];
      var mensaje = producto.nombre + ": " + pesos(lista[i].precio) + (previo ? " (" + pct((lista[i].precio / previo.precio - 1) * 100) + " contra el anterior)" : "") + ".";
      abierto = null;
      cambiar(nuevo, mensaje);
    }
    var form = formulario(function () { guardar(precio.value); },
      h("div", { class: "fila" },
        campo("Precio por " + producto.unidad + " ($)", precio),
        campo("Fecha", fecha)),
      h("div", { class: "fila" },
        h("button", { type: "submit" }, "Guardar"),
        ultimo ? h("button", { type: "button", class: "secundario", onclick: function () {
          try { guardar(ultimo.precio); } catch (e) { avisar(e.message, false); }
        } }, "Sigue igual") : null,
        conHistorial ? h("a", { href: "#producto/" + producto.id }, "Ver historial") : null));
    return form;
  }

  function formularioProducto(producto, alGuardar) {
    var nombre = h("input", { name: "nombre", maxlength: 60, value: producto ? producto.nombre : "", placeholder: "Yerba", autocomplete: "off" });
    var unidad = h("input", { name: "unidad", maxlength: 30, value: producto ? producto.unidad : "", placeholder: "paquete 1 kg", list: "unidades", autocomplete: "off" });
    var cantidad = entradaNumero("cantidad", { value: producto ? String(producto.cantidad).replace(".", ",") : "", placeholder: "2" });
    var precio = producto ? null : entradaNumero("precio", { placeholder: "opcional" });
    return formulario(function () { alGuardar({ nombre: nombre.value, unidad: unidad.value, cantidad: cantidad.value }, precio ? precio.value.trim() : ""); },
      campo("Producto", nombre),
      h("div", { class: "fila" },
        campo("Unidad", unidad),
        campo("Cuánto comprás por mes", cantidad)),
      h("p", { class: "nota" }, "La cantidad es su peso en la canasta, medida en esa unidad. Con 0 se sigue el precio pero no cuenta en tu inflación."),
      precio ? campo("Precio de hoy ($)", precio) : null,
      h("datalist", { id: "unidades" }, ["unidad", "kg", "litro", "paquete 1 kg", "paquete 500 g", "docena", "servicio", "mes"].map(function (u) { return h("option", { value: u }); })),
      h("button", { type: "submit" }, producto ? "Guardar cambios" : "Agregar producto"));
  }

  function altaProducto(datos, precio) {
    var r = L.agregarProducto(estado, datos), nuevo = r.estado;
    if (precio) nuevo = L.anotarPrecio(nuevo, r.producto.id, precio, hoy(), hoy());
    cambiar(nuevo, "Agregaste " + r.producto.nombre + ".");
  }

  function panelAlertas(mes) {
    var lista = L.alertas(estado, mes, hoy());
    if (!lista.length) return null;
    return panel("aviso ancho",
      h("h2", {}, "Para mirar"),
      lista.map(function (a) {
        return h("p", {}, h("a", { href: "#producto/" + a.producto.id }, a.producto.nombre),
          " subió " + Math.round(a.variacion) + " % en dos meses (a " + L.nombreMes(mes) + "), mucho más que el resto de tu canasta (" + pct(a.resto) + ").");
      }));
  }

  function bloqueInicio() {
    return panel("ancho",
      h("h2", {}, "Empezá por lo que comprás siempre"),
      h("p", {}, "Anotá el precio en la góndola. Con un mes de datos aparece tu inflación, al lado del número oficial que cargues."),
      h("button", { type: "button", class: "secundario", onclick: function () {
        cambiar(L.ejemplo(hoy()), "Cargaste los datos de ejemplo.", true);
      } }, "Probar con datos de ejemplo"));
  }

  /* ---------- vistas ---------- */

  function vistaAnotar() {
    var salida = [];
    if (!estado.productos.length) {
      return [bloqueInicio(), panel("ancho", h("h2", {}, "Tu primer producto"), formularioProducto(null, altaProducto))];
    }
    salida.push(panelAlertas(L.mesDe(hoy())));
    var lista = h("ul", { class: "lista" });
    var vacio = h("p", { class: "nota", hidden: true }, "Ningún producto coincide.");
    function llenar() {
      var q = filtro.trim().toLocaleLowerCase("es-AR");
      var visibles = estado.productos
        .filter(function (p) { return !q || p.nombre.toLocaleLowerCase("es-AR").indexOf(q) >= 0; })
        .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });
      vacio.hidden = visibles.length > 0;
      lista.replaceChildren.apply(lista, visibles.map(function (p) {
        var historial = L.preciosDe(estado, p.id), n = historial.length, ultimo = historial[n - 1];
        var cambio = n > 1 ? (ultimo.precio / historial[n - 2].precio - 1) * 100 : null;
        var desplegado = abierto === p.id;
        return h("li", {},
          h("button", { type: "button", class: "producto", "data-id": p.id, "aria-expanded": String(desplegado), onclick: function () {
            abierto = desplegado ? null : p.id;
            aviso.hidden = true; // que no tape la carga; «Deshacer» sigue en Datos
            llenar();
            // El foco va dentro del mismo toque para que el celular abra el teclado.
            var destino = abierto ? lista.querySelector("input[name=precio]") : lista.querySelector('[data-id="' + p.id + '"]');
            if (destino) destino.focus();
          } },
            h("span", {}, h("strong", {}, p.nombre), h("small", {}, p.unidad + (ultimo ? " · " + hace(ultimo.fecha) : ""))),
            h("span", {}, h("b", {}, ultimo ? pesos(ultimo.precio) : "Sin precio"),
              cambio !== null ? h("small", { class: clasePct(cambio) }, pct(cambio)) : null)),
          desplegado ? h("div", { class: "rapida", onkeydown: function (ev) {
            if (ev.key !== "Escape") return;
            abierto = null; llenar(); lista.querySelector('[data-id="' + p.id + '"]').focus();
          } }, formularioPrecio(p, true)) : null);
      }));
    }
    llenar();
    var buscador = estado.productos.length > 8 || filtro ? h("input", { type: "search", placeholder: "Buscar producto", "aria-label": "Buscar producto", value: filtro, oninput: function (ev) { filtro = ev.target.value; llenar(); } }) : null;
    salida.push(panel("", h("h2", {}, "Tocá un producto para anotar"), buscador, lista, vacio));
    salida.push(panel("", h("details", { id: "alta" }, h("summary", {}, "+ Producto nuevo"), formularioProducto(null, altaProducto))));
    return salida;
  }

  function resumenCanasta(titulo, c, oficial, mesBase, nota) {
    var dif = c.variacion !== null && oficial !== null ? c.variacion - oficial : null;
    var frase = "";
    if (c.variacion === null) frase = "Todavía no hay productos con precio en los dos momentos. Hace falta un precio de " + L.nombreMes(mesBase) + " (o de hasta dos meses antes) y otro posterior.";
    else if (oficial === null) frase = "Cargá el número oficial de este mes para comparar.";
    else if (Math.abs(dif) < 0.05) frase = "Igual que el número oficial.";
    else frase = "Tu canasta quedó " + fmtUno.format(Math.abs(dif)) + " puntos " + (dif > 0 ? "por encima" : "por debajo") + " del número oficial.";
    var total = c.incluidos.length + c.excluidos.length;
    return panel("", h("h2", {}, titulo),
      h("div", { class: "cifras" },
        h("div", { class: "cifra propia" }, h("span", {}, "Tu inflación"), h("b", { class: clasePct(c.variacion) }, pct(c.variacion))),
        h("div", { class: "cifra oficial" }, h("span", {}, "Oficial" + (nota ? " " + nota : "")), h("b", {}, pct(oficial)))),
      h("p", {}, frase),
      c.variacion !== null ? h("p", { class: "nota" }, "Contra " + L.nombreMes(mesBase) + ". Compara " + c.incluidos.length + " de " + total + " productos (" + Math.round(c.cobertura) + " % de tu gasto). La misma compra pasó de " + pesos(Math.round(c.costoBase)) + " a " + pesos(Math.round(c.costoActual)) + ".") : null);
  }

  var MOTIVOS = { "sin-base": "no tiene un precio para la fecha de comparación", "sin-actual": "no tiene un precio nuevo", "sin-precios": "todavía no tiene precios" };

  function vistaCanasta() {
    if (!estado.productos.length) return [bloqueInicio()];
    var fecha = hoy(), meses = L.mesesDisponibles(estado, fecha);
    var mes = meses.indexOf(mesElegido) >= 0 ? mesElegido : L.ultimoMesConDatos(estado, fecha);
    var mensual = L.canasta(estado, mes, 1, fecha), interanual = L.canasta(estado, mes, 12, fecha);
    var oficial = L.oficialDe(estado, mes);
    var salida = [panel("ancho",
      campo("Mes", selectorMes("mes", meses, mes, { onchange: function (ev) { mesElegido = ev.target.value; dibujar(); vista.querySelector("select[name=mes]").focus(); } })),
      mes === L.mesDe(fecha) ? h("p", { class: "nota" }, "Mes en curso: usa lo anotado hasta hoy.") : null,
      !estado.productos.some(function (p) { return p.cantidad > 0; }) ? h("p", { class: "error" }, "Ningún producto tiene cantidad por mes: cargala desde la ficha de cada uno para armar la canasta.") : null)];
    salida.push(resumenCanasta("Contra el mes anterior", mensual, oficial.mensual, L.sumarMeses(mes, -1), ""));
    salida.push(resumenCanasta("Contra hace un año", interanual, oficial.interanual, L.sumarMeses(mes, -12), oficial.calculado ? "(compuesto de 12 meses)" : ""));
    salida.push(panelAlertas(mes));

    var elegida = plazo === 12 ? interanual : mensual;
    function segmento(valor, rotulo) {
      return h("button", { type: "button", class: "chico" + (plazo === valor ? "" : " secundario"), "aria-pressed": String(plazo === valor), "data-plazo": valor, onclick: function () {
        plazo = valor; dibujar(); vista.querySelector('[data-plazo="' + valor + '"]').focus();
      } }, rotulo);
    }
    salida.push(panel("", h("h2", {}, "Qué movió tu canasta"),
      h("div", { class: "segmentos" }, segmento(1, "Mensual"), segmento(12, "Interanual")),
      elegida.incluidos.length ? h("div", { class: "tabla" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "Producto"), h("th", {}, "Peso"), h("th", {}, "Subió"), h("th", { title: "Puntos de tu inflación que explica cada producto" }, "Aporta"))),
        h("tbody", {}, elegida.incluidos.map(function (x) {
          return h("tr", {}, h("td", {}, h("a", { href: "#producto/" + x.producto.id }, x.producto.nombre)),
            h("td", {}, Math.round(x.peso) + " %"), h("td", { class: clasePct(x.variacion) }, pct(x.variacion)), h("td", {}, signo(x.aporte) + " pts"));
        })))) : h("p", { class: "nota" }, "Sin datos comparables en este plazo."),
      elegida.excluidos.length ? h("details", {}, h("summary", {}, "Quedaron afuera: " + elegida.excluidos.length),
        h("ul", {}, elegida.excluidos.map(function (x) { return h("li", {}, h("a", { href: "#producto/" + x.producto.id }, x.producto.nombre), ": " + MOTIVOS[x.motivo] + "."); }))) : null));

    var doce = meses.slice(0, 12);
    salida.push(panel("", h("h2", {}, "Mes por mes"),
      h("div", { class: "tabla" }, h("table", { id: "historia" },
        h("thead", {}, h("tr", {}, h("th", {}, "Mes"), h("th", {}, "Tuya"), h("th", {}, "Oficial"))),
        h("tbody", {}, doce.map(function (m) {
          var propia = L.canasta(estado, m, 1, fecha).variacion;
          return h("tr", {}, h("td", {}, L.nombreMes(m)), h("td", { class: clasePct(propia) }, pct(propia)), h("td", {}, pct(L.oficialDe(estado, m).mensual)));
        }))))));

    salida.push(panelOficial(mes, fecha));
    return salida;
  }

  function panelOficial(mes, fecha) {
    var opciones = [], actual = L.mesDe(fecha);
    for (var i = 0; i < 36; i++) opciones.push(L.sumarMeses(actual, -i));
    var inicial = opciones.indexOf(mes) >= 0 ? mes : actual;
    var selector = selectorMes("mesOficial", opciones, inicial);
    var mensual = entradaNumero("mensual", { placeholder: "2,5" });
    var interanual = entradaNumero("interanual", { placeholder: "opcional" });
    function precargar() {
      var o = estado.oficial.find(function (x) { return x.mes === selector.value; });
      mensual.value = o ? String(o.mensual).replace(".", ",") : "";
      interanual.value = o && o.interanual !== null ? String(o.interanual).replace(".", ",") : "";
    }
    selector.addEventListener("change", precargar);
    precargar();
    return panel("ancho", h("h2", {}, "Número oficial"),
      h("p", { class: "nota" }, "Lo cargás a mano (por ejemplo, el índice de precios que publica el INDEC). La app no se conecta a ningún lado."),
      formulario(function () {
        cambiar(L.anotarOficial(estado, selector.value, mensual.value, interanual.value), "Guardaste el oficial de " + L.nombreMes(selector.value) + ".");
      },
        h("div", { class: "fila" }, campo("Mes del dato", selector), campo("Mensual (%)", mensual), campo("Interanual (%)", interanual),
          h("button", { type: "submit" }, "Guardar oficial"))),
      estado.oficial.length ? h("details", {}, h("summary", {}, "Cargados: " + estado.oficial.length),
        h("div", { class: "tabla" }, h("table", {}, h("tbody", {}, estado.oficial.slice().reverse().map(function (o) {
          return h("tr", {}, h("td", {}, L.nombreMes(o.mes)), h("td", {}, pct(o.mensual)), h("td", {}, o.interanual === null ? "" : pct(o.interanual) + " i.a."),
            h("td", {}, h("button", { type: "button", class: "chico secundario", "aria-label": "Borrar oficial de " + L.nombreMes(o.mes), onclick: function () {
              cambiar(L.borrarOficial(estado, o.mes), "Borraste el oficial de " + L.nombreMes(o.mes) + ".");
            } }, "Borrar")));
        }))))) : null);
  }

  function dibujarSVG(contenedor, producto, historial) {
    var NS = "http://www.w3.org/2000/svg";
    function s(etiqueta, atributos, texto) {
      var n = document.createElementNS(NS, etiqueta);
      Object.keys(atributos).forEach(function (k) { n.setAttribute(k, atributos[k]); });
      if (texto !== undefined) n.textContent = texto;
      return n;
    }
    var ancho = Math.max(240, Math.round(contenedor.clientWidth) || 300), alto = 210;
    var etiquetaMax = pesos(Math.max.apply(null, historial.map(function (p) { return p.precio; })));
    var margen = { izq: Math.min(110, etiquetaMax.length * 7 + 8), der: 8, sup: 12, inf: 24 };
    var g = L.puntosGrafico(historial, ancho, alto, margen);
    var primero = g.puntos[0], ultimo = g.puntos[g.puntos.length - 1];
    var svg = s("svg", { class: "grafico", viewBox: "0 0 " + ancho + " " + alto, role: "img",
      "aria-label": "Precio de " + producto.nombre + ": " + pesos(primero.precio) + " el " + fechaCorta(primero.fecha) + ", " + pesos(ultimo.precio) + " el " + fechaCorta(ultimo.fecha) + "." });
    (g.min === g.max ? [[g.yMin, g.min]] : [[g.yMax, g.max], [g.yMin, g.min]]).forEach(function (marca) {
      svg.append(s("line", { class: "eje", x1: margen.izq, x2: ancho - margen.der, y1: marca[0], y2: marca[0] }));
      svg.append(s("text", { x: margen.izq - 6, y: marca[0] + 4, "text-anchor": "end" }, pesos(marca[1])));
    });
    if (g.puntos.length > 1) svg.append(s("polyline", { class: "linea", points: g.puntos.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" ") }));
    g.puntos.forEach(function (p) {
      var c = s("circle", { cx: p.x, cy: p.y, r: g.puntos.length > 60 ? 2 : 4 });
      c.append(s("title", {}, fechaCorta(p.fecha) + ": " + pesos(p.precio)));
      svg.append(c);
    });
    if (g.puntos.length > 1) {
      svg.append(s("text", { x: margen.izq, y: alto - 6 }, fechaCorta(primero.fecha)));
      svg.append(s("text", { x: ancho - margen.der, y: alto - 6, "text-anchor": "end" }, fechaCorta(ultimo.fecha)));
    } else svg.append(s("text", { x: primero.x, y: alto - 6, "text-anchor": "middle" }, fechaCorta(primero.fecha)));
    contenedor.replaceChildren(svg);
  }

  function vistaProducto(id) {
    var producto = L.buscar(estado, id);
    if (!producto) return [panel("ancho", h("p", {}, "Ese producto ya no está."), h("a", { href: "#anotar" }, "Volver"))];
    var historial = L.preciosDe(estado, id), ultimo = historial[historial.length - 1];
    var salida = [panel("ancho",
      h("a", { href: "#anotar" }, "← Productos"),
      h("h2", {}, producto.nombre),
      h("p", { class: "nota" }, "Por " + producto.unidad + " · " + (producto.cantidad > 0 ? fmtNumero.format(producto.cantidad) + " por mes en la canasta" : "fuera de la canasta") + (ultimo ? " · último: " + pesos(ultimo.precio) + ", " + hace(ultimo.fecha) : "")))];
    if (ultimo) {
      var mes = L.mesDe(ultimo.fecha <= hoy() ? ultimo.fecha : hoy());
      var cifra = function (rotulo, atras) {
        var c = L.comparar(estado, id, mes, atras, hoy());
        return h("div", { class: "cifra" }, h("span", {}, rotulo + " (" + L.nombreMes(L.sumarMeses(mes, -atras)) + ")"),
          h("b", { class: clasePct(c.variacion) }, pct(c.variacion)),
          h("span", {}, c.base && !c.motivo ? "De " + pesos(c.base.precio) + " a " + pesos(c.actual.precio) : "Falta un precio de esa época"));
      };
      salida.push(panel("ancho", h("h3", {}, "Precio de " + L.nombreMes(mes)), h("div", { class: "cifras" }, cifra("Contra el mes pasado", 1), cifra("Contra hace un año", 12))));
      var lienzo = h("div", { id: "lienzo" });
      salida.push(panel("ancho", h("h2", {}, "Precio en el tiempo"), lienzo));
      redibujarGrafico = function () { dibujarSVG(lienzo, producto, historial); };
    }
    salida.push(panel("", h("h2", {}, "Anotar precio"), formularioPrecio(producto, false)));
    salida.push(panel("", h("h2", {}, "Historial"),
      historial.length ? h("div", { class: "tabla" }, h("table", { id: "precios" }, h("tbody", {}, historial.slice().reverse().map(function (p) {
        return h("tr", {}, h("td", {}, fechaCorta(p.fecha)), h("td", {}, pesos(p.precio)),
          h("td", {}, h("button", { type: "button", class: "chico secundario", "aria-label": "Borrar el precio del " + fechaCorta(p.fecha), onclick: function () {
            cambiar(L.borrarPrecio(estado, id, p.fecha), "Borraste el precio del " + fechaCorta(p.fecha) + ".");
          } }, "Borrar")));
      })))) : h("p", { class: "nota" }, "Todavía no hay precios.")));
    salida.push(panel("ancho", h("details", { id: "editar" }, h("summary", {}, "Editar o borrar el producto"),
      formularioProducto(producto, function (datos) { cambiar(L.editarProducto(estado, id, datos), "Guardaste los cambios."); }),
      h("p", {}, h("button", { type: "button", class: "secundario", id: "borrarProducto", onclick: function () {
        var nuevo = L.borrarProducto(estado, id);
        location.hash = "#anotar";
        cambiar(nuevo, "Borraste " + producto.nombre + " y sus precios.");
      } }, "Borrar producto")))));
    return salida;
  }

  function bajar(nombre, contenido, tipo) {
    var url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    var a = h("a", { href: url, download: nombre });
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importar(archivo) {
    if (archivo.size > 5e6) { avisar("El archivo es demasiado grande para ser una copia de esta app.", false); return; }
    var lector = new FileReader();
    lector.onerror = function () { avisar("No se pudo leer el archivo.", false); };
    lector.onload = function () {
      try {
        var contenido = String(lector.result), r;
        if (/^﻿?\s*[{[]/.test(contenido)) {
          r = L.importarJSON(contenido);
          cambiar(r.estado, "Copia restaurada: reemplazó todo (" + r.estado.productos.length + " productos, " + r.estado.precios.length + " precios" + (r.descartados ? ", " + r.descartados + " descartados" : "") + ").", false);
        } else {
          r = L.importarCSV(estado, contenido);
          if (!r.resumen.productos && !r.resumen.precios) throw new Error("El CSV no tenía filas válidas.");
          cambiar(r.estado, "CSV sumado: " + r.resumen.productos + " productos nuevos, " + r.resumen.precios + " precios" + (r.resumen.descartados ? ", " + r.resumen.descartados + " filas descartadas" : "") + ".", false);
        }
      } catch (e) { avisar(e.message, false); }
    };
    lector.readAsText(archivo, "utf-8");
  }

  function vistaDatos() {
    var respaldo = null;
    try { respaldo = localStorage.getItem(CLAVE_RESPALDO); } catch (e) { /* sin almacenamiento */ }
    var archivo = h("input", { type: "file", id: "archivo", accept: ".json,.csv,application/json,text/csv", onchange: function () { if (archivo.files[0]) importar(archivo.files[0]); archivo.value = ""; } });
    return [
      panel("", h("h2", {}, "Exportar"),
        h("p", { class: "nota" }, "Todo queda en este navegador. Si borrás los datos del sitio, se pierde: guardá una copia cada tanto."),
        h("div", { class: "fila" },
          h("button", { type: "button", id: "bajarJSON", onclick: function () { bajar("diario-de-precios-" + hoy() + ".json", L.exportarJSON(estado), "application/json"); } }, "Copia completa (JSON)"),
          h("button", { type: "button", id: "bajarCSV", class: "secundario", onclick: function () { bajar("diario-de-precios-" + hoy() + ".csv", "﻿" + L.exportarCSV(estado), "text/csv;charset=utf-8"); } }, "Precios (CSV)")),
        h("p", { class: "nota" }, "El CSV lleva productos y precios, no los números oficiales.")),
      panel("", h("h2", {}, "Importar"),
        campo("Elegí un archivo .json o .csv", archivo),
        h("p", { class: "nota" }, "El JSON reemplaza todo. El CSV (producto;unidad;cantidad_mensual;fecha;precio) se suma a lo que ya tenés. Las dos cosas se pueden deshacer.")),
      panel("ancho", h("h2", {}, "Cambios"),
        h("div", { class: "fila" },
          h("button", { type: "button", class: "secundario", disabled: !anterior, onclick: deshacer }, "Deshacer el último cambio"),
          estado.productos.length || estado.oficial.length
            ? h("button", { type: "button", class: "secundario", id: "borrarTodo", onclick: function () { cambiar(L.estadoVacio(), "Borraste todo.", false); } }, "Borrar todo")
            : h("button", { type: "button", class: "secundario", onclick: function () { cambiar(L.ejemplo(hoy()), "Cargaste los datos de ejemplo.", true); } }, "Cargar datos de ejemplo"),
          respaldo ? h("button", { type: "button", class: "secundario", onclick: function () { bajar("diario-de-precios-respaldo.txt", respaldo, "text/plain"); } }, "Bajar datos que no se pudieron leer") : null))
    ];
  }

  /* ---------- armado ---------- */

  function ruta() {
    var m = /^#producto\/([\w-]+)$/.exec(location.hash);
    if (m) return { vista: "producto", id: m[1] };
    return { vista: location.hash === "#canasta" ? "canasta" : location.hash === "#datos" ? "datos" : "anotar" };
  }

  function dibujar() {
    var r = ruta();
    var y = window.scrollY;
    redibujarGrafico = null;
    var partes = r.vista === "producto" ? vistaProducto(r.id) : r.vista === "canasta" ? vistaCanasta() : r.vista === "datos" ? vistaDatos() : vistaAnotar();
    var avisos = [];
    if (problema) avisos.push(panel("aviso ancho", h("p", { role: "alert" }, problema)));
    if (esEjemplo) avisos.push(panel("aviso ancho", h("p", {}, "Estás viendo datos de ejemplo, inventados. ",
      h("button", { type: "button", class: "chico", id: "borrarEjemplo", onclick: function () { cambiar(L.estadoVacio(), "Borraste el ejemplo.", false); } }, "Borrar todo y empezar con lo mío"))));
    vista.replaceChildren.apply(vista, avisos.concat(partes).filter(Boolean));
    document.querySelectorAll("nav a").forEach(function (a) {
      if (a.dataset.vista === (r.vista === "producto" ? "anotar" : r.vista)) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (redibujarGrafico) redibujarGrafico();
    window.scrollTo(0, y);
  }

  document.getElementById("deshacer").addEventListener("click", deshacer);
  window.addEventListener("hashchange", function () { abierto = null; dibujar(); window.scrollTo(0, 0); });
  var anchoPrevio = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === anchoPrevio) return;
    anchoPrevio = window.innerWidth;
    if (redibujarGrafico) redibujarGrafico();
  });
  // Si otra pestaña cambió los datos, se recargan para no pisarlos.
  window.addEventListener("storage", function (ev) {
    if (ev.key !== CLAVE && ev.key !== null) return;
    cargar(); anterior = null; aviso.hidden = true; dibujar();
  });

  cargar();
  dibujar();
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* sin service worker la app anda igual */ });
  }
})();
