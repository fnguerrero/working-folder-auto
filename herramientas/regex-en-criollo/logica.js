/* Regex en criollo — parser de expresiones regulares de .NET, explicación en castellano, traducción a JavaScript
   para probarlas en el navegador, avisos y snippet de C#. Sin dependencias; se usa desde la página y desde los tests. */
(function (raiz) {
  "use strict";

  class ErrorRegex extends Error { constructor(msg, pos) { super(msg); this.pos = pos; } }

  // ---------- parser ----------
  /** Opciones: { ignoreCase, multiline, singleline, ignoreWhitespace, explicitCapture, ecmaScript, cultureInvariant } */
  function parsear(patron, opciones) {
    const o = Object.assign({ ignoreCase: false, multiline: false, singleline: false, ignoreWhitespace: false, explicitCapture: false }, opciones);
    let i = 0; const n = patron.length;
    const grupos = []; // nodos de captura en orden de aparición
    const pila = []; // opciones x activas por nivel
    let xModo = o.ignoreWhitespace;
    const err = (m) => { throw new ErrorRegex(m, i); };
    const ver = (k) => patron[i + (k || 0)];

    function saltarBlanco() {
      if (!xModo) return;
      for (;;) {
        while (i < n && /[ \t\r\n\f\v]/.test(patron[i])) i++;
        if (patron[i] === "#") { while (i < n && patron[i] !== "\n") i++; continue; }
        break;
      }
    }
    function alternativa(fin) {
      const ramas = [secuencia(fin)];
      while (i < n && patron[i] === "|") { i++; ramas.push(secuencia(fin)); }
      return ramas.length === 1 ? ramas[0] : { tipo: "alt", ramas };
    }
    function secuencia(fin) {
      const items = [];
      for (;;) {
        saltarBlanco();
        if (i >= n) { if (fin) err("falta cerrar el grupo con )"); break; }
        const c = patron[i];
        if (c === ")") { if (!fin) err("hay un ) de más"); break; }
        if (c === "|") break;
        let atomo = atomoNodo();
        if (atomo === null) continue; // comentario
        saltarBlanco();
        atomo = cuantificador(atomo);
        items.push(atomo);
      }
      return items.length === 1 ? items[0] : { tipo: "seq", items };
    }
    function cuantificador(nodo) {
      for (;;) {
        const c = patron[i]; let min, max, raw;
        const inicio = i;
        if (c === "*") { min = 0; max = Infinity; i++; raw = "*"; }
        else if (c === "+") { min = 1; max = Infinity; i++; raw = "+"; }
        else if (c === "?") { min = 0; max = 1; i++; raw = "?"; }
        else if (c === "{") {
          const m = /^\{(\d+)(,(\d*))?\}/.exec(patron.slice(i));
          if (!m) return nodo; // una llave suelta es literal en .NET
          min = +m[1]; max = m[2] == null ? min : m[3] === "" ? Infinity : +m[3]; i += m[0].length; raw = m[0];
          if (max < min) err("el cuantificador " + raw + " tiene el máximo menor que el mínimo");
        } else return nodo;
        if (nodo.tipo === "cuant") err("hay dos cuantificadores seguidos (" + nodo.raw + raw + "); si querías vago, es " + nodo.raw + "?");
        if (nodo.tipo === "ancla" || (nodo.tipo === "esc" && /^[bBAZzG]$/.test(nodo.clave))) err("no se puede repetir una ancla (" + raw + " después de " + nodo.raw + ")");
        let lazy = false;
        if (patron[i] === "?") { lazy = true; i++; raw += "?"; }
        nodo = { tipo: "cuant", min, max, lazy, hijo: nodo, raw, pos: inicio };
      }
    }
    function atomoNodo() {
      const c = patron[i]; const pos = i;
      if (c === "(") return grupo();
      if (c === "[") return clase();
      if (c === ".") { i++; return { tipo: "punto", raw: ".", pos }; }
      if (c === "^") { i++; return { tipo: "ancla", clave: "^", raw: "^", pos }; }
      if (c === "$") { i++; return { tipo: "ancla", clave: "$", raw: "$", pos }; }
      if (c === "\\") return escape(false);
      if (c === "*" || c === "+" || c === "?") err("el cuantificador " + c + " no tiene nada adelante que repetir");
      if (c === "{" && /^\{\d+(,\d*)?\}/.test(patron.slice(i))) err("el cuantificador " + /^\{\d+(,\d*)?\}/.exec(patron.slice(i))[0] + " no tiene nada adelante que repetir");
      i++; return { tipo: "lit", valor: c, raw: c, pos };
    }
    function grupo() {
      const pos = i; i++; // (
      let nodo;
      const xAntes = xModo;
      if (patron[i] === "?") {
        i++;
        const c = patron[i];
        if (c === ":") { i++; nodo = { tipo: "grupo", clase: "nocaptura", pos }; }
        else if (c === ">") { i++; nodo = { tipo: "grupo", clase: "atomico", pos }; }
        else if (c === "=") { i++; nodo = { tipo: "grupo", clase: "lookahead", pos }; }
        else if (c === "!") { i++; nodo = { tipo: "grupo", clase: "neglookahead", pos }; }
        else if (c === "#") { while (i < n && patron[i] !== ")") i++; if (i >= n) err("falta cerrar el comentario (?#...)"); i++; return null; }
        else if (c === "<" || c === "'") {
          if (c === "<" && patron[i + 1] === "=") { i += 2; nodo = { tipo: "grupo", clase: "lookbehind", pos }; }
          else if (c === "<" && patron[i + 1] === "!") { i += 2; nodo = { tipo: "grupo", clase: "neglookbehind", pos }; }
          else {
            const cierre = c === "<" ? ">" : "'"; i++;
            const m = new RegExp("^([A-Za-z_][A-Za-z0-9_]*|\\d+)?(?:-([A-Za-z_][A-Za-z0-9_]*|\\d+))?\\" + cierre).exec(patron.slice(i));
            if (!m || (!m[1] && !m[2])) err("nombre de grupo inválido después de (?" + c);
            i += m[0].length;
            if (m[2]) nodo = { tipo: "grupo", clase: "balanceo", nombre: m[1] || null, nombre2: m[2], pos };
            else nodo = { tipo: "grupo", clase: "captura", nombre: m[1], pos };
          }
        } else if (c === "(") {
          i++;
          const m = /^([A-Za-z_][A-Za-z0-9_]*|\d+)\)/.exec(patron.slice(i));
          let cond;
          if (m) { i += m[0].length; cond = { tipo: "grupoRef", ref: m[1] }; }
          else { const expr = alternativa(true); if (patron[i] !== ")") err("falta cerrar la condición"); i++; cond = { tipo: "expr", nodo: expr }; }
          const cuerpo = alternativa(true);
          if (patron[i] !== ")") err("falta cerrar el grupo condicional"); i++;
          let si = cuerpo, no = null;
          if (cuerpo.tipo === "alt") { if (cuerpo.ramas.length > 2) err("un condicional admite solo sí|no"); si = cuerpo.ramas[0]; no = cuerpo.ramas[1]; }
          return { tipo: "cond", condicion: cond, si, no, pos, raw: patron.slice(pos, i) };
        } else {
          // opciones inline (?imsnx-imsnx) o (?imsnx-imsnx:...)
          const m = /^([imsnx]*)(?:-([imsnx]*))?([:)])/.exec(patron.slice(i));
          if (!m || (m[1] === "" && m[2] == null)) err("no entiendo el grupo que empieza en (?" + (c || ""));
          i += m[0].length;
          const on = m[1].split("").filter(Boolean), off = (m[2] || "").split("").filter(Boolean);
          if (m[3] === ")") {
            if (on.includes("x")) xModo = true; if (off.includes("x")) xModo = false;
            return { tipo: "opciones", on, off, pos, raw: patron.slice(pos, i) };
          }
          nodo = { tipo: "grupo", clase: "opciones", on, off, pos };
          if (on.includes("x")) xModo = true; if (off.includes("x")) xModo = false;
        }
      } else nodo = { tipo: "grupo", clase: o.explicitCapture ? "nocaptura" : "captura", nombre: null, pos };
      if (nodo.clase === "captura" || nodo.clase === "balanceo") grupos.push(nodo);
      nodo.cuerpo = alternativa(true);
      if (patron[i] !== ")") err("falta cerrar el grupo con )");
      i++;
      xModo = xAntes;
      nodo.raw = patron.slice(pos, i);
      return nodo;
    }
    function clase() {
      const pos = i; i++; // [
      const nodo = { tipo: "clase", negada: false, items: [], pos };
      if (patron[i] === "^") { nodo.negada = true; i++; }
      let primero = true;
      for (;;) {
        if (i >= n) err("falta cerrar la clase con ]");
        let c = patron[i];
        if (c === "]" && !primero) { i++; break; }
        primero = false;
        // resta de clases: [a-z-[aeiou]]
        if (c === "-" && patron[i + 1] === "[" && nodo.items.length) { i++; const resta = clase(); nodo.resta = resta; if (patron[i] !== "]") err("después de una resta de clases tiene que venir ]"); i++; break; }
        let item;
        if (c === "\\") item = escape(true); else { i++; item = { tipo: "char", valor: c }; }
        // rango
        if (patron[i] === "-" && patron[i + 1] !== "]" && patron[i + 1] !== undefined && item.tipo === "char" && !(patron[i + 1] === "[" )) {
          i++;
          let hasta;
          if (patron[i] === "\\") hasta = escape(true); else { hasta = { tipo: "char", valor: patron[i] }; i++; }
          if (hasta.tipo !== "char") err("un rango tiene que terminar en un carácter, no en " + hasta.raw);
          if (hasta.valor.codePointAt(0) < item.valor.codePointAt(0)) err("el rango " + item.valor + "-" + hasta.valor + " está al revés");
          item = { tipo: "rango", de: item.valor, a: hasta.valor };
        }
        nodo.items.push(item);
      }
      nodo.raw = patron.slice(pos, i);
      return nodo;
    }
    function escape(enClase) {
      const pos = i; i++; // \
      if (i >= n) err("la expresión termina en una barra invertida");
      const c = patron[i]; i++;
      const raw = () => patron.slice(pos, i);
      const simple = { t: "\t", n: "\n", r: "\r", f: "\f", v: "\v", e: "\x1b", a: "\x07" };
      if (simple[c]) return { tipo: "char", valor: simple[c], raw: raw(), pos };
      if (enClase && c === "b") return { tipo: "char", valor: "\b", raw: raw(), pos };
      if ("dDwWsS".includes(c)) return { tipo: "esc", clave: c, raw: raw(), pos };
      if (!enClase && "bBAZzG".includes(c)) return { tipo: "esc", clave: c, raw: raw(), pos };
      if (c === "p" || c === "P") {
        const m = /^\{([A-Za-z][A-Za-z0-9_]*)\}/.exec(patron.slice(i)); if (!m) err("\\" + c + " tiene que ir seguido de {Nombre}, por ejemplo \\p{L}");
        i += m[0].length; return { tipo: "prop", nombre: m[1], negada: c === "P", raw: raw(), pos };
      }
      if (c === "x") { const m = /^[0-9A-Fa-f]{2}/.exec(patron.slice(i)); if (!m) err("\\x necesita dos dígitos hexadecimales"); i += 2; return { tipo: "char", valor: String.fromCharCode(parseInt(m[0], 16)), raw: raw(), pos }; }
      if (c === "u") { const m = /^[0-9A-Fa-f]{4}/.exec(patron.slice(i)); if (!m) err("\\u necesita cuatro dígitos hexadecimales"); i += 4; return { tipo: "char", valor: String.fromCharCode(parseInt(m[0], 16)), raw: raw(), pos }; }
      if (c === "c") { const l = patron[i]; if (!l || !/[A-Za-z]/.test(l)) err("\\c necesita una letra"); i++; return { tipo: "char", valor: String.fromCharCode(l.toUpperCase().charCodeAt(0) - 64), raw: raw(), pos }; }
      if (c === "0") { const m = /^[0-7]{0,2}/.exec(patron.slice(i)); i += m[0].length; return { tipo: "char", valor: String.fromCharCode(parseInt("0" + m[0], 8)), raw: raw(), pos }; }
      if (!enClase && c === "k") {
        const m = /^(?:<([A-Za-z_][A-Za-z0-9_]*|\d+)>|'([A-Za-z_][A-Za-z0-9_]*|\d+)')/.exec(patron.slice(i)); if (!m) err("\\k tiene que ir seguido de <nombre>");
        i += m[0].length; return { tipo: "backref", ref: m[1] || m[2], raw: raw(), pos };
      }
      if (!enClase && /[1-9]/.test(c)) { const m = /^\d*/.exec(patron.slice(i)); i += m[0].length; return { tipo: "backref", ref: c + m[0], raw: raw(), pos }; }
      if (/[A-Za-z0-9]/.test(c)) err("\\" + c + " no es un escape que .NET conozca");
      return { tipo: "char", valor: c, raw: raw(), pos, escapado: true };
    }

    const ast = alternativa(false);
    if (i < n) err("hay un ) de más");
    // numeración de .NET: primero los grupos sin nombre, después los con nombre (los repetidos comparten número)
    let num = 1; const porNombre = new Map();
    for (const g of grupos) if (!g.nombre || /^\d+$/.test(g.nombre)) { g.numero = g.nombre ? +g.nombre : num++; if (g.nombre) porNombre.set(g.nombre, g.numero); }
    for (const g of grupos) if (g.nombre && !/^\d+$/.test(g.nombre)) { if (!porNombre.has(g.nombre)) porNombre.set(g.nombre, num++); g.numero = porNombre.get(g.nombre); }
    const lista = [];
    for (const g of grupos) if (!lista.some((x) => x.numero === g.numero)) lista.push({ numero: g.numero, nombre: g.nombre && !/^\d+$/.test(g.nombre) ? g.nombre : null, nodo: g });
    lista.sort((a, b) => a.numero - b.numero);
    return { ast, grupos: lista, opciones: o };
  }

  // ---------- explicación ----------
  const NOMBRES_PROP = { L: "una letra", Lu: "una letra mayúscula", Ll: "una letra minúscula", N: "un número", Nd: "un dígito decimal", P: "un signo de puntuación", S: "un símbolo", Z: "un separador", Zs: "un espacio", M: "una marca (acento combinado)", C: "un carácter de control u otro", IsCyrillic: "un carácter cirílico", IsGreek: "un carácter griego", IsBasicLatin: "un carácter ASCII", IsLatin1Supplement: "un carácter latín-1" };
  function describirEsc(clave, o, enClase) {
    switch (clave) {
      case "d": return "un dígito" + (o.ecmaScript ? " (0-9)" : " (\\d: en .NET es cualquier dígito Unicode, no solo 0-9)");
      case "D": return "cualquier cosa que no sea un dígito";
      case "w": return "un carácter de palabra (letra, dígito o guion bajo)";
      case "W": return "cualquier cosa que no sea letra, dígito ni guion bajo";
      case "s": return "un espacio en blanco (espacio, tab, salto de línea…)";
      case "S": return "cualquier cosa que no sea un espacio en blanco";
      case "b": return "un límite de palabra (entre una letra/dígito y algo que no lo es)";
      case "B": return "un punto que no es límite de palabra";
      case "A": return "el inicio del texto (siempre, aunque haya Multiline)";
      case "Z": return "el fin del texto, o justo antes de un salto de línea final";
      case "z": return "el fin del texto, de verdad (sin permitir un salto de línea final)";
      case "G": return "donde terminó el match anterior (para Matches en cadena)";
    }
    return clave;
  }
  function mostrarChar(ch) {
    const nombres = { "\n": "salto de línea (\\n)", "\r": "retorno de carro (\\r)", "\t": "tab (\\t)", " ": "espacio", "\f": "salto de página", "\v": "tab vertical", "\b": "retroceso (\\b)", "\x1b": "escape (\\e)", "\x07": "campana (\\a)", "\0": "nulo (\\0)" };
    if (nombres[ch]) return nombres[ch];
    const cp = ch.codePointAt(0);
    if (cp < 32) return "control U+" + cp.toString(16).toUpperCase().padStart(4, "0");
    return "«" + ch + "»";
  }
  function describirClaseItem(it, o) {
    if (it.tipo === "char") return mostrarChar(it.valor);
    if (it.tipo === "rango") return "de " + mostrarChar(it.de) + " a " + mostrarChar(it.a);
    if (it.tipo === "esc") return describirEsc(it.clave, o, true);
    if (it.tipo === "prop") return (it.negada ? "cualquier cosa que no sea " : "") + (NOMBRES_PROP[it.nombre] || "un carácter de la categoría " + it.nombre);
    return it.raw || "?";
  }
  function cuantTexto(q) {
    let t;
    if (q.min === 0 && q.max === Infinity) t = "cero o más veces";
    else if (q.min === 1 && q.max === Infinity) t = "una o más veces";
    else if (q.min === 0 && q.max === 1) t = "opcional (cero o una vez)";
    else if (q.max === Infinity) t = q.min + " o más veces";
    else if (q.min === q.max) t = "exactamente " + q.min + (q.min === 1 ? " vez" : " veces");
    else t = "entre " + q.min + " y " + q.max + " veces";
    if (q.lazy) t += ", lo menos posible (vago)";
    else if (q.max > 1) t += ", lo más posible (goloso)";
    return t;
  }
  /** Devuelve un árbol { texto, raw, hijos[] } para pintar como lista anidada. */
  function explicar(parseado) {
    const o = parseado.opciones;
    function nodo(nd) {
      switch (nd.tipo) {
        case "alt": return { texto: "una de estas alternativas (se prueban en orden)", raw: "|", hijos: nd.ramas.map((r) => ({ texto: "o bien:", raw: "", hijos: [nodo(r)] })) };
        case "seq": {
          // juntar literales seguidos
          const hijos = []; let buf = "", rawBuf = "";
          const vaciar = () => { if (buf) { hijos.push({ texto: buf.length === 1 ? "el carácter " + mostrarChar(buf) : "el texto «" + buf + "»", raw: rawBuf, hijos: [] }); buf = ""; rawBuf = ""; } };
          for (const it of nd.items) { if (it.tipo === "lit" || (it.tipo === "char" && !/\s/.test(it.valor))) { buf += it.valor; rawBuf += it.raw; } else { vaciar(); hijos.push(nodo(it)); } }
          vaciar();
          return hijos.length === 1 ? hijos[0] : { texto: "en secuencia:", raw: "", hijos };
        }
        case "lit": case "char": return { texto: "el carácter " + mostrarChar(nd.valor), raw: nd.raw, hijos: [] };
        case "punto": return { texto: o.singleline ? "cualquier carácter (con Singleline, también el salto de línea)" : "cualquier carácter salvo el salto de línea", raw: ".", hijos: [] };
        case "esc": return { texto: describirEsc(nd.clave, o), raw: nd.raw, hijos: [] };
        case "prop": return { texto: (nd.negada ? "cualquier cosa que no sea " : "") + (NOMBRES_PROP[nd.nombre] || "un carácter de la categoría Unicode " + nd.nombre), raw: nd.raw, hijos: [] };
        case "ancla": return nd.clave === "^" ? { texto: o.multiline ? "el inicio de una línea (Multiline)" : "el inicio del texto", raw: "^", hijos: [] } : { texto: o.multiline ? "el fin de una línea (Multiline)" : "el fin del texto (o justo antes de un salto de línea final)", raw: "$", hijos: [] };
        case "clase": {
          const items = nd.items.map((it) => describirClaseItem(it, o));
          const r = { texto: (nd.negada ? "un carácter que NO sea ninguno de: " : "un carácter de: ") + items.join(", "), raw: nd.raw, hijos: [] };
          if (nd.resta) r.texto += "; menos los de: " + nd.resta.items.map((it) => describirClaseItem(it, o)).join(", ");
          return r;
        }
        case "grupo": {
          const cuerpo = nodo(nd.cuerpo);
          const t = {
            captura: "grupo " + (nd.nombre ? "«" + nd.nombre + "» (número " + nd.numero + ")" : nd.numero) + ": captura lo que matchea",
            nocaptura: "agrupa, sin capturar",
            atomico: "grupo atómico: una vez que matcheó no vuelve atrás a probar otra forma",
            lookahead: "seguido de (mira sin consumir)",
            neglookahead: "NO seguido de (mira sin consumir)",
            lookbehind: "precedido de (mira hacia atrás sin consumir)",
            neglookbehind: "NO precedido de (mira hacia atrás sin consumir)",
            balanceo: "grupo de balanceo «" + (nd.nombre || "") + "-" + nd.nombre2 + "»: saca una captura de «" + nd.nombre2 + "» (para contar aperturas y cierres)",
            opciones: "con opciones " + opcionesTexto(nd.on || [], nd.off || []) + ", solo acá adentro",
          }[nd.clase];
          return { texto: t, raw: nd.raw, hijos: [cuerpo] };
        }
        case "opciones": return { texto: "de acá en más, " + opcionesTexto(nd.on, nd.off), raw: nd.raw, hijos: [] };
        case "cond": return { texto: nd.condicion.tipo === "grupoRef" ? "si el grupo " + nd.condicion.ref + " capturó algo:" : "si lo que sigue matchea esto (sin consumir):", raw: nd.raw, hijos: [nd.condicion.tipo === "expr" ? nodo(nd.condicion.nodo) : null, { texto: "entonces:", raw: "", hijos: [nodo(nd.si)] }, nd.no ? { texto: "si no:", raw: "", hijos: [nodo(nd.no)] } : null].filter(Boolean) };
        case "backref": return { texto: "lo mismo que capturó el grupo " + nd.ref, raw: nd.raw, hijos: [] };
        case "cuant": { const h = nodo(nd.hijo); return { texto: cuantTexto(nd) + ":", raw: nd.raw, hijos: [h] }; }
      }
      return { texto: "?", raw: "", hijos: [] };
    }
    return nodo(parseado.ast);
  }
  function opcionesTexto(on, off) {
    const nombre = { i: "ignorar mayúsculas", m: "Multiline (^ y $ por línea)", s: "Singleline (el punto matchea \\n)", n: "solo capturan los grupos con nombre", x: "ignorar espacios y comentarios del patrón" };
    const partes = [];
    for (const c of on) partes.push(nombre[c]);
    for (const c of off) partes.push("dejar de " + nombre[c]);
    return partes.join(", ");
  }

  // ---------- traducción a JavaScript ----------
  const W_JS = "\\p{L}\\p{Mn}\\p{Nd}\\p{Pc}";
  function escaparFuera(ch) {
    if ("\\^$.|?*+()[]{}/".includes(ch)) return "\\" + ch;
    const cp = ch.codePointAt(0);
    if (cp < 32 || cp === 127) return "\\u{" + cp.toString(16) + "}";
    return ch;
  }
  function escaparDentro(ch) {
    if (/[!-/:-@[-`{-~]/.test(ch)) return "\\" + ch; // en modo v toda la puntuación ASCII se puede escapar
    const cp = ch.codePointAt(0);
    if (cp < 32 || cp === 127) return "\\u{" + cp.toString(16) + "}";
    return ch;
  }
  function propJs(nombre) {
    if (/^Is[A-Z]/.test(nombre)) return "\\p{Script=" + nombre.slice(2) + "}";
    return "\\p{" + nombre + "}";
  }
  /** Devuelve { fuente, flags, mapa: [{js, numero, nombre, oculto}], problemas: [] } o problemas con fuente null si no se puede. */
  function aJs(parseado) {
    const o = parseado.opciones; const problemas = []; const mapa = []; let jsIdx = 0; let atomicos = 0;
    const flagsIni = { i: o.ignoreCase, m: o.multiline, s: o.singleline };
    // ¿opciones inline al principio? se vuelven flags
    const primer = parseado.ast.tipo === "seq" ? parseado.ast.items[0] : parseado.ast;
    let saltarPrimero = false;
    if (primer && primer.tipo === "opciones" && primer === (parseado.ast.tipo === "seq" ? parseado.ast.items[0] : parseado.ast)) {
      for (const c of primer.on) if (c in flagsIni) flagsIni[c] = true; for (const c of primer.off) if (c in flagsIni) flagsIni[c] = false; saltarPrimero = true;
    }
    function asignar(nd) { // primer paso: índices de los grupos en el orden en que van a salir
      if (!nd || typeof nd !== "object") return;
      if (nd.tipo === "grupo") { if (nd.clase === "atomico") { jsIdx++; nd.jsAtomico = jsIdx; mapa.push({ js: jsIdx, oculto: true }); } if (nd.clase === "captura") { jsIdx++; nd.js = jsIdx; mapa.push({ js: jsIdx, numero: nd.numero, nombre: nd.nombre }); } asignar(nd.cuerpo); return; }
      if (nd.tipo === "alt") nd.ramas.forEach(asignar); else if (nd.tipo === "seq") nd.items.forEach(asignar); else if (nd.tipo === "cuant") asignar(nd.hijo); else if (nd.tipo === "cond") { if (nd.condicion.tipo === "expr") asignar(nd.condicion.nodo); asignar(nd.si); asignar(nd.no); }
    }
    asignar(parseado.ast);
    const dot = flagsIni.s;
    function ser(nd, ctx) {
      switch (nd.tipo) {
        case "alt": return nd.ramas.map((r) => ser(r, ctx)).join("|");
        case "seq": {
          let out = ""; const items = nd.items.slice(ctx.raiz && saltarPrimero ? 1 : 0);
          for (let k = 0; k < items.length; k++) {
            const it = items[k];
            if (it.tipo === "opciones") { // el resto de la secuencia con esas opciones
              const resto = items.slice(k + 1); const on = it.on.filter((c) => "ims".includes(c)).join(""), off = it.off.filter((c) => "ims".includes(c)).join("");
              if (!on && !off) continue;
              problemas.push({ nivel: "info", texto: "Las opciones inline " + it.raw + " en el medio del patrón se traducen a modificadores de JavaScript, que necesitan un navegador reciente (Chrome 125+)." });
              out += "(?" + on + (off ? "-" + off : "") + ":" + ser({ tipo: "seq", items: resto }, Object.assign({}, ctx, { raiz: false })) + ")";
              return out;
            }
            out += ser(it, Object.assign({}, ctx, { raiz: false }));
          }
          return out;
        }
        case "lit": case "char": return escaparFuera(nd.valor);
        case "punto": return dot ? "[^]" : "[^\\n]";
        case "esc": switch (nd.clave) {
          case "d": return o.ecmaScript ? "[0-9]" : "\\p{Nd}"; case "D": return o.ecmaScript ? "[^0-9]" : "\\P{Nd}";
          case "w": return o.ecmaScript ? "[A-Za-z0-9_]" : "[" + W_JS + "]"; case "W": return o.ecmaScript ? "[^A-Za-z0-9_]" : "[^" + W_JS + "]";
          case "s": return "[\\f\\n\\r\\t\\v\\x85\\p{Z}]"; case "S": return "[^\\f\\n\\r\\t\\v\\x85\\p{Z}]";
          case "b": return "(?:(?<=[" + W_JS + "])(?![" + W_JS + "])|(?<![" + W_JS + "])(?=[" + W_JS + "]))";
          case "B": return "(?:(?<=[" + W_JS + "])(?=[" + W_JS + "])|(?<![" + W_JS + "])(?![" + W_JS + "]))";
          case "A": return "(?<![^])"; case "z": return "(?![^])"; case "Z": return "(?=\\n?(?![^]))";
          case "G": problemas.push({ nivel: "no", texto: "\\G (donde terminó el match anterior) no existe en JavaScript: no se puede probar acá." }); return "";
        } return "";
        case "prop": return (nd.negada ? propJs(nd.nombre).replace("\\p", "\\P") : propJs(nd.nombre));
        case "ancla": return nd.clave === "^" ? (flagsIni.m ? "(?<![^\\n])" : "(?<![^])") : (flagsIni.m ? "(?=\\n|(?![^]))" : "(?=\\n?(?![^]))");
        case "clase": {
          const dentro = (it) => {
            if (it.tipo === "char") return escaparDentro(it.valor);
            if (it.tipo === "rango") return escaparDentro(it.de) + "-" + escaparDentro(it.a);
            if (it.tipo === "esc") return { d: "\\p{Nd}", D: "\\P{Nd}", w: "[" + W_JS + "]", W: "[^" + W_JS + "]", s: "[\\f\\n\\r\\t\\v\\x85\\p{Z}]", S: "[^\\f\\n\\r\\t\\v\\x85\\p{Z}]" }[it.clave];
            if (it.tipo === "prop") return it.negada ? propJs(it.nombre).replace("\\p", "\\P") : propJs(it.nombre);
            return "";
          };
          const s = "[" + (nd.negada ? "^" : "") + nd.items.map(dentro).join("") + "]";
          if (nd.resta) return "[" + s + "--" + ser(nd.resta, ctx) + "]"; // resta de clases: en JavaScript (modo v) los operandos van entre corchetes
          return s;
        }
        case "grupo": {
          const cuerpo = ser(nd.cuerpo, Object.assign({}, ctx, { raiz: false }));
          switch (nd.clase) {
            case "captura": return nd.nombre ? "(?<" + nd.nombre + ">" + cuerpo + ")" : "(" + cuerpo + ")";
            case "nocaptura": return "(?:" + cuerpo + ")";
            case "atomico": atomicos++; return "(?=(?<_at" + nd.jsAtomico + ">" + cuerpo + "))\\k<_at" + nd.jsAtomico + ">";
            case "lookahead": return "(?=" + cuerpo + ")"; case "neglookahead": return "(?!" + cuerpo + ")";
            case "lookbehind": return "(?<=" + cuerpo + ")"; case "neglookbehind": return "(?<!" + cuerpo + ")";
            case "balanceo": problemas.push({ nivel: "no", texto: "Los grupos de balanceo " + nd.raw.slice(0, 12) + "… son de .NET nomás: no se pueden probar acá." }); return "(?:" + cuerpo + ")";
            case "opciones": { const on = nd.on.filter((c) => "ims".includes(c)).join(""), off = nd.off.filter((c) => "ims".includes(c)).join(""); if (!on && !off) return "(?:" + cuerpo + ")"; problemas.push({ nivel: "info", texto: "El grupo con opciones " + nd.raw.slice(0, nd.raw.indexOf(":") + 1) + "…) se traduce a modificadores de JavaScript, que necesitan un navegador reciente (Chrome 125+)." }); return "(?" + on + (off ? "-" + off : "") + ":" + cuerpo + ")"; }
          }
          return "";
        }
        case "opciones": return "";
        case "cond": problemas.push({ nivel: "no", texto: "Los grupos condicionales (?(…)sí|no) no existen en JavaScript: no se pueden probar acá." }); return "(?:" + ser(nd.si, ctx) + (nd.no ? "|" + ser(nd.no, ctx) : "") + ")";
        case "backref": {
          const g = parseado.grupos.find((x) => String(x.numero) === nd.ref || x.nombre === nd.ref);
          if (!g) { problemas.push({ nivel: "no", texto: "La referencia " + nd.raw + " apunta a un grupo que no existe." }); return ""; }
          return g.nombre ? "\\k<" + g.nombre + ">" : "\\" + g.nodo.js;
        }
        case "cuant": {
          let q = nd.min === 0 && nd.max === Infinity ? "*" : nd.min === 1 && nd.max === Infinity ? "+" : nd.min === 0 && nd.max === 1 ? "?" : nd.max === Infinity ? "{" + nd.min + ",}" : nd.min === nd.max ? "{" + nd.min + "}" : "{" + nd.min + "," + nd.max + "}";
          if (nd.lazy) q += "?";
          const h = ser(nd.hijo, Object.assign({}, ctx, { raiz: false }));
          const simple = nd.hijo.tipo === "lit" || nd.hijo.tipo === "char" || nd.hijo.tipo === "clase" || nd.hijo.tipo === "grupo" && nd.hijo.clase !== "atomico" || nd.hijo.tipo === "prop";
          return (simple ? h : "(?:" + h + ")") + q;
        }
      }
      return "";
    }
    const fuente = ser(parseado.ast, { raiz: true });
    const flags = "gdv" + (flagsIni.i ? "i" : "");
    if (problemas.some((p) => p.nivel === "no")) return { fuente: null, flags, mapa, problemas };
    return { fuente, flags, mapa, problemas, atomicos };
  }

  /** Corre la regex traducida contra el texto. Devuelve { matches: [{indice, largo, valor, grupos: [{numero, nombre, valor, indice}]}], error } */
  function probar(parseado, texto, maximo) {
    const js = aJs(parseado);
    if (!js.fuente) return { matches: [], problemas: js.problemas, error: null, js };
    let re;
    try { re = new RegExp(js.fuente, js.flags); } catch (e) {
      try { re = new RegExp(js.fuente, js.flags.replace("v", "u")); } catch (e2) { return { matches: [], problemas: js.problemas, error: "No se pudo armar la versión JavaScript para probarla: " + e2.message, js }; }
    }
    const matches = []; let m; let ultimo = -1;
    while ((m = re.exec(texto)) !== null) {
      if (m[0] === "") { if (m.index === ultimo) { re.lastIndex++; continue; } re.lastIndex = m.index + 1; }
      ultimo = m.index;
      const grupos = [];
      for (const g of parseado.grupos) {
        const ent = js.mapa.find((x) => x.numero === g.numero && !x.oculto);
        const val = ent ? m[ent.js] : undefined;
        const idx = ent && m.indices && m.indices[ent.js] ? m.indices[ent.js][0] : null;
        grupos.push({ numero: g.numero, nombre: g.nombre, valor: val == null ? null : val, indice: idx });
      }
      matches.push({ indice: m.index, largo: m[0].length, valor: m[0], grupos });
      if (matches.length >= (maximo || 500)) break;
    }
    return { matches, problemas: js.problemas, error: null, js };
  }

  // ---------- avisos ----------
  function recorrer(nd, fn, padre) {
    if (!nd || typeof nd !== "object") return;
    fn(nd, padre);
    if (nd.tipo === "alt") nd.ramas.forEach((r) => recorrer(r, fn, nd)); else if (nd.tipo === "seq") nd.items.forEach((r) => recorrer(r, fn, nd));
    else if (nd.tipo === "cuant") recorrer(nd.hijo, fn, nd); else if (nd.tipo === "grupo") recorrer(nd.cuerpo, fn, nd);
    else if (nd.tipo === "cond") { if (nd.condicion.tipo === "expr") recorrer(nd.condicion.nodo, fn, nd); recorrer(nd.si, fn, nd); recorrer(nd.no, fn, nd); }
  }
  function puedeSerVacio(nd) {
    if (!nd) return true;
    switch (nd.tipo) {
      case "alt": return nd.ramas.some(puedeSerVacio);
      case "seq": return nd.items.every(puedeSerVacio);
      case "cuant": return nd.min === 0 || puedeSerVacio(nd.hijo);
      case "grupo": return nd.clase === "lookahead" || nd.clase === "neglookahead" || nd.clase === "lookbehind" || nd.clase === "neglookbehind" || puedeSerVacio(nd.cuerpo);
      case "ancla": case "opciones": return true;
      case "esc": return "bBAZzG".includes(nd.clave);
      default: return false;
    }
  }
  function avisos(parseado, patron) {
    const o = parseado.opciones; const lista = []; const ast = parseado.ast;
    const items = ast.tipo === "seq" ? ast.items : [ast];
    const primero = items.find((x) => x.tipo !== "opciones"), ultimo = items[items.length - 1];
    const esInicio = (x) => x && ((x.tipo === "ancla" && x.clave === "^") || (x.tipo === "esc" && (x.clave === "A" || x.clave === "G")));
    const esFin = (x) => x && ((x.tipo === "ancla" && x.clave === "$") || (x.tipo === "esc" && (x.clave === "Z" || x.clave === "z")));
    const anclaFinSuelta = ast.tipo === "alt" && ast.ramas.some((r) => esInicio(r.tipo === "seq" ? r.items[0] : r) || esFin(r.tipo === "seq" ? r.items[r.items.length - 1] : r));
    if (ast.tipo === "alt" && anclaFinSuelta) lista.push({ nivel: "mal", titulo: "Las anclas solo aplican a su rama", texto: "En «^a|b$» el ^ es solo de la primera alternativa y el $ solo de la última: «xb» y «ax» matchean. Si querés anclar todo, agrupá: ^(?:a|b)$." });
    else if (ast.tipo !== "alt" && !(esInicio(primero) && esFin(ultimo))) lista.push({ nivel: "info", titulo: "No está anclada", texto: "Así como está busca el patrón en cualquier parte del texto. Si es para validar un campo entero (IsMatch sobre un input), anclala: \\A al principio y \\z al final (o ^ y $, con la trampa de abajo)." });
    let usaDolar = false, usaPunto = false, usaD = false, usaPuntoEntreLetras = false;
    recorrer(ast, (nd, padre) => {
      if (nd.tipo === "ancla" && nd.clave === "$") usaDolar = true;
      if (nd.tipo === "punto") usaPunto = true;
      if (nd.tipo === "esc" && nd.clave === "d") usaD = true;
      if (nd.tipo === "clase") for (const it of nd.items) { if (it.tipo === "esc" && it.clave === "d") usaD = true; if (it.tipo === "rango" && it.de === "A" && it.a === "z") lista.push({ nivel: "mal", titulo: "[A-z] no es lo que parece", texto: "Entre la Z y la a hay seis caracteres más: [ \\ ] ^ _ `. Si querés letras, [A-Za-z] (o \\p{L} si valen las acentuadas)." }); }
      if (nd.tipo === "seq") for (let k = 1; k < nd.items.length - 1; k++) if (nd.items[k].tipo === "punto" && nd.items[k - 1].tipo === "lit" && nd.items[k + 1].tipo === "lit" && /\w/.test(nd.items[k - 1].valor) && /\w/.test(nd.items[k + 1].valor)) usaPuntoEntreLetras = true;
      if (nd.tipo === "alt" && nd.ramas.some((r) => r.tipo === "seq" && r.items.length === 0)) lista.push({ nivel: "medio", titulo: "Hay una alternativa vacía", texto: "Un «|» pegado a un paréntesis o a otro «|» deja una rama que matchea la cadena vacía: casi siempre es un error de tipeo; si querías «opcional», usá ?." });
      if (nd.tipo === "cuant" && nd.max === Infinity) {
        let anidado = false;
        recorrer(nd.hijo, (h) => { if (h !== nd.hijo && h.tipo === "cuant" && h.max === Infinity) anidado = true; });
        const hijoVacio = puedeSerVacio(nd.hijo);
        if (anidado && nd.hijo.tipo === "grupo" && nd.hijo.clase !== "atomico") lista.push({ nivel: "mal", titulo: "Backtracking catastrófico posible", texto: "Un cuantificador sin tope adentro de otro sin tope (" + nd.raw.slice(0, 1) === "{" ? nd.raw : nd.raw + " sobre " + nd.hijo.raw.slice(0, 30) + ") es la receta clásica: con un texto que casi matchea, el motor prueba combinaciones exponenciales y el regex tarda segundos o minutos. Reescribilo sin la ambigüedad (que lo de adentro y lo de afuera no puedan repartirse el mismo texto), usá un grupo atómico (?>…) y ponele matchTimeout a la Regex; en .NET 7+ RegexOptions.NonBacktracking garantiza tiempo lineal (sin backreferences ni lookarounds)." });
        else if (hijoVacio) lista.push({ nivel: "medio", titulo: "Repite algo que puede ser vacío", texto: nd.raw + " sobre algo que puede matchear la cadena vacía: funciona, pero es señal de que el patrón no dice lo que querías (por ejemplo (a?)* o (a*)*)." });
      }
      if (nd.tipo === "cuant" && nd.hijo.tipo === "punto" && nd.max === Infinity && !nd.lazy && patron.slice(nd.pos + nd.raw.length + 1).replace(/[)$]/g, "").length > 0) lista.push({ nivel: "info", titulo: "Un «.*» goloso en el medio", texto: "Toma todo hasta el final y después va soltando de a uno hasta que lo que sigue matchee. Anda, pero con textos largos es lento y suele agarrar de más (de la primera comilla a la última, no a la siguiente). Probá .*? (vago) o una clase que excluya el delimitador, como [^\"]*." });
      if (nd.tipo === "backref") { const g = parseado.grupos.find((x) => String(x.numero) === nd.ref || x.nombre === nd.ref); if (!g) lista.push({ nivel: "mal", titulo: "Referencia a un grupo que no existe", texto: nd.raw + " apunta a un grupo que no está en el patrón: .NET tira ArgumentException al construir la Regex." }); }
      if (nd.tipo === "grupo" && nd.clase === "captura" && !nd.nombre && o.explicitCapture) lista.push({ nivel: "info", titulo: "ExplicitCapture", texto: "Con RegexOptions.ExplicitCapture los paréntesis sin nombre no capturan: solo los (?<nombre>…)." });
    });
    const dedup = []; for (const a of lista) if (!dedup.some((d) => d.titulo === a.titulo)) dedup.push(a);
    if (usaDolar && !o.multiline) dedup.push({ nivel: "medio", titulo: "El $ también matchea antes de un salto de línea final", texto: "En .NET, «^\\d+$» acepta «123\\n». Si es para validar un campo, usá \\z en vez de $ (y \\A en vez de ^). Con Multiline, $ es el fin de cada línea." });
    if (usaD && !o.ecmaScript) dedup.push({ nivel: "info", titulo: "\\d no es solo 0-9", texto: "En .NET \\d matchea cualquier dígito Unicode (٣, ४, ๗…). Si querés solo los de siempre, [0-9], o RegexOptions.ECMAScript. int.Parse de un «٣» explota." });
    if (usaPunto && !o.singleline) dedup.push({ nivel: "info", titulo: "El punto no matchea el salto de línea", texto: "Sin RegexOptions.Singleline, «.» matchea cualquier cosa menos \\n. Para texto de varias líneas, Singleline o [\\s\\S]." });
    if (usaPuntoEntreLetras) dedup.push({ nivel: "medio", titulo: "Un punto sin escapar entre texto literal", texto: "Parece que ese «.» quiere ser un punto de verdad (como en «.com» o «127.0.0.1»), pero sin barra matchea cualquier carácter. Escribilo \\. ." });
    if (o.ignoreCase && !o.cultureInvariant) dedup.push({ nivel: "info", titulo: "IgnoreCase depende de la cultura", texto: "Con la cultura turca, «i» mayúscula es «İ» y [a-z] con IgnoreCase se comporta raro. Si el texto no es del usuario en su idioma, sumá RegexOptions.CultureInvariant." });
    if (/@/.test(patron) && /\\\./.test(patron)) dedup.push({ nivel: "info", titulo: "¿Es para validar un mail?", texto: "Un regex nunca va a validar bien un mail (hay direcciones válidas rarísimas y el único test real es mandar el correo). Para un formulario alcanza con «hay algo, una arroba y algo con punto»: ^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$, o MailAddress.TryCreate. Y después, confirmar por mail." });
    if (parseado.grupos.length > 3 && parseado.grupos.every((g) => !g.nombre)) dedup.push({ nivel: "info", titulo: "Muchos grupos sin nombre", texto: "Con " + parseado.grupos.length + " grupos, m.Groups[3] se vuelve ilegible. Ponele nombre: (?<anio>\\d{4}) y m.Groups[\"anio\"]." });
    const orden = { mal: 0, medio: 1, info: 2 };
    dedup.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
    return dedup;
  }

  // ---------- C# ----------
  function opcionesCs(o) {
    const l = [];
    if (o.ignoreCase) l.push("RegexOptions.IgnoreCase"); if (o.multiline) l.push("RegexOptions.Multiline"); if (o.singleline) l.push("RegexOptions.Singleline");
    if (o.ignoreWhitespace) l.push("RegexOptions.IgnorePatternWhitespace"); if (o.explicitCapture) l.push("RegexOptions.ExplicitCapture"); if (o.ecmaScript) l.push("RegexOptions.ECMAScript"); if (o.cultureInvariant) l.push("RegexOptions.CultureInvariant");
    return l.join(" | ");
  }
  function literalCs(patron) {
    if (!/["\n\r]/.test(patron)) return "@\"" + patron + "\"";
    if (!/\n|\r/.test(patron)) return "@\"" + patron.replace(/"/g, "\"\"") + "\"";
    return "\"\"\"\n        " + patron.replace(/\r?\n/g, "\n        ") + "\n        \"\"\"";
  }
  function snippetCs(patron, parseado, nombre) {
    const o = parseado.opciones; const opts = opcionesCs(o);
    const nom = nombre || "MiRegex";
    const grupos = parseado.grupos;
    let uso = "if (" + nom + "().IsMatch(entrada)) { /* válido */ }\n";
    if (grupos.length) {
      uso = "var m = " + nom + "().Match(entrada);\nif (m.Success)\n{\n" + grupos.map((g) => "    var " + (g.nombre || "grupo" + g.numero) + " = m.Groups[" + (g.nombre ? "\"" + g.nombre + "\"" : g.numero) + "].Value;\n").join("") + "}\n";
    }
    const generado = "using System.Text.RegularExpressions;\n\npublic static partial class Patrones\n{\n    [GeneratedRegex(" + literalCs(patron) + (opts ? ", " + opts : "") + ")]\n    public static partial Regex " + nom + "();\n}\n\n// Uso:\n" + uso + "// foreach (Match x in " + nom + "().Matches(texto)) { ... }";
    const clasico = "// Sin generador de código (o .NET 6 y anteriores): una sola instancia, estática, con timeout.\nprivate static readonly Regex " + nom + " = new(\n    " + literalCs(patron) + ",\n    " + (opts ? opts + " | " : "") + "RegexOptions.Compiled,\n    TimeSpan.FromSeconds(1));";
    return { generado, clasico };
  }

  const EJEMPLOS = [
    { nombre: "CUIT / CUIL", patron: "^(?<tipo>20|23|24|27|30|33|34)-?(?<dni>\\d{8})-?(?<verif>\\d)$", texto: "20-12345678-3\n27123456789\n30-71234567-8\n12-34567890-1", opciones: { multiline: true }, nota: "El formato nomás; el dígito verificador se chequea en C#." },
    { nombre: "Patente", patron: "\\b(?:[A-Z]{3} ?\\d{3}|[A-Z]{2} ?\\d{3} ?[A-Z]{2})\\b", texto: "Vi pasar un AB 123 CD y atrás un ABC 123, y después un XYZ999.", opciones: { ignoreCase: false } },
    { nombre: "Fecha dd/mm/aaaa", patron: "\\b(?<dia>0[1-9]|[12]\\d|3[01])/(?<mes>0[1-9]|1[0-2])/(?<anio>(?:19|20)\\d{2})\\b", texto: "Vence el 09/10/2026, no el 31/02/2026 ni el 5/1/2026." },
    { nombre: "Mail (simple y honesto)", patron: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", texto: "nico@ejemplo.com.ar", opciones: { multiline: true } },
    { nombre: "Teléfono argentino", patron: "(?:\\+?54\\s?)?(?:9\\s?)?(?:\\(?0?11\\)?|\\(?0?[2-9]\\d{1,3}\\)?)[\\s-]?\\d{3,4}[\\s-]?\\d{4}", texto: "Llamá al 11 4567-8901 o al +54 9 351 123 4567. El fijo es (0351) 422-3344." },
    { nombre: "Clave de connection string", patron: "(?<clave>[^=;]+)=(?<valor>[^;]*)", texto: "Server=.;Database=Tienda;User Id=app;Password=s3cr3t;TrustServerCertificate=true" },
    { nombre: "Importe con coma", patron: "^-?\\d{1,3}(?:\\.\\d{3})*(?:,\\d{1,2})?$", texto: "1.234.567,89\n-50,5\n1234,567\n12.34", opciones: { multiline: true } },
    { nombre: "Línea de log de Serilog", patron: "^(?<fecha>\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\.\\d{3}) \\[(?<nivel>[A-Z]{3})\\] (?<mensaje>.*)$", texto: "2026-10-19 03:12:45.123 [INF] Pedido 123 creado\n2026-10-19 03:12:46.001 [ERR] Timeout contra SQL", opciones: { multiline: true } },
    { nombre: "El clásico que explota", patron: "^(\\w+\\s?)*$", texto: "esta frase casi matchea entera porque son todas palabras con espacios pero al final tiene un signo de admiracion y el motor prueba todas las formas de repartir las palabras antes de rendirse y son muchisimas!", nota: "Backtracking catastrófico: con cada palabra que agregás tarda el doble." },
    { nombre: "GUID", patron: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b", texto: "Id: 3f2504e0-4f89-11d3-9a0c-0305e82c3301, otro: no-es-un-guid", opciones: { ignoreCase: true } },
  ];

  const api = { parsear, explicar, aJs, probar, avisos, snippetCs, opcionesCs, literalCs, EJEMPLOS, ErrorRegex, puedeSerVacio };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.RegexEnCriollo = api;
})(typeof window !== "undefined" ? window : globalThis);
