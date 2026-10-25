/* Dividir gastos — lógica pura, sin DOM.
   Se carga en el navegador (queda en window.Dividir) y en Node (module.exports),
   para que los tests corran con `node --test` sin ningún arreglo especial.

   Todos los importes son centavos enteros: no hay sumas de flotantes en ningún lado.
   El saldo de una persona es positivo si le deben y negativo si debe. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module && module.exports) module.exports = fabrica();
  else raiz.Dividir = fabrica();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = 1;
  const CLAVE = "dividir-gastos.v1";
  // Hasta 20 personas con saldo se busca el mínimo exacto (2^20 subconjuntos, unos
  // milisegundos). Con más, se usa el método goloso, que casi siempre empata.
  const MAX_EXACTO = 20;
  const MODOS = ["iguales", "partes", "porcentaje", "montos"];
  const NOMBRE_MODO = { iguales: "en partes iguales", partes: "por partes", porcentaje: "por porcentaje", montos: "por montos" };

  /* ---------------------------------------------------------- importes */
  // "12.345,50" (formato argentino), "12345.5" (teclado numérico) o "1.500" (miles).
  function aCentavos(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
    if (typeof valor !== "string") return NaN;
    let t = valor.trim().replace(/\s|\$/g, "");
    if (!t) return NaN;
    if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    else t = t.replace(",", ".");
    if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100);
  }

  function formatoPesos(centavos, conCentavos) {
    const signo = centavos < 0 ? "-" : "";
    const abs = Math.abs(Math.round(centavos));
    const enteros = Math.floor(abs / 100), resto = abs % 100;
    const miles = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const dec = conCentavos || resto ? "," + String(resto).padStart(2, "0") : "";
    return signo + "$ " + miles + dec;
  }

  // Porcentajes guardados en centésimas (3333 = 33,33 %), para que sumen 100 exacto.
  function aCentesimas(valor) {
    if (typeof valor === "number") return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
    const t = String(valor == null ? "" : valor).trim().replace("%", "").trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return Math.round(parseFloat(t) * 100);
  }
  const formatoPorcentaje = (c) => String(c / 100).replace(".", ",") + " %";

  /* ------------------------------------------------------------ fechas */
  const esFecha = (f) => typeof f === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(f);
  function fechaActual(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const fechaCorta = (f) => (esFecha(f) ? f.slice(8, 10) + "/" + f.slice(5, 7) + "/" + f.slice(0, 4) : "");

  /* ----------------------------------------------------------- reparto */
  /* Reparte `total` centavos en proporción a `pesos` (enteros o decimales no negativos)
     por el método del resto mayor: cada uno recibe la parte entera de lo que le toca y
     los centavos que sobran van a los de mayor resto; si empatan, al primero de la
     lista. Siempre suma exactamente `total`. */
  function repartir(total, pesos) {
    const suma = pesos.reduce((a, p) => a + p, 0);
    if (!(suma > 0)) return pesos.map(() => 0);
    // Con enteros se trabaja exacto (BigInt no hace falta: total * peso entra holgado en 2^53).
    const enteros = pesos.every(Number.isInteger) && Number.isInteger(suma);
    const partes = pesos.map((p) => {
      const exacto = enteros ? (total * p) / suma : total * (p / suma);
      const base = Math.floor(exacto);
      return { base, resto: enteros ? (total * p) % suma : exacto - base };
    });
    let falta = total - partes.reduce((a, p) => a + p.base, 0);
    const orden = partes.map((p, i) => i).sort((a, b) => partes[b].resto - partes[a].resto || a - b);
    for (let k = 0; falta > 0; k = (k + 1) % orden.length, falta--) partes[orden[k]].base++;
    return partes.map((p) => p.base);
  }

  /* Cuánto le toca a cada persona de un gasto: { ok, partes: {id: centavos}, error }.
     gasto.reparto es {id: valor}, y el valor depende del modo:
       iguales     true para los que entran
       partes      cuántas partes (2 para una pareja, 0,5 para un chico)
       porcentaje  centésimas de porcentaje; tienen que sumar 10000
       montos      centavos; tienen que sumar el monto del gasto */
  function partesDeGasto(gasto, ordenPersonas) {
    const reparto = gasto.reparto || {};
    const ids = (ordenPersonas || Object.keys(reparto)).filter((id) => {
      const v = reparto[id];
      return gasto.modo === "iguales" ? v === true : typeof v === "number" && v > 0;
    });
    const total = gasto.monto;
    if (!(Number.isInteger(total) && total > 0)) return { ok: false, error: "El monto tiene que ser mayor a cero.", partes: {} };
    if (!ids.length) return { ok: false, error: "Elegí al menos una persona entre quienes se divide.", partes: {} };
    let valores;
    if (gasto.modo === "iguales") valores = repartir(total, ids.map(() => 1));
    else if (gasto.modo === "partes") valores = repartir(total, ids.map((id) => Math.round(reparto[id] * 1000)));
    else if (gasto.modo === "porcentaje") {
      const suma = ids.reduce((a, id) => a + reparto[id], 0);
      if (suma !== 10000) {
        const dif = 10000 - suma;
        return { ok: false, partes: {}, error: "Los porcentajes suman " + formatoPorcentaje(suma) + ": " +
          (dif > 0 ? "falta " : "sobra ") + formatoPorcentaje(Math.abs(dif)) + "." };
      }
      valores = repartir(total, ids.map((id) => reparto[id]));
    } else if (gasto.modo === "montos") {
      valores = ids.map((id) => reparto[id]);
      const suma = valores.reduce((a, v) => a + v, 0);
      if (suma !== total) {
        const dif = total - suma;
        return { ok: false, partes: {}, error: "Los montos suman " + formatoPesos(suma) + ": " +
          (dif > 0 ? "faltan " : "sobran ") + formatoPesos(Math.abs(dif)) + "." };
      }
    } else return { ok: false, error: "Modo de reparto desconocido.", partes: {} };
    const partes = {};
    ids.forEach((id, i) => { partes[id] = valores[i]; });
    return { ok: true, partes };
  }

  /* ------------------------------------------------------------ saldos */
  /* Por persona: lo que pagó, lo que consumió, lo que ya transfirió y recibió, y el saldo
     (pagado - consumido + enviado - recibido). Los gastos inválidos no cuentan. */
  function saldos(evento) {
    const orden = evento.personas.map((p) => p.id);
    const fila = {};
    evento.personas.forEach((p) => { fila[p.id] = { id: p.id, nombre: p.nombre, pagado: 0, consumido: 0, enviado: 0, recibido: 0, saldo: 0 }; });
    let total = 0, invalidos = 0;
    evento.gastos.forEach((g) => {
      const r = partesDeGasto(g, orden);
      if (!r.ok || !fila[g.pagador]) { invalidos++; return; }
      total += g.monto;
      fila[g.pagador].pagado += g.monto;
      Object.keys(r.partes).forEach((id) => { fila[id].consumido += r.partes[id]; });
    });
    (evento.pagos || []).forEach((p) => {
      if (!fila[p.de] || !fila[p.a]) return;
      fila[p.de].enviado += p.monto;
      fila[p.a].recibido += p.monto;
    });
    const lista = orden.map((id) => {
      const f = fila[id];
      f.saldo = f.pagado - f.consumido + f.enviado - f.recibido;
      return f;
    });
    return { lista, total, invalidos };
  }

  /* Lleva cada saldo a pesos enteros sin romper que sumen cero: se baja cada uno al peso
     y los pesos que faltan van a los de mayor resto (empate: el primero). Nadie se mueve
     un peso o más de lo exacto. Devuelve [{id, saldo, exacto}]. */
  function redondearAPesos(lista) {
    const filas = lista.map((f, i) => {
      const base = Math.floor(f.saldo / 100) * 100;
      return { i, id: f.id, exacto: f.saldo, saldo: base, resto: f.saldo - base };
    });
    let faltan = -filas.reduce((a, f) => a + f.saldo, 0) / 100;
    const orden = filas.slice().sort((a, b) => b.resto - a.resto || a.i - b.i);
    for (let k = 0; k < faltan; k++) orden[k].saldo += 100;
    return filas.map((f) => ({ id: f.id, saldo: f.saldo, exacto: f.exacto }));
  }

  /* Dentro de un grupo que suma cero: el que más debe le paga al que más le deben, hasta
     que no queda nadie. Cada paso deja en cero al menos a uno y el último a dos, así que
     un grupo de k personas se salda con k - 1 transferencias como mucho. */
  function goloso(grupo) {
    const deudores = grupo.filter((f) => f.saldo < 0).map((f) => ({ id: f.id, i: f.i, resta: -f.saldo }));
    const acreedores = grupo.filter((f) => f.saldo > 0).map((f) => ({ id: f.id, i: f.i, resta: f.saldo }));
    const mayor = (a, b) => b.resta - a.resta || a.i - b.i;
    const salida = [];
    for (;;) {
      deudores.sort(mayor); acreedores.sort(mayor);
      const d = deudores[0], a = acreedores[0];
      if (!d || !a || d.resta === 0 || a.resta === 0) break;
      const monto = Math.min(d.resta, a.resta);
      salida.push({ de: d.id, a: a.id, monto });
      d.resta -= monto; a.resta -= monto;
    }
    return salida;
  }

  /* La menor cantidad de transferencias que dejan a todos a mano.
     Con n personas con saldo, si se pueden partir en g grupos que suman cero cada uno,
     alcanza con n - g transferencias, y no hay forma de hacerlo con menos. Así que el
     problema es encontrar la mayor cantidad de grupos: se recorre cada subconjunto
     (programación dinámica sobre máscaras de bits), se reconstruye un orden de las
     personas en el que los grupos quedan seguidos, y cada grupo se salda con el goloso.
     Entrada: [{id, saldo}] que suma cero. Salida: [{de, a, monto}]. */
  function transferencias(lista) {
    const conSaldo = lista.map((f, i) => ({ id: f.id, saldo: f.saldo, i })).filter((f) => f.saldo !== 0);
    const n = conSaldo.length;
    if (n === 0) return [];
    if (conSaldo.reduce((a, f) => a + f.saldo, 0) !== 0) throw new Error("Los saldos no suman cero.");
    if (n > MAX_EXACTO) return ordenar(goloso(conSaldo), lista);

    const total = 1 << n;
    const suma = new Float64Array(total);
    const grupos = new Int8Array(total);
    for (let m = 1; m < total; m++) {
      const bajo = m & -m;
      suma[m] = suma[m ^ bajo] + conSaldo[31 - Math.clz32(bajo)].saldo;
      let mejor = 0;
      for (let r = m; r; r &= r - 1) {
        const v = grupos[m ^ (r & -r)];
        if (v > mejor) mejor = v;
      }
      grupos[m] = mejor + (suma[m] === 0 ? 1 : 0);
    }
    // Reconstrucción: se van sacando personas de atrás para adelante, siempre por un
    // camino que conserva el máximo. Al dar vuelta la secuencia, cada vez que la suma
    // acumulada vuelve a cero se cierra un grupo.
    const secuencia = [];
    let m = total - 1;
    while (m) {
      const objetivo = grupos[m] - (suma[m] === 0 ? 1 : 0);
      let elegido = -1;
      for (let r = m; r; r &= r - 1) {
        const bit = r & -r;
        if (grupos[m ^ bit] === objetivo) { elegido = 31 - Math.clz32(bit); break; }
      }
      secuencia.push(conSaldo[elegido]);
      m ^= 1 << elegido;
    }
    secuencia.reverse();
    const salida = [];
    let grupo = [], acumulado = 0;
    secuencia.forEach((f) => {
      grupo.push(f); acumulado += f.saldo;
      if (acumulado === 0) { salida.push(...goloso(grupo)); grupo = []; }
    });
    return ordenar(salida, lista);
  }

  // Para leerlas: agrupadas por quién paga, en el orden de la lista de personas.
  function ordenar(salida, lista) {
    const pos = {};
    lista.forEach((f, i) => { pos[f.id] = i; });
    return salida.sort((x, y) => pos[x.de] - pos[y.de] || pos[x.a] - pos[y.a]);
  }

  /* Todo junto: saldos exactos, saldos para transferir (redondeados a pesos si
     evento.redondear) y la lista mínima de transferencias. */
  function liquidar(evento) {
    const s = saldos(evento);
    const redondear = evento.redondear !== false;
    const paraTransferir = redondear ? redondearAPesos(s.lista) : s.lista.map((f) => ({ id: f.id, saldo: f.saldo, exacto: f.saldo }));
    const ajustados = paraTransferir.filter((f) => f.saldo !== f.exacto);
    return {
      saldos: s.lista, total: s.total, invalidos: s.invalidos, redondear,
      transferencias: transferencias(paraTransferir),
      // Lo que cada uno gana o pierde por el redondeo (siempre menos de un peso).
      redondeo: ajustados.map((f) => ({ id: f.id, diferencia: f.exacto - f.saldo })),
    };
  }

  /* ------------------------------------------------------------ eventos */
  function nuevoId(prefijo) {
    return (prefijo || "x") + Date.now().toString(36) + Math.floor(Math.random() * 1e8).toString(36);
  }
  const limpiar = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max || 80);

  function nuevoEvento(nombre, fecha) {
    return { id: nuevoId("e"), nombre: limpiar(nombre) || "Evento sin nombre", fecha: esFecha(fecha) ? fecha : fechaActual(),
      personas: [], gastos: [], pagos: [], redondear: true, creado: Date.now() };
  }

  function normalizarPersona(entrada, evento, idActual) {
    const nombre = limpiar(entrada.nombre, 40);
    if (!nombre) return { ok: false, error: "Poné un nombre." };
    const repetido = evento.personas.some((p) => p.id !== idActual && p.nombre.toLowerCase() === nombre.toLowerCase());
    if (repetido) return { ok: false, error: "Ya hay alguien que se llama " + nombre + "." };
    return { ok: true, persona: { id: idActual || nuevoId("p"), nombre, alias: limpiar(entrada.alias, 60) } };
  }

  // En cuántos gastos y pagos aparece una persona (no se la puede borrar si aparece).
  function usosDePersona(evento, id) {
    const gastos = evento.gastos.filter((g) => g.pagador === id || (id in (g.reparto || {}) && g.reparto[id] !== false && g.reparto[id] !== 0)).length;
    const pagos = (evento.pagos || []).filter((p) => p.de === id || p.a === id).length;
    return { gastos, pagos, total: gastos + pagos };
  }

  /* Valida un gasto como viene del formulario (textos) y lo deja guardable.
     Devuelve { ok, gasto, errores: {campo: mensaje}, partes }. */
  function normalizarGasto(entrada, evento) {
    const errores = {};
    const desc = limpiar(entrada.desc, 60);
    if (!desc) errores.desc = "¿En qué se gastó?";
    const monto = Number.isInteger(entrada.monto) ? entrada.monto : aCentavos(entrada.monto);
    if (!(monto > 0)) errores.monto = "El monto tiene que ser mayor a cero.";
    const fecha = esFecha(entrada.fecha) ? entrada.fecha : evento.fecha;
    const ids = evento.personas.map((p) => p.id);
    if (!ids.includes(entrada.pagador)) errores.pagador = "Elegí quién pagó.";
    const modo = MODOS.includes(entrada.modo) ? entrada.modo : "iguales";
    const reparto = {};
    let malos = 0;
    ids.forEach((id) => {
      const v = (entrada.reparto || {})[id];
      if (modo === "iguales") { if (v === true || v === "on" || v === 1) reparto[id] = true; return; }
      if (v === undefined || v === null || v === "" || v === false) return;
      let n;
      if (modo === "montos") n = Number.isInteger(v) ? v : aCentavos(v);
      else if (modo === "porcentaje") n = Number.isInteger(v) ? v : aCentesimas(v);
      else n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
      if (!Number.isFinite(n) || n < 0) { malos++; return; }
      if (n > 0) reparto[id] = modo === "partes" ? Math.round(n * 1000) / 1000 : n;
    });
    const gasto = { id: entrada.id || nuevoId("g"), desc, monto: monto > 0 ? monto : 0, fecha, pagador: entrada.pagador, modo, reparto };
    let partes = {};
    if (malos) errores.reparto = "Hay valores que no son números.";
    else if (monto > 0) {
      const r = partesDeGasto(gasto, ids);
      if (r.ok) partes = r.partes;
      else errores.reparto = r.error;
    }
    return { ok: Object.keys(errores).length === 0, gasto, errores, partes };
  }

  /* ------------------------------------------------------------ resumen */
  // "entre todos", "todos menos Sofi" o "entre Ana, Juan".
  function entreQuienes(evento, g) {
    const r = partesDeGasto(g, evento.personas.map((p) => p.id));
    const dentro = evento.personas.filter((p) => p.id in r.partes).map((p) => p.nombre);
    const fuera = evento.personas.filter((p) => !(p.id in r.partes)).map((p) => p.nombre);
    if (!dentro.length) return "sin repartir";
    if (!fuera.length) return dentro.length === 1 ? "solo " + dentro[0] : "entre todos";
    if (dentro.length === 1) return "solo " + dentro[0];
    if (fuera.length <= 2 && fuera.length < dentro.length) return "todos menos " + fuera.join(" y ");
    return "entre " + dentro.slice(0, -1).join(", ") + " y " + dentro[dentro.length - 1];
  }

  // Texto para pegar en WhatsApp (los *asteriscos* salen en negrita).
  function resumenTexto(evento) {
    const L = liquidar(evento);
    const nombre = {}; const alias = {};
    evento.personas.forEach((p) => { nombre[p.id] = p.nombre; alias[p.id] = p.alias; });
    const lineas = ["*" + evento.nombre + "*" + (evento.fecha ? " (" + fechaCorta(evento.fecha) + ")" : "")];
    const validos = evento.gastos.filter((g) => partesDeGasto(g, evento.personas.map((p) => p.id)).ok && nombre[g.pagador]);
    lineas.push("Total: " + formatoPesos(L.total) + " entre " + evento.personas.length + (evento.personas.length === 1 ? " persona" : " personas"));
    if (validos.length) {
      lineas.push("", "*Gastos*");
      validos.forEach((g) => {
        lineas.push("• " + g.desc + ": " + formatoPesos(g.monto) + ", pagó " + nombre[g.pagador] + " (" + entreQuienes(evento, g) + (g.modo === "iguales" ? "" : ", " + NOMBRE_MODO[g.modo]) + ")");
      });
    }
    lineas.push("", "*Cuánto puso y cuánto le tocaba*");
    L.saldos.forEach((s) => {
      const estado = s.saldo > 0 ? "le deben " + formatoPesos(s.saldo) : s.saldo < 0 ? "debe " + formatoPesos(-s.saldo) : "está a mano";
      lineas.push("• " + s.nombre + ": puso " + formatoPesos(s.pagado) + ", le tocaba " + formatoPesos(s.consumido) + (s.enviado || s.recibido ? ", ya transfirió " + formatoPesos(s.enviado) + " y recibió " + formatoPesos(s.recibido) : "") + " → " + estado);
    });
    lineas.push("");
    if (!L.transferencias.length) lineas.push("*Están todos a mano.* 🙌");
    else {
      lineas.push("*Para quedar a mano* (" + L.transferencias.length + (L.transferencias.length === 1 ? " transferencia)" : " transferencias)"));
      L.transferencias.forEach((t) => {
        lineas.push("• " + nombre[t.de] + " → " + nombre[t.a] + ": " + formatoPesos(t.monto) + (alias[t.a] ? " (alias " + alias[t.a] + ")" : ""));
      });
      if (L.redondeo.length) lineas.push("_Redondeado a pesos enteros._");
    }
    return lineas.join("\n");
  }

  /* ------------------------------------------------------------ estado */
  const estadoInicial = () => ({ version: VERSION, eventos: [] });

  function normalizarEvento(e) {
    if (!e || typeof e !== "object" || !Array.isArray(e.personas) || !Array.isArray(e.gastos)) return null;
    const personas = [];
    const vistos = new Set();
    e.personas.forEach((p) => {
      if (!p || typeof p.id !== "string" || vistos.has(p.id) || !limpiar(p.nombre)) return;
      vistos.add(p.id);
      personas.push({ id: p.id, nombre: limpiar(p.nombre, 40), alias: limpiar(p.alias, 60) });
    });
    const gastos = e.gastos.filter((g) => g && typeof g.id === "string" && Number.isInteger(g.monto) && g.monto > 0 &&
      vistos.has(g.pagador) && MODOS.includes(g.modo) && g.reparto && typeof g.reparto === "object").map((g) => {
      const reparto = {};
      Object.keys(g.reparto).forEach((id) => { if (vistos.has(id)) reparto[id] = g.reparto[id]; });
      return { id: g.id, desc: limpiar(g.desc, 60) || "Gasto", monto: g.monto, fecha: esFecha(g.fecha) ? g.fecha : "", pagador: g.pagador, modo: g.modo, reparto };
    });
    const pagos = (Array.isArray(e.pagos) ? e.pagos : []).filter((p) => p && vistos.has(p.de) && vistos.has(p.a) && p.de !== p.a &&
      Number.isInteger(p.monto) && p.monto > 0).map((p) => ({ id: typeof p.id === "string" ? p.id : nuevoId("t"), de: p.de, a: p.a, monto: p.monto, fecha: esFecha(p.fecha) ? p.fecha : "" }));
    return { id: typeof e.id === "string" && e.id ? e.id : nuevoId("e"), nombre: limpiar(e.nombre) || "Evento sin nombre",
      fecha: esFecha(e.fecha) ? e.fecha : "", personas, gastos, pagos, redondear: e.redondear !== false,
      creado: Number.isFinite(e.creado) ? e.creado : Date.now() };
  }

  function migrar(dato) {
    if (!dato || typeof dato !== "object" || !Array.isArray(dato.eventos)) return estadoInicial();
    return { version: VERSION, eventos: dato.eventos.map(normalizarEvento).filter(Boolean) };
  }

  const eventoAJSON = (evento) => JSON.stringify({ app: "dividir-gastos", version: VERSION, evento }, null, 2);

  /* Lee un evento exportado. Si su id ya existe en `eventos`, se le da uno nuevo para
     no pisar el que está (se importa como copia). */
  function eventoDeJSON(texto, eventos) {
    let dato;
    try { dato = JSON.parse(texto); } catch (e) { return { ok: false, error: "El archivo no es un JSON válido." }; }
    const crudo = dato && dato.evento ? dato.evento : dato;
    const evento = normalizarEvento(crudo);
    if (!evento) return { ok: false, error: "El archivo no tiene un evento de Dividir gastos." };
    let copia = false;
    if ((eventos || []).some((e) => e.id === evento.id)) { evento.id = nuevoId("e"); copia = true; }
    return { ok: true, evento, copia };
  }

  const nombreArchivo = (evento) => "dividir-" + (evento.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "evento") + ".json";

  // Un asado de ejemplo para ver cómo funciona sin cargar nada.
  function ejemplo() {
    const ev = nuevoEvento("Asado del sábado (ejemplo)", fechaActual());
    const nombres = ["Nico", "Juan", "Ana", "Pedro", "Lu", "Sofi"];
    ev.personas = nombres.map((n, i) => ({ id: "p" + (i + 1), nombre: n, alias: i === 0 ? "nico.asado.mp" : "" }));
    const todos = {}; ev.personas.forEach((p) => { todos[p.id] = true; });
    const sinSofi = Object.assign({}, todos); delete sinSofi.p6;
    ev.gastos = [
      { id: "g1", desc: "Carne y achuras", monto: 30000_00, fecha: ev.fecha, pagador: "p1", modo: "iguales", reparto: todos },
      { id: "g2", desc: "Bebidas", monto: 12000_00, fecha: ev.fecha, pagador: "p2", modo: "iguales", reparto: sinSofi },
      { id: "g3", desc: "Carbón y pan", monto: 6000_00, fecha: ev.fecha, pagador: "p3", modo: "iguales", reparto: todos },
    ];
    return ev;
  }

  return {
    VERSION, CLAVE, MAX_EXACTO, MODOS, NOMBRE_MODO,
    aCentavos, formatoPesos, aCentesimas, formatoPorcentaje, esFecha, fechaActual, fechaCorta,
    repartir, partesDeGasto, saldos, redondearAPesos, transferencias, goloso, liquidar,
    nuevoId, nuevoEvento, normalizarPersona, usosDePersona, normalizarGasto, entreQuienes, resumenTexto,
    estadoInicial, normalizarEvento, migrar, eventoAJSON, eventoDeJSON, nombreArchivo, ejemplo,
  };
});
