/* JSON a C#: lógica pura. Se carga en el navegador (window.JsonACSharp) y en Node (module.exports).
   No toca el DOM ni localStorage. */
"use strict";
(function (raiz) {

  /* ---------- Parser JSON propio ----------
     Se usa en vez de JSON.parse por dos motivos: errores con línea y columna, y saber si un
     número venía escrito con decimales o exponente ("1.0" es double aunque valga 1). */

  class ErrorJson extends Error {
    constructor(mensaje, texto, posicion) {
      const { linea, columna } = lineaColumna(texto, posicion);
      super(`${mensaje} (línea ${linea}, columna ${columna})`);
      this.name = "ErrorJson";
      this.detalle = mensaje;
      this.posicion = posicion;
      this.linea = linea;
      this.columna = columna;
    }
  }

  function lineaColumna(texto, posicion) {
    let linea = 1, columna = 1;
    for (let i = 0; i < posicion && i < texto.length; i++) {
      if (texto[i] === "\n") { linea++; columna = 1; } else columna++;
    }
    return { linea, columna };
  }

  /* Número "decimal": se marca con una caja Number para distinguir 1.0 de 1. */
  function numeroDecimal(valor) {
    const n = new Number(valor); // eslint-disable-line no-new-wrappers
    n.decimal = true;
    return n;
  }

  function parsear(texto) {
    if (typeof texto !== "string") throw new TypeError("Se esperaba texto");
    let i = 0;
    const n = texto.length;

    const error = (msj, pos) => new ErrorJson(msj, texto, pos === undefined ? i : pos);
    const blancos = () => { while (i < n && " \t\r\n".includes(texto[i])) i++; };
    const esperar = (c) => { if (texto[i] !== c) throw error(`Se esperaba "${c}"`); i++; };

    function valor() {
      blancos();
      if (i >= n) throw error("Se terminó el texto antes de tiempo");
      const c = texto[i];
      if (c === "{") return objeto();
      if (c === "[") return lista();
      if (c === '"') return cadena();
      if (c === "-" || (c >= "0" && c <= "9")) return numero();
      if (texto.startsWith("true", i)) { i += 4; return true; }
      if (texto.startsWith("false", i)) { i += 5; return false; }
      if (texto.startsWith("null", i)) { i += 4; return null; }
      if (c === "'") throw error("Las cadenas van con comillas dobles, no simples");
      if (c === "}" || c === "]") throw error(`Sobra un "${c}" o falta un valor antes`);
      throw error(`No se entiende "${c}"`);
    }

    function objeto() {
      esperar("{");
      const obj = {};
      blancos();
      if (texto[i] === "}") { i++; return obj; }
      for (;;) {
        blancos();
        if (texto[i] !== '"') {
          if (texto[i] === "}") throw error("Sobra una coma antes del cierre del objeto");
          if (texto[i] === "'") throw error("Las claves van con comillas dobles, no simples");
          if (/[A-Za-z_]/.test(texto[i] || "")) throw error("Las claves van entre comillas dobles");
          throw error("Se esperaba una clave entre comillas");
        }
        const clave = cadena();
        blancos();
        esperar(":");
        obj[clave] = valor();
        blancos();
        if (texto[i] === ",") { i++; continue; }
        if (texto[i] === "}") { i++; return obj; }
        if (i >= n) throw error("Falta cerrar el objeto con \"}\"");
        throw error("Se esperaba \",\" o \"}\"");
      }
    }

    function lista() {
      esperar("[");
      const arr = [];
      blancos();
      if (texto[i] === "]") { i++; return arr; }
      for (;;) {
        blancos();
        if (texto[i] === "]") throw error("Sobra una coma antes del cierre de la lista");
        arr.push(valor());
        blancos();
        if (texto[i] === ",") { i++; continue; }
        if (texto[i] === "]") { i++; return arr; }
        if (i >= n) throw error("Falta cerrar la lista con \"]\"");
        throw error("Se esperaba \",\" o \"]\"");
      }
    }

    function cadena() {
      const inicio = i;
      esperar('"');
      let s = "";
      for (;;) {
        if (i >= n) throw error("Cadena sin cerrar", inicio);
        const c = texto[i++];
        if (c === '"') return s;
        if (c === "\n") throw error("Salto de línea dentro de una cadena", i - 1);
        if (c !== "\\") { s += c; continue; }
        const e = texto[i++];
        switch (e) {
          case '"': s += '"'; break;
          case "\\": s += "\\"; break;
          case "/": s += "/"; break;
          case "b": s += "\b"; break;
          case "f": s += "\f"; break;
          case "n": s += "\n"; break;
          case "r": s += "\r"; break;
          case "t": s += "\t"; break;
          case "u": {
            const hex = texto.slice(i, i + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw error("Escape \\u inválido", i - 2);
            s += String.fromCharCode(parseInt(hex, 16));
            i += 4;
            break;
          }
          default: throw error(`Escape "\\${e}" inválido`, i - 2);
        }
      }
    }

    function numero() {
      const inicio = i;
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(texto.slice(i, i + 40));
      if (!m) throw error("Número mal formado");
      i += m[0].length;
      const v = Number(m[0]);
      if (!Number.isFinite(v)) throw error("Número fuera de rango", inicio);
      return (m[2] || m[3]) ? numeroDecimal(v) : v;
    }

    const resultado = valor();
    blancos();
    if (i < n) throw error("Sobra texto después del JSON");
    return resultado;
  }

  /* ---------- Inferencia de tipos ----------
     Tipos: { k: "null" | "bool" | "int" | "long" | "double" | "string" | "array" | "object" | "any" | "vacio",
              f?: "datetime" | "date" | "guid" (solo string), de?: tipo (array), props?: [{clave, tipo}] (object),
              nulo?: true, opcional?: true } */

  const RE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
  const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const RE_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function inferir(v) {
    if (v === null || v === undefined) return { k: "null" };
    if (v instanceof Number) return { k: "double" };
    if (typeof v === "boolean") return { k: "bool" };
    if (typeof v === "number") {
      if (!Number.isInteger(v)) return { k: "double" };
      if (v >= -2147483648 && v <= 2147483647) return { k: "int" };
      return { k: Number.isSafeInteger(v) ? "long" : "double" };
    }
    if (typeof v === "string") {
      let f = null;
      if (RE_DATETIME.test(v)) f = "datetime";
      else if (RE_DATE.test(v)) f = "date";
      else if (RE_GUID.test(v)) f = "guid";
      return f ? { k: "string", f } : { k: "string" };
    }
    if (Array.isArray(v)) {
      let de = { k: "vacio" };
      for (const x of v) de = unificar(de, inferir(x));
      return { k: "array", de };
    }
    if (typeof v === "object") {
      return { k: "object", props: Object.keys(v).map((clave) => ({ clave, tipo: inferir(v[clave]) })) };
    }
    return { k: "any" };
  }

  const esNumero = (t) => t.k === "int" || t.k === "long" || t.k === "double";

  function conNulo(t) {
    if (t.k === "null" || t.nulo) return t;
    return Object.assign({}, t, { nulo: true });
  }

  function unificar(a, b) {
    if (a.k === "vacio") return b;
    if (b.k === "vacio") return a;
    if (a.k === "null") return conNulo(b);
    if (b.k === "null") return conNulo(a);
    let r;
    if (a.k === b.k) {
      switch (a.k) {
        case "string": r = (a.f && a.f === b.f) ? { k: "string", f: a.f } : { k: "string" }; break;
        case "array": r = { k: "array", de: unificar(a.de, b.de) }; break;
        case "object": r = { k: "object", props: unificarProps(a.props, b.props, esDiccionario(a) || esDiccionario(b)) }; break;
        default: r = { k: a.k };
      }
    } else if (esNumero(a) && esNumero(b)) {
      r = { k: (a.k === "double" || b.k === "double") ? "double" : "long" };
    } else {
      r = { k: "any" };
    }
    if (a.nulo || b.nulo) r.nulo = true;
    if (a.opcional || b.opcional) r.opcional = true;
    return r;
  }

  /* En un diccionario las claves cambian de un objeto a otro: ahí una clave que falta no es un nulo. */
  function unificarProps(pa, pb, diccionario) {
    const enB = new Map(pb.map((p) => [p.clave, p.tipo]));
    const enA = new Set(pa.map((p) => p.clave));
    const faltante = diccionario ? (t) => t : (t) => Object.assign(conNulo(t), { opcional: true });
    const r = pa.map((p) => ({ clave: p.clave, tipo: enB.has(p.clave) ? unificar(p.tipo, enB.get(p.clave)) : faltante(p.tipo) }));
    for (const p of pb) if (!enA.has(p.clave)) r.push({ clave: p.clave, tipo: faltante(p.tipo) });
    return r;
  }

  /* Un objeto cuyas claves son números, fechas o GUIDs no es una clase: es un diccionario. */
  function esDiccionario(t) {
    if (t.k !== "object" || t.props.length < 2) return false;
    return t.props.every((p) => /^\d/.test(p.clave) || RE_GUID.test(p.clave));
  }

  function tipoDeDiccionario(t) {
    let v = { k: "vacio" };
    for (const p of t.props) v = unificar(v, p.tipo);
    return v;
  }

  /* ---------- Nombres ---------- */

  function partes(s) {
    return String(s)
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
      .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2")
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
  }

  function pascal(s) {
    let n = partes(s).map((t) => t[0].toUpperCase() + t.slice(1).toLowerCase()).join("");
    if (!n) n = "Campo";
    if (/^\p{N}/u.test(n)) n = "_" + n;
    return n;
  }

  function camel(s) {
    const p = pascal(s);
    return p[0] === "_" ? p : p[0].toLowerCase() + p.slice(1);
  }

  function singular(s) {
    if (/[^aeiou]ies$/i.test(s)) return s.slice(0, -3) + "y";
    if (/(ss|us|is|os|as)$/i.test(s) && s.length <= 3) return s;
    if (/(ss|us|is)$/i.test(s)) return s;
    if (/ones$/i.test(s)) return s.slice(0, -2);
    if (/(ch|sh|x|z|s)es$/i.test(s)) return s.slice(0, -2);
    if (/s$/i.test(s)) return s.slice(0, -1);
    return s;
  }

  function nombreUnico(base, usados) {
    let nombre = base, i = 2;
    while (usados.has(nombre)) nombre = base + i++;
    usados.add(nombre);
    return nombre;
  }

  /* ---------- Plan: de tipos a clases ----------
     Devuelve { tipoRaiz, clases: [{ nombre, props: [{ clave, nombre, tipo }] }] }.
     Dos objetos con la misma forma comparten clase. */

  function firma(t) {
    switch (t.k) {
      case "array": return "[" + firma(t.de) + "]";
      case "object": return "{" + t.props.map((p) => JSON.stringify(p.clave) + ":" + firma(p.tipo)).sort().join(",") + "}";
      case "string": return "string";
      default: return t.k;
    }
  }

  function planificar(valor, nombreRaiz) {
    const tipoRaiz = inferir(valor);
    const clases = [];
    const nombresUsados = new Set();
    const porFirma = new Map();
    const raizLimpia = pascal(nombreRaiz || "Root");

    function registrar(t, nombreSugerido) {
      const f = firma(t);
      if (porFirma.has(f)) return porFirma.get(f);
      const nombre = nombreUnico(nombreSugerido, nombresUsados);
      const clase = { nombre, props: [] };
      porFirma.set(f, nombre);
      clases.push(clase);
      const propsUsadas = new Set([nombre]);
      for (const p of t.props) {
        const base = pascal(p.clave);
        const nombreProp = nombreUnico(propsUsadas.has(base) && base === nombre ? base + "Value" : base, propsUsadas);
        clase.props.push({ clave: p.clave, nombre: nombreProp, tipo: p.tipo, clase: nombrarHijo(p.tipo, p.clave) });
      }
      return nombre;
    }

    /* Para una propiedad, devuelve el nombre de clase de su objeto (o del objeto que lista), si hay. */
    function nombrarHijo(t, clave) {
      if (t.k === "object") {
        if (esDiccionario(t)) return nombrarHijo(tipoDeDiccionario(t), clave);
        return registrar(t, pascal(clave));
      }
      if (t.k === "array") {
        let interno = t.de;
        while (interno.k === "array") interno = interno.de;
        if (interno.k === "object" && !esDiccionario(interno)) return registrar(interno, pascal(singular(clave)));
        if (interno.k === "object") return nombrarHijo(tipoDeDiccionario(interno), singular(clave));
      }
      return null;
    }

    let interno = tipoRaiz;
    while (interno.k === "array") interno = interno.de;
    let claseRaiz = null;
    if (interno.k === "object" && !esDiccionario(interno)) claseRaiz = registrar(interno, raizLimpia);
    else if (interno.k === "object") {
      const v = tipoDeDiccionario(interno);
      claseRaiz = nombrarHijo(v, raizLimpia);
    }
    return { tipoRaiz, clases, claseRaiz, nombreRaiz: raizLimpia };
  }

  /* ---------- C# ---------- */

  const OPCIONES_DEFAULT = {
    nombreRaiz: "Root",
    espacio: "",
    estilo: "clase",            // "clase" | "init" | "record"
    atributos: "stj",           // "stj" | "newtonsoft" | "ninguno"
    atributosSiempre: false,
    coleccion: "List",          // "List" | "array" | "IReadOnlyList"
    decimales: "double",        // "double" | "decimal"
    nrt: true,
    required: true,
    fechas: true,
  };

  function opcionesCompletas(o) {
    return Object.assign({}, OPCIONES_DEFAULT, o || {});
  }

  const VALOR = new Set(["bool", "int", "long", "double", "decimal", "DateTime", "Guid", "JsonElement"]);

  function tipoCs(t, clase, op, usos) {
    let base;
    switch (t.k) {
      case "bool": base = "bool"; break;
      case "int": base = "int"; break;
      case "long": base = "long"; break;
      case "double": base = op.decimales === "decimal" ? "decimal" : "double"; break;
      case "string":
        if (op.fechas && (t.f === "datetime" || t.f === "date")) { base = "DateTime"; usos.add("System"); }
        else if (op.fechas && t.f === "guid") { base = "Guid"; usos.add("System"); }
        else base = "string";
        break;
      case "array": {
        const de = tipoCs(t.de, clase, op, usos);
        if (op.coleccion === "array") base = de + "[]";
        else { base = `${op.coleccion}<${de}>`; usos.add("System.Collections.Generic"); }
        break;
      }
      case "object":
        if (esDiccionario(t)) {
          base = `Dictionary<string, ${tipoCs(tipoDeDiccionario(t), clase, op, usos)}>`;
          usos.add("System.Collections.Generic");
        } else base = clase || "object";
        break;
      case "null": base = "object"; break;
      default:
        if (op.atributos === "stj") { base = "JsonElement"; usos.add("System.Text.Json"); }
        else if (op.atributos === "newtonsoft") { base = "JToken"; usos.add("Newtonsoft.Json.Linq"); }
        else base = "object";
    }
    const esValor = VALOR.has(base);
    const nulo = t.nulo || t.k === "null";
    if (nulo && (esValor || op.nrt)) base += "?";
    return base;
  }

  /* Para tipos anidados (listas de listas de objetos) la clase va en la hoja. */
  function tipoCsProp(p, op, usos) {
    return tipoCs(p.tipo, p.clase, op, usos);
  }

  function atributo(p, op) {
    if (op.atributos === "ninguno") return null;
    if (!op.atributosSiempre && p.clave === p.nombre) return null;
    const nombre = op.atributos === "stj" ? "JsonPropertyName" : "JsonProperty";
    return `${nombre}(${JSON.stringify(p.clave)})`;
  }

  function generarCSharp(valor, opciones) {
    const op = opcionesCompletas(opciones);
    const plan = planificar(valor, op.nombreRaiz);
    const usos = new Set();
    if (op.atributos === "stj") usos.add("System.Text.Json.Serialization");
    if (op.atributos === "newtonsoft") usos.add("Newtonsoft.Json");
    const bloques = [];
    let propiedades = 0;

    for (const c of plan.clases) {
      const lineas = [];
      if (op.estilo === "record") {
        lineas.push(`public record ${c.nombre}(`);
        c.props.forEach((p, idx) => {
          const a = atributo(p, op);
          const coma = idx < c.props.length - 1 ? "," : "";
          lineas.push(`    ${a ? `[property: ${a}] ` : ""}${tipoCsProp(p, op, usos)} ${p.nombre}${coma}`);
        });
        lineas.push(");");
      } else {
        const acceso = op.estilo === "init" ? "init" : "set";
        lineas.push(`public class ${c.nombre}`, "{");
        c.props.forEach((p, idx) => {
          const a = atributo(p, op);
          const tipo = tipoCsProp(p, op, usos);
          const esRef = !VALOR.has(tipo.replace(/\?$/, "")) || tipo.includes("<") || tipo.endsWith("[]");
          const req = op.nrt && op.required && esRef && !tipo.endsWith("?") ? "required " : "";
          if (a) lineas.push(`    [${a}]`);
          lineas.push(`    public ${req}${tipo} ${p.nombre} { get; ${acceso}; }`);
          if (idx < c.props.length - 1) lineas.push("");
        });
        lineas.push("}");
      }
      propiedades += c.props.length;
      bloques.push(lineas.join("\n"));
    }

    const cabecera = [];
    let tipoRaizCs = null;
    if (plan.tipoRaiz.k !== "object" || esDiccionario(plan.tipoRaiz)) {
      tipoRaizCs = tipoCs(plan.tipoRaiz, plan.claseRaiz, op, usos);
      cabecera.push(`// El JSON de raíz es ${tipoRaizCs}, no una clase.`);
      if (plan.claseRaiz) {
        cabecera.push(op.atributos === "newtonsoft"
          ? `// Deserializá con JsonConvert.DeserializeObject<${tipoRaizCs}>(json).`
          : `// Deserializá con JsonSerializer.Deserialize<${tipoRaizCs}>(json).`);
      }
    }
    if (op.nrt && op.estilo !== "record" && !op.required) cabecera.push("// Las propiedades no anulables van a dar el aviso CS8618 si no las inicializás.");

    const usings = [...usos].sort((a, b) => a.localeCompare(b)).map((u) => `using ${u};`);
    const salida = [];
    if (usings.length) salida.push(usings.join("\n"));
    if (op.espacio.trim()) salida.push(`namespace ${op.espacio.trim()};`);
    if (cabecera.length) salida.push(cabecera.join("\n"));
    salida.push(...bloques);
    if (!bloques.length && !cabecera.length) salida.push("// El JSON no tiene objetos: no hay clases que generar.");

    return { codigo: salida.join("\n\n") + "\n", clases: plan.clases.length, propiedades, plan, tipoRaiz: tipoRaizCs };
  }

  /* ---------- TypeScript ---------- */

  const RE_IDENT_TS = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  function tipoTs(t, clase) {
    let base;
    switch (t.k) {
      case "bool": base = "boolean"; break;
      case "int": case "long": case "double": base = "number"; break;
      case "string": base = "string"; break;
      case "array": {
        const de = tipoTs(t.de, clase);
        base = de.includes("|") ? `(${de})[]` : `${de}[]`;
        break;
      }
      case "object": base = esDiccionario(t) ? `Record<string, ${tipoTs(tipoDeDiccionario(t), clase)}>` : (clase || "object"); break;
      case "null": base = "null"; break;
      default: base = "unknown";
    }
    if (t.nulo && t.k !== "null" && base !== "unknown") base += " | null";
    return base;
  }

  function generarTypeScript(valor, opciones) {
    const op = opcionesCompletas(opciones);
    const plan = planificar(valor, op.nombreRaiz);
    const bloques = [];
    let propiedades = 0;
    for (const c of plan.clases) {
      const lineas = [`export interface ${c.nombre} {`];
      for (const p of c.props) {
        const clave = RE_IDENT_TS.test(p.clave) ? p.clave : JSON.stringify(p.clave);
        lineas.push(`  ${clave}${p.tipo.opcional ? "?" : ""}: ${tipoTs(p.tipo, p.clase)};`);
      }
      lineas.push("}");
      propiedades += c.props.length;
      bloques.push(lineas.join("\n"));
    }
    const cabecera = [];
    let tipoRaizTs = null;
    if (plan.tipoRaiz.k !== "object" || esDiccionario(plan.tipoRaiz)) {
      tipoRaizTs = tipoTs(plan.tipoRaiz, plan.claseRaiz);
      cabecera.push(`export type ${plan.nombreRaiz}Json = ${tipoRaizTs};`);
    }
    if (!bloques.length && !cabecera.length) cabecera.push("// El JSON no tiene objetos: no hay interfaces que generar.");
    return { codigo: [...bloques, ...cabecera].join("\n\n") + "\n", clases: plan.clases.length, propiedades, plan, tipoRaiz: tipoRaizTs };
  }

  /* ---------- Formato ---------- */

  function desenvolver(v) {
    if (v instanceof Number) return v.valueOf();
    if (Array.isArray(v)) return v.map(desenvolver);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v)) o[k] = desenvolver(v[k]);
      return o;
    }
    return v;
  }

  function formatear(texto) {
    return JSON.stringify(desenvolver(parsear(texto)), null, 2);
  }

  const EJEMPLO = `{
  "id": 1042,
  "numero": "0001-00004213",
  "fecha": "2026-10-09T14:30:00-03:00",
  "fecha_entrega": "2026-10-14",
  "cliente": {
    "id": "b7e4c1a2-5f3d-4e8a-9c21-7d1f0a6b3e55",
    "razon_social": "Ferretería El Tornillo S.R.L.",
    "cuit": "30-71234567-8",
    "email": null,
    "direccion": { "calle": "Av. Rivadavia", "numero": 4521, "ciudad": "CABA" }
  },
  "items": [
    { "sku": "TOR-M8-50", "descripcion": "Tornillo M8 x 50", "cantidad": 200, "precio_unitario": 85.5 },
    { "sku": "TUE-M8", "descripcion": "Tuerca M8", "cantidad": 200, "precio_unitario": 32.0, "descuento": 10 }
  ],
  "pagos": [],
  "totales_por_mes": { "2026-10": 23500.0, "2026-11": 23500.0 },
  "estado": "PENDIENTE",
  "pagado": false,
  "observaciones": null,
  "tags": ["mayorista", "cuenta_corriente"]
}
`;

  const API = {
    parsear, ErrorJson, inferir, unificar, esDiccionario, planificar, generarCSharp, generarTypeScript,
    pascal, camel, singular, formatear, OPCIONES_DEFAULT, EJEMPLO, lineaColumna,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.JsonACSharp = API;
})(typeof window !== "undefined" ? window : globalThis);
