/* Lógica del comparador. Sirve igual en el navegador (window.PF) y en Node (require). */
(function (raiz) {
  'use strict';

  const DIAS = 30; // un plazo fijo "mensual": TNA * 30 / 365

  const aNum = (mes) => { const [a, m] = mes.split('-').map(Number); return a * 12 + m - 1; };
  const aMes = (n) => Math.floor(n / 12) + '-' + String((n % 12) + 1).padStart(2, '0');
  const sumar = (mes, k) => aMes(aNum(mes) + k);

  function leerNumero(txt) {
    let s = String(txt == null ? '' : txt).trim().replace(/[$%\s]/g, '');
    if (s === '') return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // formato argentino
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  /* CSV simple: separador coma o punto y coma, comillas opcionales, líneas # ignoradas. */
  function parseCSV(texto) {
    const lineas = String(texto).replace(/^﻿/, '').split(/\r?\n/)
      .filter((l) => l.trim() !== '' && !l.startsWith('#'));
    if (!lineas.length) return { columnas: [], filas: [] };
    const sep = lineas[0].includes(';') ? ';' : ',';
    const partir = (l) => {
      const out = []; let campo = ''; let comillas = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (comillas) {
          if (c === '"' && l[i + 1] === '"') { campo += '"'; i++; }
          else if (c === '"') comillas = false;
          else campo += c;
        } else if (c === '"') comillas = true;
        else if (c === sep) { out.push(campo); campo = ''; }
        else campo += c;
      }
      out.push(campo);
      return out.map((x) => x.trim());
    };
    const columnas = partir(lineas[0]);
    const filas = lineas.slice(1).map((l) => {
      const v = partir(l);
      return Object.fromEntries(columnas.map((c, i) => [c, v[i] === undefined ? '' : v[i]]));
    });
    return { columnas, filas };
  }

  function mapa(texto, columna) {
    const m = new Map();
    for (const f of parseCSV(texto).filas) {
      const v = leerNumero(f[columna]);
      if (v !== null) m.set(f.mes, v);
    }
    return m;
  }

  /* Variación mensual (%) a partir de un índice: sólo si está el mes anterior. */
  function variaciones(indice) {
    const out = new Map();
    for (const [mes, v] of indice) {
      const prev = indice.get(sumar(mes, -1));
      if (prev) out.set(mes, (v / prev - 1) * 100);
    }
    return out;
  }

  /* CSV que carga el usuario: mes, dolar_blue y/o inflacion_alt_pct. */
  function leerCargaUsuario(texto) {
    const { columnas, filas } = parseCSV(texto);
    const errores = [];
    const blue = new Map();
    const alt = new Map();
    if (!columnas.includes('mes')) errores.push('Falta la columna "mes".');
    if (!columnas.includes('dolar_blue') && !columnas.includes('inflacion_alt_pct')) {
      errores.push('Tiene que haber una columna "dolar_blue" o "inflacion_alt_pct".');
    }
    if (!errores.length) {
      filas.forEach((f, i) => {
        const mes = f.mes;
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { errores.push(`Fila ${i + 2}: mes inválido "${mes}" (va AAAA-MM).`); return; }
        for (const [col, destino, valido] of [
          ['dolar_blue', blue, (v) => v > 0],
          ['inflacion_alt_pct', alt, (v) => v > -50 && v < 500],
        ]) {
          if (!f[col]) continue;
          const v = leerNumero(f[col]);
          if (v === null || !valido(v)) errores.push(`Fila ${i + 2}: valor inválido en ${col}: "${f[col]}".`);
          else if (destino.has(mes)) errores.push(`Fila ${i + 2}: el mes ${mes} está repetido en ${col}.`);
          else destino.set(mes, v);
        }
      });
      if (!errores.length && !blue.size && !alt.size) errores.push('El archivo no trae ningún valor.');
    }
    // Si hay un solo error no se carga nada: mejor eso que una serie a medias.
    const inventado = /INVENTAD/i.test(texto);
    return errores.length ? { errores, blue: new Map(), alt: new Map(), inventado } : { errores, blue, alt, inventado };
  }

  /*
   * csv: { plazoFijo, dolar, inflacionIndec, ipcCaba, ipcNacional } (texto de cada archivo)
   * carga: resultado de leerCargaUsuario (opcional)
   */
  function armarDatos(csv, carga) {
    const pf = mapa(csv.plazoFijo, 'tna_pct');
    const oficial = mapa(csv.dolar, 'oficial');
    const indec = mapa(csv.inflacionIndec, 'var_pct');
    const caba = variaciones(mapa(csv.ipcCaba, 'indice'));
    const nacional = variaciones(mapa(csv.ipcNacional, 'indice'));
    // Serie de referencia: INDEC hasta 2006, CABA 2012-08..2016-12, INDEC nacional desde 2017.
    const referencia = new Map();
    for (const [m, v] of indec) if (m <= '2006-12') referencia.set(m, v);
    for (const [m, v] of caba) if (m <= '2016-12') referencia.set(m, v);
    for (const [m, v] of nacional) if (m >= '2017-01') referencia.set(m, v);
    const blue = (carga && carga.blue) || new Map();
    // Lo que carga el usuario sólo llena huecos; nunca pisa la serie del repo.
    if (carga && carga.alt) for (const [m, v] of carga.alt) if (!referencia.has(m)) referencia.set(m, v);
    const comunes = [...pf.keys()].filter((m) => oficial.has(m)).sort();
    return {
      pf, dolar: oficial, blue, inflacion: { referencia, indec },
      desde: comunes[0], hasta: comunes[comunes.length - 1], meses: comunes,
    };
  }

  /* Factor de precios entre el mes a y el mes b (b >= a). null si falta algún mes. */
  function factorPrecios(serie, a, b) {
    let f = 1;
    for (let n = aNum(a) + 1; n <= aNum(b); n++) {
      const v = serie.get(aMes(n));
      if (v === undefined) return null;
      f *= 1 + v / 100;
    }
    return f;
  }

  function huecos(serie, a, b) {
    const out = [];
    for (let n = aNum(a) + 1; n <= aNum(b); n++) if (!serie.has(aMes(n))) out.push(aMes(n));
    return out;
  }

  const ultimoMes = (serie) => [...serie.keys()].sort().pop();

  /* Cuánto vale 1 peso puesto en `desde`, mirado en cada mes hasta `hasta`. null si falta dato. */
  function curva(datos, estrategia, desde, hasta, opciones) {
    const op = Object.assign({}, opciones);
    op.renovacion = op.renovacion || 'compuesto';
    op.mezcla = op.mezcla || { pf: 50, dolar: 50, blue: 0, nada: 0 };
    const largo = aNum(hasta) - aNum(desde);
    if (largo < 0) return null;
    if (estrategia === 'nada') return Array(largo + 1).fill(1);
    if (estrategia === 'dolar' || estrategia === 'blue') {
      const s = datos[estrategia];
      const inicio = s.get(desde);
      if (!inicio) return null;
      const out = [];
      for (let i = 0; i <= largo; i++) {
        const v = s.get(sumar(desde, i));
        if (!v) return null;
        out.push(v / inicio);
      }
      return out;
    }
    if (estrategia === 'pf') {
      const out = [1];
      let capital = 1;
      for (let i = 0; i < largo; i++) {
        const tna = datos.pf.get(sumar(desde, i));
        if (tna === undefined) return null;
        const r = (tna / 100) * (DIAS / 365);
        if (op.renovacion === 'compuesto') capital *= 1 + r;
        else if (op.renovacion === 'capital') capital += r;
        else if (op.renovacion === 'una') { if (i === 0) capital = 1 + r; }
        else throw new Error('Renovación desconocida: ' + op.renovacion);
        out.push(capital);
      }
      return out;
    }
    if (estrategia === 'mezcla') {
      const partes = Object.entries(op.mezcla).filter(([, p]) => p > 0);
      const total = partes.reduce((s, [, p]) => s + p, 0);
      if (!total) return null;
      const out = Array(largo + 1).fill(0);
      for (const [nombre, peso] of partes) {
        const c = curva(datos, nombre, desde, hasta, op);
        if (!c) return null;
        c.forEach((v, i) => { out[i] += v * (peso / total); });
      }
      return out; // se compra al principio y no se rebalancea
    }
    throw new Error('Estrategia desconocida: ' + estrategia);
  }

  function disponibles(datos) {
    return datos.blue.size ? ['pf', 'dolar', 'blue', 'nada'] : ['pf', 'dolar', 'nada'];
  }

  function simular(datos, p) {
    const monto = p.monto;
    if (!(monto > 0)) return { error: 'El monto tiene que ser mayor que cero.' };
    if (!datos.pf.has(p.desde) || !datos.pf.has(p.hasta)) return { error: `Elegí meses entre ${datos.desde} y ${datos.hasta}.` };
    if (aNum(p.hasta) <= aNum(p.desde)) return { error: 'El mes de salida tiene que ser posterior al de entrada.' };
    const inflacion = datos.inflacion[p.inflacion || 'referencia'];
    const hoy = ultimoMes(inflacion);
    const aHoy = factorPrecios(inflacion, p.hasta, hoy);
    const periodo = factorPrecios(inflacion, p.desde, p.hasta);
    const lista = disponibles(datos).concat(p.estrategias && p.estrategias.includes('mezcla') ? ['mezcla'] : []);
    const resultados = [];
    for (const e of lista) {
      const c = curva(datos, e, p.desde, p.hasta, p);
      if (!c) { resultados.push({ estrategia: e, sinDato: true }); continue; }
      const mult = c[c.length - 1];
      const curvaHoy = c.map((v, i) => {
        const f = factorPrecios(inflacion, sumar(p.desde, i), hoy);
        return f === null ? null : monto * v * f;
      });
      resultados.push({
        estrategia: e,
        nominal: monto * mult,
        hoy: aHoy === null ? null : monto * mult * aHoy,
        variacionNominal: (mult - 1) * 100,
        variacionReal: periodo === null ? null : (mult / periodo - 1) * 100,
        curvaNominal: c.map((v) => monto * v),
        curvaHoy,
      });
    }
    return {
      resultados,
      mesHoy: hoy,
      inflacionPeriodo: periodo === null ? null : (periodo - 1) * 100,
      huecosPeriodo: huecos(inflacion, p.desde, p.hasta),
      huecosHastaHoy: huecos(inflacion, p.hasta, hoy),
      meses: Array.from({ length: aNum(p.hasta) - aNum(p.desde) + 1 }, (_, i) => sumar(p.desde, i)),
    };
  }

  /* Todas las ventanas de n meses: quién ganó (en pesos nominales) y por cuánto sobre el segundo. */
  function ventanas(datos, n, opciones) {
    const op = opciones || {};
    const nombres = op.estrategias || disponibles(datos);
    const inflacion = datos.inflacion[op.inflacion || 'referencia'];
    const out = [];
    for (const desde of datos.meses) {
      const hasta = sumar(desde, n);
      if (hasta > datos.hasta) break;
      const finales = [];
      for (const e of nombres) {
        const c = curva(datos, e, desde, hasta, op);
        if (c) finales.push([e, c[c.length - 1]]);
      }
      if (finales.length !== nombres.length) continue; // sólo se compara con todas presentes
      finales.sort((a, b) => b[1] - a[1]);
      const margen = (finales[0][1] / finales[1][1] - 1) * 100;
      const periodo = factorPrecios(inflacion, desde, hasta);
      out.push({
        desde, hasta,
        ganador: margen < 1e-9 ? 'empate' : finales[0][0],
        segundo: finales[1][0],
        margen,
        finales: Object.fromEntries(finales),
        ganoInflacion: periodo === null ? null
          : Object.fromEntries(finales.map(([e, m]) => [e, m > periodo])),
      });
    }
    return out;
  }

  function resumen(lista) {
    const r = { total: lista.length, ganadas: {}, conInflacion: 0, leGanaron: {} };
    for (const v of lista) {
      r.ganadas[v.ganador] = (r.ganadas[v.ganador] || 0) + 1;
      if (v.ganoInflacion) {
        r.conInflacion++;
        for (const [e, si] of Object.entries(v.ganoInflacion)) r.leGanaron[e] = (r.leGanaron[e] || 0) + (si ? 1 : 0);
      }
    }
    return r;
  }

  /* Agrupa meses de entrada consecutivos con el mismo ganador. */
  function rachas(lista) {
    const out = [];
    for (const v of lista) {
      const u = out[out.length - 1];
      if (u && u.ganador === v.ganador && sumar(u.hastaEntrada, 1) === v.desde) {
        u.hastaEntrada = v.desde; u.cantidad++; u.suma += v.margen; u.max = Math.max(u.max, v.margen);
      } else {
        out.push({ ganador: v.ganador, desdeEntrada: v.desde, hastaEntrada: v.desde, cantidad: 1, suma: v.margen, max: v.margen });
      }
    }
    return out.map((u) => ({
      ganador: u.ganador, desdeEntrada: u.desdeEntrada, hastaEntrada: u.hastaEntrada,
      cantidad: u.cantidad, margenPromedio: u.suma / u.cantidad, margenMaximo: u.max,
    }));
  }

  const api = {
    DIAS, aNum, aMes, sumar, leerNumero, parseCSV, mapa, variaciones, leerCargaUsuario, armarDatos,
    factorPrecios, huecos, ultimoMes, curva, disponibles, simular, ventanas, resumen, rachas,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.PF = api;
})(typeof window !== 'undefined' ? window : this);
