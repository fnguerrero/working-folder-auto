// Visor de logs: parseo de Serilog (compact y normal), NLog JSON, JsonConsoleFormatter y texto plano; filtros, agrupado y export.
(function (raiz) {
  'use strict';

  const NIVELES = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const MAPA_NIVEL = {
    verbose: 'trace', trace: 'trace', trce: 'trace', vrb: 'trace', debug: 'debug', dbug: 'debug', dbg: 'debug',
    information: 'info', info: 'info', inf: 'info', informational: 'info',
    warning: 'warn', warn: 'warn', wrn: 'warn',
    error: 'error', err: 'error', fail: 'error', failed: 'error',
    fatal: 'fatal', ftl: 'fatal', critical: 'fatal', crit: 'fatal', emergency: 'fatal'
  };
  function normNivel(v) {
    if (v == null) return 'info';
    if (typeof v === 'number') return NIVELES[Math.max(0, Math.min(5, v))] || 'info'; // 0..5 como LogLevel de .NET
    return MAPA_NIVEL[String(v).trim().toLowerCase()] || 'info';
  }

  // Sin zona horaria se toma como UTC (así el resultado no depende de la compu).
  const RE_FECHA = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d):(\d\d)(?:[.,](\d{1,7}))?\s*(Z|[+-]\d\d(?::?\d\d)?)?$/;
  function parseHora(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    const m = RE_FECHA.exec(String(v).trim());
    if (!m) { const d = Date.parse(String(v)); return isNaN(d) ? null : d; }
    const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0;
    let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
    if (m[8] && m[8] !== 'Z') {
      const s = m[8][0] === '-' ? -1 : 1, d = m[8].slice(1).replace(':', '');
      t -= s * ((+d.slice(0, 2)) * 60 + (+(d.slice(2) || 0))) * 60000;
    }
    return t;
  }
  function fmtHora(t) {
    if (t == null) return '';
    const d = new Date(t);
    return d.toISOString().replace('T', ' ').replace('Z', '');
  }

  function aplanar(obj, prefijo, out) {
    for (const k of Object.keys(obj)) {
      const v = obj[k], clave = prefijo ? prefijo + '.' + k : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length && Object.keys(v).length <= 30 && !('_typeTag' in v)) aplanar(v, clave, out);
      else out[clave] = v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    }
    return out;
  }

  function renderPlantilla(mt, props) {
    return String(mt).replace(/\{\{|\}\}|\{[@$]?([\w.]+)(?:[,:][^}]*)?\}/g, (s, n) => {
      if (s === '{{') return '{'; if (s === '}}') return '}';
      if (!(n in props)) return s;
      const v = props[n];
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  }

  function filaVacia() { return { t: null, nivel: 'info', msg: '', ex: '', cat: '', props: {}, fmt: '' }; }

  // Devuelve una fila o null si el objeto no se parece a un log.
  function desdeObjeto(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const f = filaVacia();
    if ('@t' in o || '@mt' in o || '@m' in o) { // Serilog.Formatting.Compact
      f.fmt = 'Serilog compact';
      f.t = parseHora(o['@t']); f.nivel = normNivel(o['@l']); f.ex = o['@x'] || '';
      const resto = {}; for (const k of Object.keys(o)) if (k[0] !== '@') resto[k] = o[k]; else if (k === '@i') resto.EventId = o[k];
      if (o['@tr']) resto.TraceId = o['@tr']; if (o['@sp']) resto.SpanId = o['@sp'];
      f.props = aplanar(resto, '', {});
      f.msg = o['@m'] != null ? String(o['@m']) : o['@mt'] != null ? renderPlantilla(o['@mt'], resto) : '';
      if (o['@mt']) f.props.MessageTemplate = o['@mt'];
      return f;
    }
    if ('Timestamp' in o && 'LogLevel' in o || 'LogLevel' in o && 'Category' in o) { // JsonConsoleFormatter
      f.fmt = 'ASP.NET JsonConsole';
      f.t = parseHora(o.Timestamp); f.nivel = normNivel(o.LogLevel); f.cat = o.Category || '';
      f.msg = o.Message != null ? String(o.Message) : ''; f.ex = o.Exception || '';
      const p = {}; if (o.EventId != null) p.EventId = o.EventId;
      if (o.State && typeof o.State === 'object') for (const k of Object.keys(o.State)) if (k !== 'Message' && k !== '{OriginalFormat}') p[k] = o.State[k];
      if (Array.isArray(o.Scopes)) o.Scopes.forEach(s => { if (s && typeof s === 'object') for (const k of Object.keys(s)) if (k !== 'Message') p[k] = s[k]; });
      f.props = aplanar(p, '', {});
      if (!f.t) f.t = null;
      return f;
    }
    if ('Level' in o && ('Timestamp' in o || 'MessageTemplate' in o || 'RenderedMessage' in o)) { // Serilog JSON normal
      f.fmt = 'Serilog';
      f.t = parseHora(o.Timestamp); f.nivel = normNivel(o.Level); f.ex = o.Exception || '';
      const p = o.Properties && typeof o.Properties === 'object' ? o.Properties : {};
      f.props = aplanar(p, '', {});
      f.msg = o.RenderedMessage != null ? String(o.RenderedMessage) : o.MessageTemplate ? renderPlantilla(o.MessageTemplate, p) : '';
      if (o.MessageTemplate) f.props.MessageTemplate = o.MessageTemplate;
      if (f.props.SourceContext) f.cat = String(f.props.SourceContext);
      return f;
    }
    const kt = ['time', 'timestamp', 'date', '@timestamp', 'ts', 'Time'].find(k => k in o);
    const kl = ['level', 'Level', 'severity', 'lvl', 'loglevel'].find(k => k in o);
    const km = ['message', 'Message', 'msg', 'formattedMessage', 'FormattedMessage', 'rendered'].find(k => k in o);
    if (kl || km || kt) { // NLog JsonLayout y genéricos
      f.fmt = kl && kt && (o.logger || o.exception || o.Logger) ? 'NLog JSON' : 'JSON genérico';
      f.t = kt ? parseHora(o[kt]) : null; f.nivel = normNivel(kl ? o[kl] : null);
      f.msg = km ? String(o[km]) : '';
      const ke = ['exception', 'Exception', 'error', 'stack', 'stackTrace'].find(k => k in o && typeof o[k] === 'string');
      f.ex = ke ? o[ke] : '';
      f.cat = o.logger || o.Logger || o.category || o.Category || '';
      const rest = {}; for (const k of Object.keys(o)) if (![kt, kl, km, ke].includes(k)) rest[k] = o[k];
      if (rest.exception && typeof rest.exception === 'object') rest.exception = JSON.stringify(rest.exception);
      if (o.properties && typeof o.properties === 'object') { delete rest.properties; Object.assign(rest, o.properties); }
      f.props = aplanar(rest, '', {});
      if (f.cat) delete f.props.logger; return f;
    }
    return null;
  }

  const RE_TXT = /^\[?(\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:[.,]\d+)?(?:\s?(?:Z|[+-]\d\d:?\d\d))?)\]?\s*(?:[\[|]?\s*(VRB|DBG|INF|WRN|ERR|FTL|TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRIT(?:ICAL)?)\s*[\]|]?)?\s*(.*)$/i;
  const RE_MS = /^(trce|dbug|info|warn|fail|crit): (.*?)\[(\d+)\]\s*$/;

  // Una línea de texto. Devuelve { fila } o { cont: texto } si es continuación (stack trace) de la fila anterior.
  function parseLineaTexto(linea) {
    let m = RE_TXT.exec(linea);
    if (m) {
      const f = filaVacia(); f.fmt = 'Texto';
      f.t = parseHora(m[1].replace(/\s+/g, '').replace(',', '.').replace(/^(\S{10})(?=\d\d:)/, '$1 ')) ?? parseHora(m[1]);
      f.nivel = m[2] ? normNivel(m[2]) : 'info'; f.msg = m[3];
      const c = /^\[([\w.]+)\]\s+(.*)$/.exec(f.msg); // [Categoría] mensaje
      if (c && c[1].indexOf('.') > 0) { f.cat = c[1]; f.msg = c[2]; }
      return { fila: f };
    }
    m = RE_MS.exec(linea);
    if (m) { const f = filaVacia(); f.fmt = 'Consola .NET'; f.nivel = normNivel(m[1]); f.cat = m[2]; f.props = { EventId: +m[3] }; return { fila: f, pendiente: true }; }
    return { cont: linea };
  }

  // Parsea de a líneas conservando estado (para leer por pedazos).
  function crearParser() {
    const rows = []; let ultima = null, esperaMs = null, n = 0;
    return {
      rows,
      linea(linea, fuente) {
        n++;
        if (!linea.trim()) return;
        const c = linea.charCodeAt(0);
        let f = null;
        if (c === 123 /* { */ && linea.charCodeAt(linea.length - 1) === 125) {
          try { f = desdeObjeto(JSON.parse(linea)); } catch (e) { f = null; }
        }
        if (!f) {
          const r = parseLineaTexto(linea);
          if (r.fila && r.pendiente) { esperaMs = r.fila; ultima = null; return; }
          if (r.fila) f = r.fila;
          else if (esperaMs) { esperaMs.msg = esperaMs.msg ? esperaMs.msg + '\n' + linea.trim() : linea.trim(); f = esperaMs; esperaMs = null; f.t = f.t ?? ultimaHora(rows); f.n = n; f.fuente = fuente || ''; f.i = rows.length; rows.push(f); ultima = f; return; }
          else {
            if (esperaMs) { esperaMs = null; }
            if (ultima) { ultima.ex += (ultima.ex ? '\n' : '') + linea; return; }
            f = filaVacia(); f.fmt = 'Texto'; f.msg = linea;
          }
        } else esperaMs = null;
        f.n = n; f.fuente = fuente || ''; f.i = rows.length; rows.push(f); ultima = f;
      }
    };
  }
  function ultimaHora(rows) { for (let i = rows.length - 1; i >= 0 && i > rows.length - 5; i--) if (rows[i].t != null) return rows[i].t; return null; }

  function parsearTexto(texto, fuente) {
    const p = crearParser();
    for (const l of texto.split(/\r?\n/)) p.linea(l, fuente);
    return p.rows;
  }

  // ---- Filtros ----
  // Tokens de propiedad: clave=valor, clave!=valor, clave~valor (contiene), clave (existe). Varios separados por espacio; comillas para valores con espacio.
  function parsearProps(s) {
    const out = [], re = /([\w.@$-]+)\s*(!=|~|=)?\s*(?:"([^"]*)"|(\S+))?/g; let m;
    s = (s || '').trim();
    while (s && (m = re.exec(s)) && m[0]) {
      out.push({ k: m[1], op: m[2] || 'existe', v: m[3] != null ? m[3] : m[4] != null ? m[4] : '' });
    }
    return out.filter(x => x.op === 'existe' || x.v !== '' || x.op === '=');
  }
  function buscarClave(props, k) {
    if (k in props) return k;
    const kl = k.toLowerCase();
    for (const c of Object.keys(props)) if (c.toLowerCase() === kl) return c;
    return null;
  }
  function crearFiltro(opc) {
    const niveles = opc.niveles || null, texto = (opc.texto || '').toLowerCase(), pr = parsearProps(opc.props);
    const desde = opc.desde ?? null, hasta = opc.hasta ?? null, fuente = opc.fuente || '';
    let re = null; if (opc.regex && texto) { try { re = new RegExp(opc.texto, 'i'); } catch (e) { re = null; } }
    return function (f) {
      if (niveles && !niveles.has(f.nivel)) return false;
      if (fuente && f.fuente !== fuente) return false;
      if (desde != null && (f.t == null || f.t < desde)) return false;
      if (hasta != null && (f.t == null || f.t > hasta)) return false;
      for (const q of pr) {
        const c = buscarClave(f.props, q.k); const v = c == null ? null : String(f.props[c]);
        if (q.op === 'existe') { if (c == null) return false; }
        else if (q.op === '=') { if (v == null || v.toLowerCase() !== q.v.toLowerCase()) return false; }
        else if (q.op === '!=') { if (v != null && v.toLowerCase() === q.v.toLowerCase()) return false; }
        else if (v == null || !v.toLowerCase().includes(q.v.toLowerCase())) return false;
      }
      if (texto) {
        if (re) { if (!re.test(f.msg) && !re.test(f.ex) && !Object.values(f.props).some(x => re.test(String(x)))) return false; }
        else if (!textoDe(f).includes(texto)) return false;
      }
      return true;
    };
  }
  function textoDe(f) {
    if (f._tx === undefined) f._tx = (f.msg + '\n' + f.ex + '\n' + f.cat + '\n' + Object.values(f.props).join('\n')).toLowerCase();
    return f._tx;
  }
  function filtrar(rows, opc) { const fn = crearFiltro(opc); return rows.filter(fn); }

  function contarNiveles(rows) { const c = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 }; for (const r of rows) c[r.nivel]++; return c; }

  const CLAVES_PETICION = ['RequestId', 'TraceId', 'CorrelationId', 'CorrelationID', 'ConnectionId', 'RequestPath'];
  function claveDePeticion(rows) {
    const cuenta = {};
    for (let i = 0; i < Math.min(rows.length, 5000); i++) for (const k of CLAVES_PETICION) if (rows[i].props[k] != null) cuenta[k] = (cuenta[k] || 0) + 1;
    return CLAVES_PETICION.filter(k => cuenta[k]).sort((a, b) => cuenta[b] - cuenta[a]);
  }
  const PESO = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };
  function agrupar(rows, clave) {
    const m = new Map();
    for (const r of rows) {
      const k = r.props[clave]; if (k == null) continue;
      let g = m.get(k); if (!g) { g = { valor: String(k), n: 0, desde: r.t, hasta: r.t, peor: 'trace', primera: r.msg }; m.set(k, g); }
      g.n++; if (r.t != null) { if (g.desde == null || r.t < g.desde) g.desde = r.t; if (g.hasta == null || r.t > g.hasta) g.hasta = r.t; }
      if (PESO[r.nivel] > PESO[g.peor]) g.peor = r.nivel;
    }
    return [...m.values()].sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0) || b.n - a.n);
  }

  function ordenarPorHora(rows) { // estable: sin hora queda donde estaba
    return rows.map((r, i) => [r, i]).sort((a, b) => (a[0].t ?? a[1]) === (b[0].t ?? b[1]) ? a[1] - b[1] : (a[0].t == null || b[0].t == null ? a[1] - b[1] : a[0].t - b[0].t)).map(x => x[0]);
  }

  // ---- Export ----
  function aCSV(rows, sep) {
    sep = sep || ',';
    const claves = []; const vistos = new Set();
    for (const r of rows) for (const k of Object.keys(r.props)) if (!vistos.has(k)) { vistos.add(k); claves.push(k); }
    const esc = v => { v = v == null ? '' : String(v); return /[",;\n\r]/.test(v) || v.includes(sep) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const cab = ['hora', 'nivel', 'categoria', 'mensaje', 'excepcion'].concat(claves);
    const lineas = [cab.map(esc).join(sep)];
    for (const r of rows) lineas.push([fmtHora(r.t), r.nivel, r.cat, r.msg, r.ex].concat(claves.map(k => r.props[k])).map(esc).join(sep));
    return lineas.join('\r\n');
  }
  function aJSON(rows) {
    return JSON.stringify(rows.map(r => ({ hora: r.t != null ? new Date(r.t).toISOString() : null, nivel: r.nivel, categoria: r.cat || undefined, mensaje: r.msg, excepcion: r.ex || undefined, propiedades: r.props })), null, 2);
  }

  const api = { NIVELES, normNivel, parseHora, fmtHora, desdeObjeto, parseLineaTexto, crearParser, parsearTexto, parsearProps, filtrar, crearFiltro, contarNiveles, claveDePeticion, agrupar, ordenarPorHora, aCSV, aJSON, renderPlantilla };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.Logs = api;
})(typeof self !== 'undefined' ? self : this);
