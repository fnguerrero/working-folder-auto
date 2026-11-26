#!/usr/bin/env node
/*
 * Agrega meses a datos/*.csv desde un CSV bajado a mano de la fuente, y regenera datos.js.
 *
 *   node actualizar.js                     sólo regenera datos.js
 *   node actualizar.js <serie> <archivo.csv> --fuente "texto" [--columna nombre] [--diario] [--pisar]
 *
 * series: plazo_fijo | dolar | inflacion_indec | ipc_nacional | ipc_caba
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PF = require('./lib.js');

const SERIES = {
  plazo_fijo: 'tna_pct',
  dolar: 'oficial',
  inflacion_indec: 'var_pct',
  ipc_nacional: 'indice',
  ipc_caba: 'indice',
};

const ARCHIVOS = {
  plazoFijo: 'plazo_fijo.csv',
  dolar: 'dolar.csv',
  inflacionIndec: 'inflacion_indec.csv',
  ipcCaba: 'ipc_caba.csv',
  ipcNacional: 'ipc_nacional.csv',
  ejemplo: 'ejemplo-INVENTADO.csv',
};

/* Fecha AAAA-MM[-DD] o DD/MM/AAAA -> { mes, dia } */
function leerFecha(txt) {
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(txt);
  if (m) return { mes: `${m[1]}-${m[2]}`, dia: Number(m[3] || 1) };
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(txt);
  if (m) return { mes: `${m[3]}-${m[2].padStart(2, '0')}`, dia: Number(m[1]) };
  return null;
}

/*
 * Devuelve Map mes -> valor. Con diario=true promedia por día CORRIDO (los días sin dato repiten
 * el último), que es como promedia la API de datos.gob.ar la serie del dólar. Descarta un mes
 * si el archivo no llega hasta sus últimos días.
 */
function leerFuente(texto, columna, diario) {
  const { columnas, filas } = PF.parseCSV(texto);
  const colFecha = columnas.find((c) => ['indice_tiempo', 'mes', 'fecha'].includes(c.toLowerCase()));
  if (!colFecha) throw new Error('No encuentro la columna de fecha (indice_tiempo, mes o fecha).');
  const colValor = columna || (columnas.length === 2 ? columnas.find((c) => c !== colFecha) : null);
  if (!colValor || !columnas.includes(colValor)) {
    throw new Error(`Indicá la columna con --columna. Hay: ${columnas.join(', ')}`);
  }
  const datos = [];
  for (const f of filas) {
    const fecha = leerFecha(f[colFecha]);
    const v = PF.leerNumero(f[colValor]);
    if (f[colValor] === '') continue;
    if (!fecha || v === null) throw new Error(`Fila ilegible: ${f[colFecha]} / ${f[colValor]}`);
    datos.push({ ...fecha, v });
  }
  datos.sort((a, b) => (a.mes === b.mes ? a.dia - b.dia : a.mes < b.mes ? -1 : 1));
  const out = new Map();
  if (!diario) {
    for (const d of datos) {
      if (out.has(d.mes)) throw new Error(`El mes ${d.mes} aparece dos veces: ¿es diario? Usá --diario.`);
      out.set(d.mes, d.v);
    }
    return out;
  }
  const porMes = new Map();
  for (const d of datos) {
    if (!porMes.has(d.mes)) porMes.set(d.mes, new Map());
    porMes.get(d.mes).set(d.dia, d.v);
  }
  let anterior = null;
  for (const [mes, dias] of porMes) {
    const [a, m] = mes.split('-').map(Number);
    const largo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    let ultimo = anterior;
    let suma = 0;
    let n = 0;
    for (let d = 1; d <= largo; d++) {
      if (dias.has(d)) ultimo = dias.get(d);
      if (ultimo !== null) { suma += ultimo; n++; }
    }
    anterior = ultimo;
    if (Math.max(...dias.keys()) >= largo - 4) out.set(mes, Math.round((suma / n) * 1e4) / 1e4);
  }
  return out;
}

function fusionar(textoActual, columna, nuevos, fuente, pisar) {
  const { filas } = PF.parseCSV(textoActual);
  const por = new Map(filas.map((f) => [f.mes, f]));
  const informe = { agregados: [], pisados: [], distintos: [] };
  for (const [mes, v] of nuevos) {
    const actual = por.get(mes);
    if (!actual) {
      por.set(mes, { mes, [columna]: String(v), fuente });
      informe.agregados.push(mes);
    } else if (Math.abs(Number(actual[columna]) - v) > 1e-3) {
      if (pisar) {
        por.set(mes, { mes, [columna]: String(v), fuente });
        informe.pisados.push(mes);
      } else informe.distintos.push(`${mes}: repo ${actual[columna]} / archivo ${v}`);
    }
  }
  const campo = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const meses = [...por.keys()].sort();
  // Sólo se agregan meses pegados a la serie: un salto sería un error de archivo.
  for (let i = 1; i < meses.length; i++) {
    if (PF.sumar(meses[i - 1], 1) !== meses[i]) throw new Error(`Quedaría un hueco entre ${meses[i - 1]} y ${meses[i]}.`);
  }
  const texto = `mes,${columna},fuente\n` + meses.map((m) => {
    const f = por.get(m);
    return [m, f[columna], f.fuente].map(campo).join(',');
  }).join('\n') + '\n';
  return { texto, informe };
}

function generarDatosJs(dir) {
  const obj = {};
  for (const [clave, archivo] of Object.entries(ARCHIVOS)) {
    obj[clave] = fs.readFileSync(path.join(dir, 'datos', archivo), 'utf8').replace(/\r\n/g, '\n');
  }
  return '/* Generado por actualizar.js a partir de datos/*.csv. No editar a mano. */\n'
    + `window.DATOS = ${JSON.stringify(obj, null, 1)};\n`;
}

function principal(args) {
  const dir = __dirname;
  const [serie, archivo] = args;
  if (serie) {
    const op = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
    if (!SERIES[serie] || !archivo) throw new Error(`Uso: node actualizar.js <${Object.keys(SERIES).join('|')}> <archivo.csv> --fuente "texto"`);
    const fuente = op('--fuente');
    if (!fuente) throw new Error('Falta --fuente "de dónde salió (URL y fecha)".');
    const destino = path.join(dir, 'datos', `${serie}.csv`);
    const nuevos = leerFuente(fs.readFileSync(archivo, 'utf8'), op('--columna'), args.includes('--diario'));
    const { texto, informe } = fusionar(fs.readFileSync(destino, 'utf8'), SERIES[serie], nuevos, fuente, args.includes('--pisar'));
    fs.writeFileSync(destino, texto);
    console.log(`Agregados: ${informe.agregados.join(', ') || 'ninguno'}`);
    if (informe.pisados.length) console.log(`Pisados: ${informe.pisados.join(', ')}`);
    if (informe.distintos.length) console.log(`Distintos (no se tocaron, usá --pisar):\n  ${informe.distintos.join('\n  ')}`);
  }
  fs.writeFileSync(path.join(dir, 'datos.js'), generarDatosJs(dir));
  console.log('datos.js regenerado.');
}

module.exports = { leerFuente, fusionar, generarDatosJs, SERIES, ARCHIVOS };
if (require.main === module) {
  try { principal(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
}
