/* Cron en criollo: lógica pura. Se carga en el navegador (window.Cron) y en Node (module.exports).
   Parsea expresiones cron estándar (5 campos: Linux, Hangfire, NCrontab) y Quartz.NET (6 o 7 campos,
   con segundos y año; ?, L, W y #), las explica en castellano y calcula las próximas ejecuciones en
   una zona horaria. No toca el DOM ni localStorage. */
"use strict";
(function (raiz) {

  const MESES_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const DIAS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIAS_PLURAL = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"];
  const ORDINALES = ["", "primer", "segundo", "tercer", "cuarto", "quinto"];

  const MACROS = {
    "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *",
  };

  class ErrorCron extends Error {
    constructor(mensaje, campo) { super(mensaje); this.name = "ErrorCron"; this.campo = campo || null; }
  }

  /* ---------- Parser ---------- */

  const CAMPOS = {
    seg: { nombre: "segundos", min: 0, max: 59 },
    min: { nombre: "minutos", min: 0, max: 59 },
    hora: { nombre: "horas", min: 0, max: 23 },
    dia: { nombre: "día del mes", min: 1, max: 31, L: true, W: true, Q: true },
    mes: { nombre: "mes", min: 1, max: 12, nombres: MESES_EN, base: 1 },
    dow: { nombre: "día de la semana", min: 0, max: 7, nombres: DIAS_EN, base: 0, L: true, H: true, Q: true },
    anio: { nombre: "año", min: 1970, max: 2099 },
  };

  function valor(token, spec, modo, clave) {
    const t = token.toUpperCase();
    if (spec.nombres) {
      const i = spec.nombres.indexOf(t);
      if (i >= 0) return spec.base + i;
      if (/^[A-Z]+$/.test(t)) throw new ErrorCron(`"${token}" no es un ${spec.nombre} válido (van ${spec.nombres.join(", ").toLowerCase()})`, clave);
    }
    if (!/^\d+$/.test(t)) throw new ErrorCron(`"${token}" no es un número válido en ${spec.nombre}`, clave);
    let n = parseInt(t, 10);
    if (clave === "dow") {
      if (modo === "quartz") {
        if (n < 1 || n > 7) throw new ErrorCron(`En Quartz el día de la semana va de 1 (domingo) a 7 (sábado); "${n}" no vale`, clave);
        return n - 1;
      }
      if (n < 0 || n > 7) throw new ErrorCron(`El día de la semana va de 0 (domingo) a 6 (sábado), o 7 para domingo; "${n}" no vale`, clave);
      return n === 7 ? 0 : n;
    }
    if (n < spec.min || n > spec.max) throw new ErrorCron(`"${n}" se va de rango en ${spec.nombre} (${spec.min} a ${spec.max})`, clave);
    return n;
  }

  function parsearCampo(texto, clave, modo) {
    const spec = CAMPOS[clave];
    const tope = clave === "dow" ? 6 : spec.max;
    const campo = { clave, texto, valores: new Set(), partes: [], especiales: [], todo: false, interrogacion: false };
    const agregar = (a, b, paso) => { for (let v = a; v <= b; v += paso) campo.valores.add(v); };
    for (const parte of texto.split(",")) {
      if (parte === "") throw new ErrorCron(`Hay una coma de más en ${spec.nombre}`, clave);
      const p = parte.toUpperCase();
      if (p === "*") { campo.todo = true; campo.partes.push({ tipo: "todo" }); agregar(spec.min, tope, 1); continue; }
      if (p === "?") {
        if (!spec.Q) throw new ErrorCron(`"?" solo va en día del mes o día de la semana`, clave);
        if (modo !== "quartz") throw new ErrorCron(`"?" es de Quartz; en cron estándar usá "*"`, clave);
        campo.interrogacion = true; campo.partes.push({ tipo: "ninguno" }); continue;
      }
      const esEspecial = clave === "dia" ? /^(L|LW|L-\d+|\d+W)$/.test(p)
        : clave === "dow" ? /^(L|(SUN|MON|TUE|WED|THU|FRI|SAT|\d)L|(SUN|MON|TUE|WED|THU|FRI|SAT|\d)#\d)$/.test(p)
        : false;
      if (esEspecial) {
        if (modo !== "quartz") throw new ErrorCron(`"${parte}" (L, W, #) es sintaxis de Quartz; en cron estándar no existe`, clave);
        let m;
        if (clave === "dia") {
          if (p === "L") { campo.especiales.push({ tipo: "L" }); campo.partes.push({ tipo: "L" }); continue; }
          if (p === "LW") { campo.especiales.push({ tipo: "LW" }); campo.partes.push({ tipo: "LW" }); continue; }
          if ((m = /^L-(\d+)$/.exec(p))) { const n = +m[1]; if (n < 1 || n > 30) throw new ErrorCron(`"${parte}": el corrimiento va de 1 a 30`, clave); campo.especiales.push({ tipo: "L-", n }); campo.partes.push({ tipo: "L-", n }); continue; }
          if ((m = /^(\d+)W$/.exec(p))) { const n = +m[1]; if (n < 1 || n > 31) throw new ErrorCron(`"${parte}": el día va de 1 a 31`, clave); campo.especiales.push({ tipo: "W", n }); campo.partes.push({ tipo: "W", n }); continue; }
          throw new ErrorCron(`"${parte}" no se entiende en día del mes (vale L, LW, L-3, 15W)`, clave);
        }
        if (clave === "dow") {
          if (p === "L") { campo.valores.add(6); campo.partes.push({ tipo: "valor", v: 6 }); continue; }
          if ((m = /^([A-Z0-9]+)L$/.exec(p))) { const d = valor(m[1], spec, modo, clave); campo.especiales.push({ tipo: "ultimo", dow: d }); campo.partes.push({ tipo: "ultimo", dow: d }); continue; }
          if ((m = /^([A-Z0-9]+)#(\d)$/.exec(p))) { const d = valor(m[1], spec, modo, clave), n = +m[2]; if (n < 1 || n > 5) throw new ErrorCron(`"${parte}": el número después de # va de 1 a 5`, clave); campo.especiales.push({ tipo: "enesimo", dow: d, n }); campo.partes.push({ tipo: "enesimo", dow: d, n }); continue; }
          throw new ErrorCron(`"${parte}" no se entiende en día de la semana (vale L, 5L, MON#2)`, clave);
        }
        throw new ErrorCron(`"${parte}" no va en ${spec.nombre}`, clave);
      }
      let m;
      if ((m = /^\*\/(\d+)$/.exec(p))) {
        const paso = +m[1];
        if (paso < 1) throw new ErrorCron(`El paso tiene que ser al menos 1 en ${spec.nombre}`, clave);
        campo.partes.push({ tipo: "paso", a: spec.min, b: tope, paso, desdeTodo: true });
        agregar(spec.min, tope, paso); continue;
      }
      if ((m = /^([^\/\-]+)-([^\/\-]+)(?:\/(\d+))?$/.exec(p))) {
        const a = valor(m[1], spec, modo, clave), b = valor(m[2], spec, modo, clave), paso = m[3] ? +m[3] : 1;
        if (paso < 1) throw new ErrorCron(`El paso tiene que ser al menos 1 en ${spec.nombre}`, clave);
        if (a > b) {
          if (clave === "dow") {               // vuelta de semana: FRI-MON = vie, sáb, dom, lun
            campo.partes.push({ tipo: "rango", a, b, paso, vuelta: true });
            for (let v = a, k = 0; k < 7; v = (v + 1) % 7, k++) { if (k % paso === 0) campo.valores.add(v); if (v === b) break; }
            continue;
          }
          throw new ErrorCron(`El rango "${parte}" está al revés en ${spec.nombre}`, clave);
        }
        campo.partes.push({ tipo: paso > 1 ? "paso" : "rango", a, b, paso, desdeTodo: false });
        agregar(a, b, paso); continue;
      }
      if ((m = /^([^\/\-]+)\/(\d+)$/.exec(p))) {
        const a = valor(m[1], spec, modo, clave), paso = +m[2];
        if (paso < 1) throw new ErrorCron(`El paso tiene que ser al menos 1 en ${spec.nombre}`, clave);
        campo.partes.push({ tipo: "paso", a, b: tope, paso, desdeTodo: a === spec.min, abierto: true });
        agregar(a, tope, paso); continue;
      }
      if (/^[A-Z0-9]+$/.test(p)) {
        const v = valor(p, spec, modo, clave);
        campo.partes.push({ tipo: "valor", v });
        campo.valores.add(v); continue;
      }
      throw new ErrorCron(`"${parte}" no se entiende en ${spec.nombre}`, clave);
    }
    campo.restringido = !campo.todo && !campo.interrogacion;
    return campo;
  }

  /* Parsea la expresión. modo: "auto" (5 campos → estándar, 6 o 7 → Quartz), "estandar" o "quartz". */
  function parsear(expresion, modoPedido) {
    let texto = String(expresion || "").trim().replace(/\s+/g, " ");
    if (!texto) throw new ErrorCron("Escribí una expresión cron");
    const macro = MACROS[texto.toLowerCase()];
    if (macro) texto = macro;
    else if (texto.startsWith("@")) throw new ErrorCron(`"${texto}" no es un atajo conocido (van @hourly, @daily, @weekly, @monthly, @yearly)`);
    const tokens = texto.split(" ");
    const n = tokens.length;
    if (n < 5 || n > 7) throw new ErrorCron(`Tiene ${n} campo${n === 1 ? "" : "s"}: cron estándar usa 5 (minuto hora día mes díaSemana) y Quartz 6 o 7 (segundo minuto hora día mes díaSemana [año])`);
    let modo = modoPedido || "auto";
    if (modo === "auto") modo = n === 5 ? "estandar" : "quartz";
    if (modo === "estandar" && n !== 5) throw new ErrorCron(n === 7 ? "El cron estándar no tiene campo de año: son 5 campos (minuto hora día mes díaSemana)" : "El cron estándar no lleva segundos: son 5 campos (minuto hora día mes díaSemana). Si querés segundos, pasá a Quartz");
    if (modo === "quartz" && n === 5) throw new ErrorCron("Quartz necesita el campo de segundos adelante: 6 campos (segundo minuto hora día mes díaSemana), por ejemplo \"0 " + texto + "\"");
    const claves = n === 5 ? ["min", "hora", "dia", "mes", "dow"] : ["seg", "min", "hora", "dia", "mes", "dow"].concat(n === 7 ? ["anio"] : []);
    const campos = {};
    claves.forEach((clave, i) => { campos[clave] = parsearCampo(tokens[i], clave, modo); });
    if (!campos.seg) campos.seg = parsearCampo("0", "seg", modo);

    if (modo === "quartz" && campos.dia.interrogacion && campos.dow.interrogacion) {
      throw new ErrorCron(`"?" va en día del mes o en día de la semana, no en los dos: poné "*" en uno`, "dow");
    }
    if (modo === "quartz" && !campos.dia.interrogacion && !campos.dow.interrogacion) {
      const arreglo = tokens.slice();
      const idxDia = 3, idxDow = 5;
      if (campos.dow.restringido && !campos.dia.restringido) arreglo[idxDia] = "?"; else arreglo[idxDow] = "?";
      const e = new ErrorCron(`Quartz exige "?" en día del mes o en día de la semana (no puede restringir los dos a la vez): probá "${arreglo.join(" ")}"`, campos.dow.restringido && !campos.dia.restringido ? "dia" : "dow");
      e.sugerencia = arreglo.join(" ");
      throw e;
    }
    const avisos = [];
    for (const clave of ["seg", "min", "hora"]) {
      const c = campos[clave];
      for (const p of c.partes) {
        if (p.tipo === "paso" && p.desdeTodo) {
          const ciclo = CAMPOS[clave].max + 1;
          if (ciclo % p.paso !== 0) avisos.push(`"*/${p.paso}" en ${CAMPOS[clave].nombre}: como ${ciclo} no es múltiplo de ${p.paso}, el intervalo no es parejo (el último tramo de cada ${clave === "hora" ? "día" : clave === "min" ? "hora" : "minuto"} queda más corto). Si querés cada ${p.paso} exactos, no es con cron.`);
        }
      }
    }
    if (modo === "estandar" && campos.dia.restringido && campos.dow.restringido) {
      avisos.push("Día del mes y día de la semana están los dos restringidos: en cron estándar (Linux, Hangfire) corre cuando se cumple cualquiera de los dos, no los dos a la vez.");
    }
    if (campos.dia.restringido) {
      const dias = [...campos.dia.valores];
      if (dias.some((d) => d > 28) && !campos.mes.restringido && campos.dia.partes.every((p) => p.tipo === "valor")) {
        const cuales = dias.filter((d) => d > 28);
        avisos.push(`El día ${cuales.join(", ")} no existe en todos los meses: esos meses no corre. Para "fin de mes" ${modo === "quartz" ? 'usá "L" en día del mes' : "no hay forma en cron estándar; se corre el 1 a la madrugada o se mira la fecha desde el código"}.`);
      }
    }
    if (modo === "quartz" && /\b(7)\b/.test(tokens[5]) && !/[A-Za-z]/.test(tokens[5])) avisos.push("Ojo: en Quartz 1 es domingo y 7 es sábado (no 7 = domingo como en Linux). Con nombres (MON, FRI) no hay confusión.");
    if (modo === "estandar" && /\b1\b/.test(tokens[4]) && !/[A-Za-z]/.test(tokens[4])) avisos.push("Ojo: en cron estándar 0 es domingo y 1 es lunes (en Quartz, 1 es domingo). Con nombres (MON, FRI) no hay confusión.");
    return { texto, tokens, modo, campos, avisos, nCampos: n };
  }

  /* ---------- Coincidencia de fechas ---------- */

  const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();   // mes 1..12
  const dowDe = (anio, mes, dia) => new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();

  /* Día hábil (lun-vie) más cercano al día n del mes, sin salir del mes (regla de Quartz). */
  function diaHabilCercano(anio, mes, n) {
    const ultimo = diasDelMes(anio, mes);
    const d = Math.min(n, ultimo);
    const dow = dowDe(anio, mes, d);
    if (dow === 6) return d === 1 ? 3 : d - 1;
    if (dow === 0) return d + 1 > ultimo ? d - 2 : d + 1;
    return d;
  }

  function diaCoincide(campos, modo, anio, mes, dia) {
    const dow = dowDe(anio, mes, dia);
    const ultimo = diasDelMes(anio, mes);
    const porDia = () => {
      const c = campos.dia;
      if (c.valores.has(dia)) return true;
      for (const e of c.especiales) {
        if (e.tipo === "L" && dia === ultimo) return true;
        if (e.tipo === "L-" && dia === ultimo - e.n) return true;
        if (e.tipo === "LW" && dia === diaHabilCercano(anio, mes, ultimo)) return true;
        if (e.tipo === "W" && dia === diaHabilCercano(anio, mes, e.n)) return true;
      }
      return false;
    };
    const porDow = () => {
      const c = campos.dow;
      if (c.valores.has(dow)) return true;
      for (const e of c.especiales) {
        if (e.tipo === "ultimo" && dow === e.dow && dia + 7 > ultimo) return true;
        if (e.tipo === "enesimo" && dow === e.dow && Math.ceil(dia / 7) === e.n) return true;
      }
      return false;
    };
    const rDia = campos.dia.restringido, rDow = campos.dow.restringido;
    if (modo === "estandar" && rDia && rDow) return porDia() || porDow();
    return (!rDia || porDia()) && (!rDow || porDow());
  }

  /* ---------- Zonas horarias ---------- */

  const formateadores = {};
  function formateador(zona) {
    if (!formateadores[zona]) {
      formateadores[zona] = new Intl.DateTimeFormat("en-US", {
        timeZone: zona, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", second: "numeric", weekday: "short",
      });
    }
    return formateadores[zona];
  }

  /* Partes de reloj de pared de un instante en una zona. */
  function partes(ms, zona) {
    const p = {};
    for (const { type, value } of formateador(zona).formatToParts(new Date(ms))) p[type] = value;
    return { anio: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour === 24 ? 0 : +p.hour, min: +p.minute, seg: +p.second };
  }

  /* Instante (ms UTC) de una hora de pared en una zona. Admite desbordes (mes 13, día 32) como Date.UTC. */
  function instante(anio, mes, dia, hora, min, seg, zona) {
    const comoUtc = Date.UTC(anio, mes - 1, dia, hora, min, seg);
    let t = comoUtc;
    for (let i = 0; i < 3; i++) {
      const p = partes(t, zona);
      const visto = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.min, p.seg);
      const dif = visto - comoUtc;
      if (dif === 0) break;
      t -= dif;
    }
    return t;
  }

  function zonaValida(zona) {
    try { formateador(zona); return true; } catch (e) { return false; }
  }

  /* ---------- Próximas ejecuciones ---------- */

  const LIMITE_ANIOS = 8;

  /* Devuelve hasta `cantidad` instantes (ms) posteriores a `desde` en los que corre la expresión. */
  function proximas(parsed, opciones) {
    const o = Object.assign({ desde: Date.now(), zona: "America/Argentina/Buenos_Aires", cantidad: 10 }, opciones);
    const { campos, modo } = parsed;
    const conSegundos = parsed.nCampos >= 6;
    const resultados = [];
    const inicio = typeof o.desde === "number" ? o.desde : +o.desde;
    let t = Math.floor(inicio / 1000) * 1000 + 1000;
    if (!conSegundos) t = Math.floor(inicio / 60000) * 60000 + 60000;
    const anioTope = partes(inicio, o.zona).anio + LIMITE_ANIOS;
    let pasos = 0;
    while (resultados.length < o.cantidad && pasos++ < 200000) {
      const p = partes(t, o.zona);
      if (p.anio > anioTope) break;
      if (campos.anio && !campos.anio.valores.has(p.anio)) {
        if (p.anio >= CAMPOS.anio.max) break;
        t = instante(p.anio + 1, 1, 1, 0, 0, 0, o.zona); continue;
      }
      if (!campos.mes.valores.has(p.mes)) { t = instante(p.anio, p.mes + 1, 1, 0, 0, 0, o.zona); continue; }
      if (!diaCoincide(campos, modo, p.anio, p.mes, p.dia)) { t = instante(p.anio, p.mes, p.dia + 1, 0, 0, 0, o.zona); continue; }
      if (!campos.hora.valores.has(p.hora)) { t = instante(p.anio, p.mes, p.dia, p.hora + 1, 0, 0, o.zona); continue; }
      if (!campos.min.valores.has(p.min)) { t = instante(p.anio, p.mes, p.dia, p.hora, p.min + 1, 0, o.zona); continue; }
      if (!campos.seg.valores.has(p.seg)) { t = instante(p.anio, p.mes, p.dia, p.hora, p.min, p.seg + 1, o.zona); continue; }
      resultados.push(t);
      t += conSegundos ? 1000 : 60000;
    }
    return resultados;
  }

  /* ---------- Explicación en castellano ---------- */

  const dos = (n) => String(n).padStart(2, "0");
  function lista(items) {
    if (items.length <= 1) return items.join("");
    return items.slice(0, -1).join(", ") + " y " + items[items.length - 1];
  }
  const hs = (h) => `${h}`;

  function partesValores(campo, nombreValor) {
    return campo.partes.map((p) => {
      if (p.tipo === "valor") return nombreValor(p.v);
      if (p.tipo === "rango") return p.vuelta ? `de ${nombreValor(p.a)} a ${nombreValor(p.b)}` : `de ${nombreValor(p.a)} a ${nombreValor(p.b)}`;
      if (p.tipo === "paso") return p.desdeTodo ? `cada ${p.paso}` : `cada ${p.paso} de ${nombreValor(p.a)} a ${nombreValor(p.b)}`;
      return "";
    });
  }

  function describirTiempo(campos, conSegundos) {
    const s = campos.seg, m = campos.min, h = campos.hora;
    const unValor = (c) => c.partes.length === 1 && c.partes[0].tipo === "valor" ? c.partes[0].v : null;
    const sv = unValor(s), mv = unValor(m), hv = unValor(h);
    const horaTexto = () => {
      if (h.todo) return "";
      if (h.partes.length === 1) {
        const p = h.partes[0];
        if (p.tipo === "rango") return `de ${p.a} a ${p.b} hs`;
        if (p.tipo === "paso" && p.desdeTodo) return `cada ${p.paso} horas`;
        if (p.tipo === "paso") return `cada ${p.paso} horas de ${p.a} a ${p.b}`;
      }
      if (h.partes.every((p) => p.tipo === "valor")) return `a las ${lista(h.partes.map((p) => `${p.v}`))} hs`;
      return `a las ${lista(partesValores(h, (v) => `${v}`))} hs`;
    };
    const segTexto = () => {
      if (!conSegundos || sv === 0) return "";
      if (s.todo) return "cada segundo";
      if (s.partes.length === 1 && s.partes[0].tipo === "paso" && s.partes[0].desdeTodo) return `cada ${s.partes[0].paso} segundos`;
      if (sv !== null) return `en el segundo ${sv}`;
      return `en los segundos ${lista(partesValores(s, String))}`;
    };
    // Caso más común: hora y minuto fijos.
    if (hv !== null && mv !== null && (sv !== null || !conSegundos)) {
      const base = `a las ${dos(hv)}:${dos(mv)}` + (conSegundos && sv ? `:${dos(sv)}` : "");
      return base;
    }
    if (hv !== null && h.partes.length === 1 && m.partes.every((p) => p.tipo === "valor") && (sv !== null || !conSegundos)) {
      const partesSeg = segTexto();
      return `a las ${lista(m.partes.map((p) => `${dos(hv)}:${dos(p.v)}`))}` + (partesSeg ? `, ${partesSeg}` : "");
    }
    const trozos = [];
    if (hv !== null && mv !== null && conSegundos && sv === null) {
      return `a las ${dos(hv)}:${dos(mv)}, ${segTexto()}`;
    }
    if (mv !== null && h.partes.length > 1 && h.partes.every((p) => p.tipo === "valor") && (sv !== null || !conSegundos)) {
      return `a las ${lista(h.partes.map((p) => `${dos(p.v)}:${dos(mv)}`))}` + (conSegundos && sv ? `:${dos(sv)}` : "");
    }
    if (m.todo) {
      if (conSegundos && (s.todo || (s.partes.length === 1 && s.partes[0].tipo === "paso" && s.partes[0].desdeTodo))) trozos.push(segTexto());
      else if (conSegundos && sv !== null && sv !== 0) trozos.push(`cada minuto, en el segundo ${sv}`);
      else if (conSegundos && sv === null) trozos.push(`cada minuto, ${segTexto()}`);
      else trozos.push("cada minuto");
    } else if (m.partes.length === 1 && m.partes[0].tipo === "paso") {
      const p = m.partes[0];
      trozos.push(p.desdeTodo ? `cada ${p.paso} minutos` : `cada ${p.paso} minutos del minuto ${p.a} al ${p.b}`);
      if (conSegundos && sv) trozos.push(`en el segundo ${sv}`);
      else if (conSegundos && sv === null) trozos.push(segTexto());
    } else if (mv !== null) {
      trozos.push(mv === 0 ? "en punto" : `a los ${mv} minutos de cada hora`);
      if (conSegundos && sv) trozos.push(`en el segundo ${sv}`);
      else if (conSegundos && sv === null) trozos.push(segTexto());
    } else if (m.partes.every((p) => p.tipo === "valor")) {
      trozos.push(`en los minutos ${lista(m.partes.map((p) => String(p.v)))} de cada hora`);
      if (conSegundos && segTexto()) trozos.push(segTexto());
    } else {
      trozos.push(`en los minutos ${lista(partesValores(m, String))} de cada hora`);
      if (conSegundos && segTexto()) trozos.push(segTexto());
    }
    const ht = horaTexto();
    if (ht) trozos.push(ht);
    return trozos.filter(Boolean).join(", ");
  }

  function describirDias(campos, modo) {
    const dia = campos.dia, dow = campos.dow;
    const textoDia = () => {
      const t = dia.partes.map((p) => {
        if (p.tipo === "valor") return `el día ${p.v}`;
        if (p.tipo === "rango") return `del ${p.a} al ${p.b}`;
        if (p.tipo === "paso") return p.desdeTodo ? `cada ${p.paso} días (desde el 1)` : `cada ${p.paso} días del ${p.a} al ${p.b}`;
        if (p.tipo === "L") return "el último día del mes";
        if (p.tipo === "L-") return `${p.n} día${p.n === 1 ? "" : "s"} antes de fin de mes`;
        if (p.tipo === "LW") return "el último día hábil del mes";
        if (p.tipo === "W") return `el día hábil más cercano al ${p.n}`;
        return "";
      });
      if (dia.partes.length > 1 && dia.partes.every((p) => p.tipo === "valor")) return `los días ${lista(dia.partes.map((p) => String(p.v)))}`;
      return lista(t);
    };
    const textoDow = () => {
      const t = dow.partes.map((p) => {
        if (p.tipo === "valor") return `los ${DIAS_PLURAL[p.v]}`;
        if (p.tipo === "rango") return `de ${DIAS[p.a]} a ${DIAS[p.b]}`;
        if (p.tipo === "paso") return p.desdeTodo ? `cada ${p.paso} días de la semana desde el domingo` : `cada ${p.paso} días de ${DIAS[p.a]} a ${DIAS[p.b]}`;
        if (p.tipo === "ultimo") return `el último ${DIAS[p.dow]} del mes`;
        if (p.tipo === "enesimo") return `el ${ORDINALES[p.n]} ${DIAS[p.dow]} del mes`;
        return "";
      });
      if (dow.partes.length === 1 && dow.partes[0].tipo === "rango" && dow.partes[0].a === 1 && dow.partes[0].b === 5) return "de lunes a viernes";
      if (dow.partes.every((p) => p.tipo === "valor")) {
        const vs = dow.partes.map((p) => p.v);
        if (vs.length === 2 && vs.includes(0) && vs.includes(6)) return "los sábados y domingos";
        if (vs.length === 5 && [1, 2, 3, 4, 5].every((v) => vs.includes(v))) return "de lunes a viernes";
        return `los ${lista(vs.map((v) => DIAS_PLURAL[v]))}`;
      }
      return lista(t);
    };
    const rDia = dia.restringido, rDow = dow.restringido;
    if (!rDia && !rDow) return "todos los días";
    const textoDiaMes = () => textoDia() + (dia.partes.every((p) => p.tipo === "valor" || p.tipo === "rango" || p.tipo === "paso") ? " de cada mes" : "");
    if (rDia && !rDow) return textoDiaMes();
    if (!rDia && rDow) return textoDow();
    return modo === "estandar" ? `${textoDiaMes()} y también ${textoDow()}` : `${textoDiaMes()} ${textoDow()}`;
  }

  function describirMes(campos) {
    const mes = campos.mes;
    if (!mes.restringido) return "";
    if (mes.partes.length === 1) {
      const p = mes.partes[0];
      if (p.tipo === "rango") return `de ${MESES[p.a - 1]} a ${MESES[p.b - 1]}`;
      if (p.tipo === "paso") return p.desdeTodo ? `cada ${p.paso} meses (desde enero)` : `cada ${p.paso} meses de ${MESES[p.a - 1]} a ${MESES[p.b - 1]}`;
    }
    if (mes.partes.every((p) => p.tipo === "valor")) return `en ${lista(mes.partes.map((p) => MESES[p.v - 1]))}`;
    return lista(mes.partes.map((p) => p.tipo === "valor" ? `en ${MESES[p.v - 1]}` : p.tipo === "rango" ? `de ${MESES[p.a - 1]} a ${MESES[p.b - 1]}` : `cada ${p.paso} meses de ${MESES[p.a - 1]} a ${MESES[p.b - 1]}`));
  }

  function describirAnio(campos) {
    const a = campos.anio;
    if (!a || !a.restringido) return "";
    if (a.partes.every((p) => p.tipo === "valor")) return `en ${lista(a.partes.map((p) => String(p.v)))}`;
    return lista(a.partes.map((p) => p.tipo === "valor" ? `en ${p.v}` : p.tipo === "rango" ? `de ${p.a} a ${p.b}` : `cada ${p.paso} años desde ${p.a}`));
  }

  function describir(parsed) {
    const { campos, modo } = parsed;
    const conSegundos = parsed.nCampos >= 6;
    const tiempo = describirTiempo(campos, conSegundos);
    let dias = describirDias(campos, modo);
    let mes = describirMes(campos);
    const unico = (c) => c.partes.length === 1 && c.partes[0].tipo === "valor" ? c.partes[0].v : null;
    if (unico(campos.dia) !== null && unico(campos.mes) !== null && !campos.dow.restringido) {
      dias = `el ${unico(campos.dia)} de ${MESES[unico(campos.mes) - 1]}`; mes = "";
    }
    const anio = describirAnio(campos);
    let frase = [tiempo, dias, mes, anio].filter(Boolean).join(", ");
    frase = frase.charAt(0).toUpperCase() + frase.slice(1) + ".";
    const detalle = [];
    const nombres = { seg: "Segundo", min: "Minuto", hora: "Hora", dia: "Día del mes", mes: "Mes", dow: "Día de la semana", anio: "Año" };
    const orden = parsed.nCampos === 5 ? ["min", "hora", "dia", "mes", "dow"] : ["seg", "min", "hora", "dia", "mes", "dow"].concat(parsed.nCampos === 7 ? ["anio"] : []);
    for (const clave of orden) detalle.push({ clave, nombre: nombres[clave], valor: campos[clave].texto, significado: significadoCampo(campos[clave], clave, modo) });
    return { frase, detalle };
  }

  function significadoCampo(campo, clave, modo) {
    if (campo.interrogacion) return "sin restricción (lo decide el otro campo de día)";
    if (campo.todo && campo.partes.length === 1) return clave === "dia" || clave === "dow" ? "todos" : clave === "mes" ? "todos los meses" : clave === "anio" ? "todos los años" : `cada ${CAMPOS[clave].nombre.replace("minutos", "minuto").replace("segundos", "segundo").replace("horas", "hora")}`;
    const nombre = (v) => clave === "mes" ? MESES[v - 1] : clave === "dow" ? DIAS[v] : String(v);
    return lista(campo.partes.map((p) => {
      switch (p.tipo) {
        case "todo": return "todos";
        case "valor": return nombre(p.v);
        case "rango": return `de ${nombre(p.a)} a ${nombre(p.b)}`;
        case "paso": return p.desdeTodo ? `cada ${p.paso}` : `cada ${p.paso} de ${nombre(p.a)} a ${nombre(p.b)}`;
        case "L": return "último día del mes";
        case "L-": return `${p.n} antes de fin de mes`;
        case "LW": return "último día hábil del mes";
        case "W": return `día hábil más cercano al ${p.n}`;
        case "ultimo": return `último ${DIAS[p.dow]} del mes`;
        case "enesimo": return `${ORDINALES[p.n]} ${DIAS[p.dow]} del mes`;
        default: return "";
      }
    })) + (clave === "dow" && modo === "quartz" && campo.partes.some((p) => p.tipo === "valor" || p.tipo === "rango") ? " (1 = domingo)" : "");
  }

  /* ---------- Conversión entre dialectos ---------- */

  function convertir(parsed, aModo) {
    const { tokens, modo, campos } = parsed;
    if (aModo === modo) return tokens.join(" ");
    if (aModo === "quartz") {
      const dowTexto = tokens[4].replace(/\d+/g, (d) => String(+d === 7 ? 1 : +d + 1));
      let dia = tokens[2], dow = dowTexto;
      if (campos.dia.restringido && campos.dow.restringido) throw new ErrorCron("Quartz no puede restringir día del mes y día de la semana a la vez: esta expresión no tiene equivalente exacto");
      if (!campos.dow.restringido) dow = "?"; else dia = "?";
      return ["0", tokens[0], tokens[1], dia, tokens[3], dow].join(" ");
    }
    if (parsed.nCampos === 7 && campos.anio.restringido) throw new ErrorCron("El cron estándar no tiene año: sacá el último campo");
    if (campos.seg.restringido && !(campos.seg.partes.length === 1 && campos.seg.partes[0].tipo === "valor" && campos.seg.partes[0].v === 0)) throw new ErrorCron("El cron estándar no tiene segundos: solo se puede convertir si el campo de segundos es 0");
    if (campos.dia.especiales.length || campos.dow.especiales.length) throw new ErrorCron("L, W y # no existen en cron estándar: no hay equivalente exacto");
    const dow = tokens[5] === "?" ? "*" : tokens[5].replace(/\d+/g, (d) => String(+d - 1));
    const dia = tokens[3] === "?" ? "*" : tokens[3];
    return [tokens[1], tokens[2], dia, tokens[4], dow].join(" ");
  }

  /* ---------- Snippets de C# ---------- */

  function snippets(expresion, modo, zona) {
    const tz = zona === "UTC" ? "TimeZoneInfo.Utc" : `TimeZoneInfo.FindSystemTimeZoneById("${zona}")`;
    const hangfire = modo === "estandar"
      ? `// Hangfire (usa Cronos: 5 campos, o 6 con segundos adelante)\nRecurringJob.AddOrUpdate<MiJob>(\n    "mi-job",\n    job => job.Correr(),\n    "${expresion}",\n    new RecurringJobOptions { TimeZone = ${tz} });`
      : `// Hangfire usa Cronos, no Quartz: convertí la expresión con el botón "Ver en estándar".`;
    const quartz = modo === "quartz"
      ? `// Quartz.NET\nvar trigger = TriggerBuilder.Create()\n    .WithIdentity("mi-trigger")\n    .WithCronSchedule("${expresion}", x => x.InTimeZone(${tz}))\n    .Build();`
      : `// Quartz.NET necesita el campo de segundos: convertí la expresión con el botón "Ver en Quartz".`;
    const ncrontab = modo === "estandar"
      ? `// NCrontab (sin zona horaria: calcula en la hora que le pases)\nvar schedule = CrontabSchedule.Parse("${expresion}");\nvar proxima = schedule.GetNextOccurrence(DateTime.Now);`
      : `// NCrontab acepta 6 campos con segundos si lo parseás con IncludingSeconds = true,\n// pero no entiende ?, L, W ni #.`;
    return { hangfire, quartz, ncrontab };
  }

  /* ---------- Formato de fechas ---------- */

  function formatearFecha(ms, zona) {
    const p = partes(ms, zona);
    const dow = DIAS[new Date(instante(p.anio, p.mes, p.dia, 12, 0, 0, "UTC")).getUTCDay()];
    return `${dow} ${dos(p.dia)}/${dos(p.mes)}/${p.anio} ${dos(p.hora)}:${dos(p.min)}:${dos(p.seg)}`;
  }

  function relativo(ms, desde) {
    const d = Math.round((ms - desde) / 1000);
    if (d < 60) return `en ${d} s`;
    if (d < 3600) return `en ${Math.round(d / 60)} min`;
    if (d < 86400) { const h = Math.floor(d / 3600), m = Math.round((d % 3600) / 60); return `en ${h} h${m ? ` ${m} min` : ""}`; }
    const dias = Math.floor(d / 86400), h = Math.round((d % 86400) / 3600);
    if (dias < 30) return `en ${dias} día${dias === 1 ? "" : "s"}${h ? ` ${h} h` : ""}`;
    if (dias < 365) return `en ${Math.round(dias / 30.44)} meses`;
    return `en ${(dias / 365.25).toFixed(1)} años`;
  }

  function duracion(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    if (s < 3600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
    if (s < 86400) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return m ? `${h} h ${m} min` : `${h} h`; }
    const d = Math.floor(s / 86400), h = Math.round((s % 86400) / 3600);
    return h ? `${d} d ${h} h` : `${d} día${d === 1 ? "" : "s"}`;
  }

  const EJEMPLOS = [
    { nombre: "Cada 5 minutos", expr: "*/5 * * * *" },
    { nombre: "Todos los días a las 3:00", expr: "0 3 * * *" },
    { nombre: "Lunes a viernes 9:00", expr: "0 9 * * MON-FRI" },
    { nombre: "Cada 15 min en horario laboral", expr: "*/15 8-18 * * 1-5" },
    { nombre: "El 1 de cada mes", expr: "0 0 1 * *" },
    { nombre: "Quartz: cada 30 segundos", expr: "*/30 * * * * ?" },
    { nombre: "Quartz: último viernes 18:00", expr: "0 0 18 ? * 6L" },
    { nombre: "Quartz: último día hábil", expr: "0 30 23 LW * ?" },
    { nombre: "Quartz: segundo martes 10:00", expr: "0 0 10 ? * TUE#2" },
  ];

  const API = {
    parsear, ErrorCron, proximas, describir, convertir, snippets, partes, instante, zonaValida, formatearFecha,
    relativo, duracion, diaHabilCercano, diaCoincide, MACROS, EJEMPLOS, CAMPOS, MESES, DIAS,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else raiz.Cron = API;
})(typeof window !== "undefined" ? window : globalThis);
