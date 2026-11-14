(function (root) {
  'use strict';
  var TICKS_EPOCH = 621355968000000000n; // ticks de .NET al 1/1/1970 UTC
  var ZONAS = [
    ['UTC', 'UTC'], ['America/Argentina/Buenos_Aires', 'Argentina (Buenos Aires)'], ['America/Montevideo', 'Uruguay'],
    ['America/Santiago', 'Chile'], ['America/Sao_Paulo', 'Brasil (São Paulo)'], ['America/Mexico_City', 'México'],
    ['America/New_York', 'Nueva York'], ['Europe/Madrid', 'España (Madrid)'], ['Europe/London', 'Londres']
  ];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function pad(n, l) { n = String(n); while (n.length < (l || 2)) n = '0' + n; return n; }

  // Partes de fecha de un instante (ms) en una zona.
  function partes(ms, tz) {
    var f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var o = {};
    f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second };
  }
  // Desfase de la zona en minutos respecto de UTC en ese instante.
  function offsetMin(ms, tz) {
    var p = partes(ms, tz);
    var comoUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
    return Math.round((comoUtc - Math.floor(ms / 1000) * 1000) / 60000);
  }
  function etiquetaOffset(min) {
    var s = min < 0 ? '-' : '+', a = Math.abs(min);
    return 'UTC' + s + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }
  // Hora de pared en una zona -> instante (ms). Resuelve el desfase iterando (cubre cambios de horario).
  function paredAInstante(y, mo, d, h, mi, s, tz) {
    var guess = Date.UTC(y, mo - 1, d, h, mi, s);
    var t = guess - offsetMin(guess, tz) * 60000;
    t = guess - offsetMin(t, tz) * 60000;
    return t;
  }

  // Interpreta lo que pegó el usuario. Devuelve { ms, tipo } o { error }.
  function interpretar(texto, tz) {
    var t = String(texto == null ? '' : texto).trim();
    if (!t) return { error: 'vacío' };
    var m;
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      var dig = t.replace(/^-/, '').split('.')[0].length;
      if (dig >= 17 && t.indexOf('.') < 0) { // ticks de .NET
        var ms = Number((BigInt(t) - TICKS_EPOCH) / 10000n);
        return { ms: ms, tipo: 'ticks de .NET (100 ns desde el año 1)' };
      }
      var n = Number(t);
      if (dig <= 11) return { ms: Math.round(n * 1000), tipo: 'epoch en segundos' };
      if (dig <= 14) return { ms: Math.round(n), tipo: 'epoch en milisegundos' };
      return { ms: Math.round(n / 1000), tipo: 'epoch en microsegundos' };
    }
    // ISO 8601 con Z o con desfase explícito
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})$/i.test(t)) {
      var ms2 = Date.parse(t.replace(' ', 'T').replace(/\s+/g, '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
      return isNaN(ms2) ? { error: 'fecha inválida' } : { ms: ms2, tipo: 'ISO 8601 con desfase' };
    }
    // ISO sin desfase o dd/mm/aaaa [hh:mm[:ss]] -> hora de pared en la zona elegida
    var y, mo, d, h = 0, mi = 0, s = 0, ok = false;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/.exec(t))) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0); ok = true; }
    else if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t))) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0); ok = true; }
    if (!ok) return { error: 'no reconozco el formato' };
    var chk = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
    if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return { error: 'fecha inexistente' };
    return { ms: paredAInstante(y, mo, d, h, mi, s, tz), tipo: 'hora sin zona, tomada como ' + tz };
  }

  function formatear(ms, tz) {
    var p = partes(ms, tz), off = offsetMin(ms, tz);
    return {
      texto: pad(p.d) + '/' + pad(p.mo) + '/' + p.y + ' ' + pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s),
      iso: p.y + '-' + pad(p.mo) + '-' + pad(p.d) + 'T' + pad(p.h) + ':' + pad(p.mi) + ':' + pad(p.s) + (off === 0 ? 'Z' : (off < 0 ? '-' : '+') + pad(Math.floor(Math.abs(off) / 60)) + ':' + pad(Math.abs(off) % 60)),
      offset: etiquetaOffset(off), offsetMin: off,
      dia: DIAS[new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay()]
    };
  }

  function ticks(ms) { return (BigInt(ms) * 10000n + TICKS_EPOCH).toString(); }

  // Diferencia entre dos instantes, en partes.
  function diferencia(a, b) {
    var ms = Math.abs(b - a), s = Math.floor(ms / 1000);
    return { signo: b >= a ? 1 : -1, dias: Math.floor(s / 86400), horas: Math.floor(s % 86400 / 3600), minutos: Math.floor(s % 3600 / 60), segundos: s % 60, totalHoras: Math.round(ms / 36000) / 100 };
  }

  function csharp(ms) {
    return [
      'var instante = DateTimeOffset.FromUnixTimeMilliseconds(' + ms + 'L);',
      'var ar = TimeZoneInfo.ConvertTime(instante, TimeZoneInfo.FindSystemTimeZoneById("Argentina Standard Time"));',
      '// En Linux el id es "America/Argentina/Buenos_Aires"; en .NET 6+ ambos funcionan en las dos plataformas.'
    ].join('\n');
  }

  var api = { ZONAS: ZONAS, partes: partes, offsetMin: offsetMin, paredAInstante: paredAInstante, interpretar: interpretar, formatear: formatear, ticks: ticks, diferencia: diferencia, csharp: csharp };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Fechas = api;
})(typeof self !== 'undefined' ? self : this);
