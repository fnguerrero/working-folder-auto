/* Lógica de «Diario de precios»: sin DOM, sin red, sin reloj propio (la fecha de hoy entra por parámetro).
   Se usa en el navegador como window.Logica y en Node con require(). */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Logica = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = 1;
  var VIGENCIA_DIAS = 62; // un precio sirve como referencia hasta unos dos meses después de anotado
  var ALERTA = { meses: 2, minimo: 10, vecesElResto: 2, puntos: 10, otros: 2 };
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* ---------- números y fechas ---------- */

  // Acepta "1.234,50", "1234,5", "1234.50", "$ 1.234" y "-0,4". Devuelve null si no es un número.
  function parsearNumero(texto) {
    if (typeof texto === "number") return isFinite(texto) ? texto : null;
    if (typeof texto !== "string") return null;
    var t = texto.replace(/[\s$%]/g, "");
    if (t.indexOf(",") >= 0) {
      if (!/^-?(\d+|\d{1,3}(\.\d{3})+)?,\d*$/.test(t)) return null;
      t = t.replace(/\./g, "").replace(",", ".");
    } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
      t = t.replace(/\./g, "");
    }
    if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  function dos(n) { return (n < 10 ? "0" : "") + n; }

  function esFecha(f) {
    if (typeof f !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
    var d = new Date(f + "T00:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
  }
  function esMes(m) { return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
  function fechaLocal(d) { return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); }
  function mesDe(fecha) { return fecha.slice(0, 7); }
  function sumarMeses(mes, n) {
    var total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
    return Math.floor(total / 12) + "-" + dos((total % 12) + 1);
  }
  function finDeMes(mes) {
    var d = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
    return d.toISOString().slice(0, 10);
  }
  function diasEntre(desde, hasta) {
    return Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400000);
  }
  function nombreMes(mes) { return MESES[Number(mes.slice(5, 7)) - 1] + " " + mes.slice(0, 4); }

  /* ---------- estado ---------- */

  function estadoVacio() { return { version: VERSION, productos: [], precios: [], oficial: [] }; }

  function copiar(estado) {
    return {
      version: VERSION,
      productos: estado.productos.map(function (p) { return Object.assign({}, p); }),
      precios: estado.precios.map(function (p) { return Object.assign({}, p); }),
      oficial: estado.oficial.map(function (o) { return Object.assign({}, o); })
    };
  }

  function nuevoId(estado) {
    var max = 0;
    estado.productos.forEach(function (p) {
      var m = /^p(\d{1,12})$/.exec(p.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return "p" + (max + 1);
  }

  function texto(v, largo) { return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, largo) : ""; }
  function clave(nombre, unidad) { return (nombre + "|" + unidad).toLocaleLowerCase("es-AR"); }

  function validarProducto(estado, datos, idPropio) {
    var nombre = texto(datos.nombre, 60);
    var unidad = texto(datos.unidad, 30) || "unidad";
    var vacia = datos.cantidad === undefined || datos.cantidad === null || String(datos.cantidad).trim() === "";
    var cantidad = vacia ? 0 : parsearNumero(datos.cantidad);
    if (!nombre) throw new Error("Poné el nombre del producto.");
    if (cantidad === null || cantidad < 0 || cantidad > 1e6) throw new Error("La cantidad por mes tiene que ser un número de cero para arriba.");
    var repetido = estado.productos.some(function (p) { return p.id !== idPropio && clave(p.nombre, p.unidad) === clave(nombre, unidad); });
    if (repetido) throw new Error("Ya tenés «" + nombre + "» por " + unidad + ".");
    return { nombre: nombre, unidad: unidad, cantidad: cantidad };
  }

  function agregarProducto(estado, datos) {
    var limpio = validarProducto(estado, datos, null);
    var nuevo = copiar(estado);
    var producto = Object.assign({ id: nuevoId(estado) }, limpio);
    nuevo.productos.push(producto);
    return { estado: nuevo, producto: producto };
  }

  function editarProducto(estado, id, datos) {
    var limpio = validarProducto(estado, datos, id);
    var nuevo = copiar(estado);
    var p = buscar(nuevo, id);
    if (!p) throw new Error("Ese producto no existe.");
    Object.assign(p, limpio);
    return nuevo;
  }

  function borrarProducto(estado, id) {
    var nuevo = copiar(estado);
    nuevo.productos = nuevo.productos.filter(function (p) { return p.id !== id; });
    nuevo.precios = nuevo.precios.filter(function (p) { return p.productoId !== id; });
    return nuevo;
  }

  function buscar(estado, id) {
    for (var i = 0; i < estado.productos.length; i++) if (estado.productos[i].id === id) return estado.productos[i];
    return null;
  }

  // Un precio por producto y por día: anotar de nuevo el mismo día corrige el anterior.
  function anotarPrecio(estado, productoId, precio, fecha, hoy) {
    var valor = parsearNumero(precio);
    if (!buscar(estado, productoId)) throw new Error("Ese producto no existe.");
    if (valor === null || valor < 0.01 || valor > 1e12) throw new Error("El precio tiene que ser un número mayor que cero.");
    if (!esFecha(fecha)) throw new Error("La fecha no es válida.");
    if (hoy && fecha > hoy) throw new Error("No se pueden anotar precios con fecha futura.");
    var nuevo = copiar(estado);
    nuevo.precios = nuevo.precios.filter(function (p) { return !(p.productoId === productoId && p.fecha === fecha); });
    nuevo.precios.push({ productoId: productoId, fecha: fecha, precio: Math.round(valor * 100) / 100 });
    return nuevo;
  }

  function borrarPrecio(estado, productoId, fecha) {
    var nuevo = copiar(estado);
    nuevo.precios = nuevo.precios.filter(function (p) { return !(p.productoId === productoId && p.fecha === fecha); });
    return nuevo;
  }

  function anotarOficial(estado, mes, mensual, interanual) {
    if (!esMes(mes)) throw new Error("Elegí el mes.");
    var m = parsearNumero(mensual);
    var vacio = interanual === undefined || interanual === null || String(interanual).trim() === "";
    var i = vacio ? null : parsearNumero(interanual);
    if (m === null || m <= -100) throw new Error("La variación mensual tiene que ser un número, por ejemplo 2,5.");
    if (!vacio && (i === null || i <= -100)) throw new Error("La variación interanual tiene que ser un número, o quedar vacía.");
    var nuevo = copiar(estado);
    nuevo.oficial = nuevo.oficial.filter(function (o) { return o.mes !== mes; });
    nuevo.oficial.push({ mes: mes, mensual: m, interanual: i });
    nuevo.oficial.sort(function (a, b) { return a.mes < b.mes ? -1 : 1; });
    return nuevo;
  }

  function borrarOficial(estado, mes) {
    var nuevo = copiar(estado);
    nuevo.oficial = nuevo.oficial.filter(function (o) { return o.mes !== mes; });
    return nuevo;
  }

  /* ---------- precios y variaciones ---------- */

  // Historial de un producto, del más viejo al más nuevo.
  function preciosDe(estado, productoId) {
    return estado.precios
      .filter(function (p) { return p.productoId === productoId; })
      .sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
  }

  // Último precio anotado hasta la fecha de corte (inclusive).
  function precioAl(historial, corte) {
    for (var i = historial.length - 1; i >= 0; i--) if (historial[i].fecha <= corte) return historial[i];
    return null;
  }

  /* Compara el precio de un mes contra el de «atras» meses antes.
     - Base: último precio al cierre del mes base, anotado como mucho VIGENCIA_DIAS antes.
     - Actual: último precio hasta el cierre del mes (u hoy), posterior al cierre base y no más viejo que VIGENCIA_DIAS.
     Así un mismo dato nunca hace de base y de actual (daría un 0 % falso). */
  function compararHistorial(historial, mes, atras, hoy) {
    var corte = finDeMes(mes);
    if (hoy && hoy < corte) corte = hoy;
    var corteBase = finDeMes(sumarMeses(mes, -atras));
    var actual = precioAl(historial, corte);
    var base = precioAl(historial, corteBase);
    if (base && diasEntre(base.fecha, corteBase) > VIGENCIA_DIAS) base = null;
    if (actual && (actual.fecha <= corteBase || diasEntre(actual.fecha, corte) > VIGENCIA_DIAS)) actual = null;
    var motivo = !actual ? "sin-actual" : !base ? "sin-base" : null;
    return { actual: actual, base: base, motivo: motivo, variacion: motivo ? null : (actual.precio / base.precio - 1) * 100 };
  }

  function comparar(estado, productoId, mes, atras, hoy) {
    return compararHistorial(preciosDe(estado, productoId), mes, atras, hoy);
  }

  /* Canasta de cantidades fijas (Laspeyres): Σ cantidad × precio actual / Σ cantidad × precio base - 1.
     Solo entran los productos con cantidad > 0 que tienen precio en las dos puntas.
     «aporte» son los puntos porcentuales que pone cada uno: sumados dan la variación total. */
  function canasta(estado, mes, atras, hoy) {
    var incluidos = [], excluidos = [];
    var costoBase = 0, costoActual = 0, gastoDentro = 0, gastoTotal = 0;
    var corte = finDeMes(mes);
    if (hoy && hoy < corte) corte = hoy;
    estado.productos.forEach(function (producto) {
      if (!(producto.cantidad > 0)) return;
      var historial = preciosDe(estado, producto.id);
      var c = compararHistorial(historial, mes, atras, hoy);
      var ultimo = precioAl(historial, corte) || historial[0];
      var gasto = ultimo ? ultimo.precio * producto.cantidad : 0;
      gastoTotal += gasto;
      if (c.motivo) { excluidos.push({ producto: producto, motivo: ultimo ? c.motivo : "sin-precios" }); return; }
      gastoDentro += gasto;
      costoBase += producto.cantidad * c.base.precio;
      costoActual += producto.cantidad * c.actual.precio;
      incluidos.push({ producto: producto, base: c.base, actual: c.actual, variacion: c.variacion });
    });
    incluidos.forEach(function (x) {
      var q = x.producto.cantidad;
      x.peso = q * x.base.precio / costoBase * 100;
      x.aporte = q * (x.actual.precio - x.base.precio) / costoBase * 100;
    });
    incluidos.sort(function (a, b) { return b.aporte - a.aporte; });
    return {
      variacion: incluidos.length ? (costoActual / costoBase - 1) * 100 : null,
      costoBase: costoBase, costoActual: costoActual,
      incluidos: incluidos, excluidos: excluidos,
      cobertura: gastoTotal > 0 ? gastoDentro / gastoTotal * 100 : 0
    };
  }

  // Número oficial de un mes. Si falta el interanual pero están los 12 mensuales, se calcula componiendo.
  function oficialDe(estado, mes) {
    var porMes = {};
    estado.oficial.forEach(function (o) { porMes[o.mes] = o; });
    var propio = porMes[mes];
    var interanual = propio && propio.interanual !== null ? propio.interanual : null;
    var calculado = false;
    if (interanual === null) {
      var factor = 1, completos = true;
      for (var i = 0; i < 12 && completos; i++) {
        var o = porMes[sumarMeses(mes, -i)];
        if (o) factor *= 1 + o.mensual / 100; else completos = false;
      }
      if (completos) { interanual = (factor - 1) * 100; calculado = true; }
    }
    return { mensual: propio ? propio.mensual : null, interanual: interanual, calculado: calculado };
  }

  /* Alerta: un producto que subió bastante en dos meses y mucho más que el resto de la canasta
     (calculada sin él): al menos 10 %, el doble que el resto y 10 puntos por encima. */
  function alertas(estado, mes, hoy) {
    var salida = [];
    estado.productos.forEach(function (producto) {
      var c = comparar(estado, producto.id, mes, ALERTA.meses, hoy);
      if (c.motivo || c.variacion < ALERTA.minimo) return;
      var sinEl = Object.assign({}, estado, { productos: estado.productos.filter(function (p) { return p.id !== producto.id; }) });
      var resto = canasta(sinEl, mes, ALERTA.meses, hoy);
      if (resto.incluidos.length < ALERTA.otros) return;
      if (c.variacion < resto.variacion * ALERTA.vecesElResto || c.variacion - resto.variacion < ALERTA.puntos) return;
      salida.push({ producto: producto, variacion: c.variacion, resto: resto.variacion, meses: ALERTA.meses });
    });
    return salida.sort(function (a, b) { return (b.variacion - b.resto) - (a.variacion - a.resto); });
  }

  // Meses con algo para mirar: desde el primer precio hasta el mes de hoy, del más nuevo al más viejo.
  function mesesDisponibles(estado, hoy) {
    var primero = null;
    estado.precios.forEach(function (p) { if (p.fecha <= hoy && (!primero || p.fecha < primero)) primero = p.fecha; });
    var salida = [], mes = mesDe(hoy), desde = primero ? mesDe(primero) : mes;
    while (mes >= desde && salida.length < 600) { salida.push(mes); mes = sumarMeses(mes, -1); }
    return salida;
  }

  // El mes más reciente en el que se anotó algo (hasta hoy).
  function ultimoMesConDatos(estado, hoy) {
    var ultimo = null;
    estado.precios.forEach(function (p) { if (p.fecha <= hoy && (!ultimo || p.fecha > ultimo)) ultimo = p.fecha; });
    return mesDe(ultimo || hoy);
  }

  /* Coordenadas del gráfico: x proporcional al tiempo, y proporcional al precio. */
  function puntosGrafico(historial, ancho, alto, margen) {
    if (!historial.length) return null;
    var precios = historial.map(function (p) { return p.precio; });
    var min = Math.min.apply(null, precios), max = Math.max.apply(null, precios);
    var aire = max === min ? max * 0.1 : (max - min) * 0.08;
    var abajo = Math.max(0, min - aire), arriba = max + aire;
    var primero = historial[0].fecha, dias = diasEntre(primero, historial[historial.length - 1].fecha);
    var w = ancho - margen.izq - margen.der, h = alto - margen.sup - margen.inf;
    function y(v) { return margen.sup + h - (v - abajo) / (arriba - abajo) * h; }
    return {
      min: min, max: max, yMin: y(min), yMax: y(max),
      puntos: historial.map(function (p) {
        return { fecha: p.fecha, precio: p.precio, x: margen.izq + (dias ? diasEntre(primero, p.fecha) / dias * w : w / 2), y: y(p.precio) };
      })
    };
  }

  /* ---------- importar y exportar ---------- */

  // Valida un objeto de afuera. Lo que está mal se descarta y se cuenta; si no es de esta app, falla.
  function normalizar(datos) {
    if (!datos || typeof datos !== "object" || !Array.isArray(datos.productos) || !Array.isArray(datos.precios)) {
      throw new Error("El archivo no es una copia de Diario de precios.");
    }
    if (typeof datos.version !== "number" || datos.version > VERSION) throw new Error("La copia es de una versión que esta app no conoce.");
    var estado = estadoVacio(), descartados = 0, ids = Object.create(null);
    datos.productos.forEach(function (p) {
      try {
        if (!p || typeof p.id !== "string" || !/^[\w-]{1,40}$/.test(p.id) || ids[p.id]) throw new Error("id");
        estado.productos.push(Object.assign({ id: p.id }, validarProducto(estado, p, null)));
        ids[p.id] = true;
      } catch (e) { descartados++; }
    });
    var vistos = new Map();
    datos.precios.forEach(function (p) {
      var valor = p ? parsearNumero(p.precio) : null;
      if (!p || !ids[p.productoId] || !esFecha(p.fecha) || valor === null || valor <= 0 || valor > 1e12) { descartados++; return; }
      var k = p.productoId + "|" + p.fecha;
      if (vistos.has(k)) descartados++;
      vistos.set(k, { productoId: p.productoId, fecha: p.fecha, precio: valor });
    });
    estado.precios = Array.from(vistos.values());
    (Array.isArray(datos.oficial) ? datos.oficial : []).forEach(function (o) {
      try { estado = anotarOficial(estado, o.mes, o.mensual, o.interanual); } catch (e) { descartados++; }
    });
    return { estado: estado, descartados: descartados };
  }

  function exportarJSON(estado) { return JSON.stringify(copiar(estado), null, 2); }

  function importarJSON(contenido) {
    var datos;
    try { datos = JSON.parse(String(contenido).replace(/^﻿/, "")); } catch (e) { throw new Error("El archivo no es un JSON válido."); }
    return normalizar(datos);
  }

  var CABECERA = ["producto", "unidad", "cantidad_mensual", "fecha", "precio"];

  function celda(v) {
    var s = String(v);
    if (/^'*[=+\-@\t\r]/.test(s)) s = "'" + s; // que la planilla no lo tome como fórmula
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function decimal(n) { return String(n).replace(".", ","); }

  // CSV para planilla en español: separado por punto y coma y con coma decimal.
  function exportarCSV(estado) {
    var filas = [CABECERA.join(";")];
    estado.productos.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); }).forEach(function (p) {
      var base = [celda(p.nombre), celda(p.unidad), decimal(p.cantidad)];
      var historial = preciosDe(estado, p.id);
      if (!historial.length) filas.push(base.concat(["", ""]).join(";"));
      historial.forEach(function (h) { filas.push(base.concat([h.fecha, decimal(h.precio)]).join(";")); });
    });
    return filas.join("\r\n") + "\r\n";
  }

  function leerCSV(contenido, separador) {
    var filas = [], fila = [], actual = "", comillas = false;
    for (var i = 0; i < contenido.length; i++) {
      var c = contenido[i];
      if (comillas) {
        if (c !== '"') actual += c;
        else if (contenido[i + 1] === '"') { actual += '"'; i++; }
        else comillas = false;
      } else if (c === '"' && actual === "") comillas = true;
      else if (c === separador) { fila.push(actual); actual = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && contenido[i + 1] === "\n") i++;
        fila.push(actual); filas.push(fila); fila = []; actual = "";
      } else actual += c;
    }
    if (actual !== "" || fila.length) { fila.push(actual); filas.push(fila); }
    return filas.filter(function (f) { return f.some(function (x) { return x.trim() !== ""; }); });
  }

  // Las planillas suelen reescribir la fecha como 3/11/2026.
  function fechaDeCSV(t) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    var f = m ? m[3] + "-" + dos(Number(m[2])) + "-" + dos(Number(m[1])) : t;
    return esFecha(f) ? f : null;
  }

  /* El CSV se suma a lo que ya hay: crea los productos que faltan y agrega o corrige precios.
     No cambia la cantidad de un producto que ya existe. */
  function importarCSV(estado, contenido) {
    var limpio = String(contenido).replace(/^﻿/, "");
    var primera = limpio.split(/\r?\n/)[0];
    var separador = primera.indexOf(";") >= 0 ? ";" : primera.indexOf("\t") >= 0 ? "\t" : ",";
    var filas = leerCSV(limpio, separador);
    if (!filas.length) throw new Error("El CSV está vacío.");
    var cabecera = filas[0].map(function (x) { return x.trim().toLowerCase(); });
    var col = {};
    CABECERA.forEach(function (n) { col[n] = cabecera.indexOf(n); });
    if (col.producto < 0 || col.fecha < 0 || col.precio < 0) throw new Error("Al CSV le faltan columnas: " + CABECERA.join(", ") + ".");
    var nuevo = copiar(estado), porClave = new Map(), precios = new Map();
    nuevo.productos.forEach(function (p) { porClave.set(clave(p.nombre, p.unidad), p); });
    nuevo.precios.forEach(function (p) { precios.set(p.productoId + "|" + p.fecha, p); });
    var resumen = { productos: 0, precios: 0, descartados: 0 };
    filas.slice(1).forEach(function (f) {
      function dato(n) { return col[n] >= 0 && f[col[n]] !== undefined ? f[col[n]].trim() : ""; }
      var nombre = texto(dato("producto").replace(/^'(?='*[=+\-@])/, ""), 60);
      var unidad = texto(dato("unidad").replace(/^'(?='*[=+\-@])/, ""), 30) || "unidad";
      var fechaTxt = dato("fecha"), precioTxt = dato("precio");
      var sinPrecio = !fechaTxt && !precioTxt;
      var fecha = fechaDeCSV(fechaTxt), precio = parsearNumero(precioTxt);
      if (!nombre || (!sinPrecio && (!fecha || precio === null || precio <= 0 || precio > 1e12))) { resumen.descartados++; return; }
      var p = porClave.get(clave(nombre, unidad));
      if (!p) {
        var cantidad = parsearNumero(dato("cantidad_mensual"));
        p = { id: nuevoId(nuevo), nombre: nombre, unidad: unidad, cantidad: cantidad !== null && cantidad >= 0 && cantidad <= 1e6 ? cantidad : 0 };
        nuevo.productos.push(p); porClave.set(clave(nombre, unidad), p); resumen.productos++;
      }
      if (!sinPrecio) { precios.set(p.id + "|" + fecha, { productoId: p.id, fecha: fecha, precio: precio }); resumen.precios++; }
    });
    nuevo.precios = Array.from(precios.values());
    return { estado: nuevo, resumen: resumen };
  }

  /* ---------- datos de ejemplo (inventados) ---------- */

  function ejemplo(hoy) {
    var estado = estadoVacio();
    var lista = [
      ["Leche", "litro", 12, 1200, 0.022, 0],
      ["Yerba", "paquete 1 kg", 2, 3100, 0.021, 0.36],
      ["Pan", "kg", 6, 2400, 0.025, 0],
      ["Nafta", "litro", 80, 1150, 0.019, 0],
      ["Corte de pelo", "servicio", 1, 9000, 0.028, 0]
    ];
    var mesHoy = mesDe(hoy), dia = Number(hoy.slice(8, 10));
    lista.forEach(function (fila, n) {
      var r = agregarProducto(estado, { nombre: fila[0], unidad: fila[1], cantidad: fila[2] });
      estado = r.estado;
      for (var atras = 13; atras >= 0; atras--) {
        var mes = sumarMeses(mesHoy, -atras);
        var fecha = mes + "-" + dos(atras === 0 ? Math.max(1, dia - n) : 5 + n);
        var salto = atras <= 1 ? 1 + fila[5] * (atras === 1 ? 0.5 : 1) : 1;
        var precio = Math.round(fila[3] * Math.pow(1 + fila[4], 13 - atras) * salto / 10) * 10;
        estado = anotarPrecio(estado, r.producto.id, precio, fecha, hoy);
      }
    });
    for (var i = 13; i >= 1; i--) estado = anotarOficial(estado, sumarMeses(mesHoy, -i), [2.4, 2.1, 2.7][i % 3], "");
    return estado;
  }

  return {
    VERSION: VERSION, VIGENCIA_DIAS: VIGENCIA_DIAS,
    parsearNumero: parsearNumero, esFecha: esFecha, esMes: esMes, fechaLocal: fechaLocal, mesDe: mesDe,
    sumarMeses: sumarMeses, finDeMes: finDeMes, diasEntre: diasEntre, nombreMes: nombreMes,
    estadoVacio: estadoVacio, buscar: buscar, agregarProducto: agregarProducto, editarProducto: editarProducto,
    borrarProducto: borrarProducto, anotarPrecio: anotarPrecio, borrarPrecio: borrarPrecio,
    anotarOficial: anotarOficial, borrarOficial: borrarOficial,
    preciosDe: preciosDe, precioAl: precioAl, comparar: comparar, canasta: canasta, oficialDe: oficialDe,
    alertas: alertas, mesesDisponibles: mesesDisponibles, ultimoMesConDatos: ultimoMesConDatos,
    puntosGrafico: puntosGrafico, normalizar: normalizar,
    exportarJSON: exportarJSON, importarJSON: importarJSON, exportarCSV: exportarCSV, importarCSV: importarCSV,
    ejemplo: ejemplo
  };
});
