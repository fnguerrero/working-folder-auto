'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const PF = require('../lib.js');
const A = require('../actualizar.js');

const raiz = path.join(__dirname, '..');
const leer = (f) => fs.readFileSync(path.join(raiz, 'datos', f), 'utf8').replace(/\r\n/g, '\n');
const csv = Object.fromEntries(Object.entries(A.ARCHIVOS).map(([k, f]) => [k, leer(f)]));
const datos = PF.armarDatos(csv);
const cerca = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} no está cerca de ${b}`);

/* Datos de juguete, con cuentas hechas a mano. */
const juguete = PF.armarDatos({
  plazoFijo: 'mes,tna_pct\n2020-01,36.5\n2020-02,73\n2020-03,36.5\n',
  dolar: 'mes,oficial\n2020-01,100\n2020-02,110\n2020-03,90\n',
  inflacionIndec: 'mes,var_pct\n2020-01,1\n',
  ipcCaba: 'mes,indice\n',
  ipcNacional: 'mes,indice\n2019-12,100\n2020-01,110\n2020-02,121\n2020-03,133.1\n2020-04,146.41\n',
});

/* ---------- datos del repo ---------- */

test('cada serie es mensual, sin huecos ni repetidos, y con fuente en cada fila', () => {
  const rangos = {
    plazo_fijo: ['2004-01', '2026-09'], dolar: ['2004-01', '2026-09'], inflacion_indec: ['2004-01', '2026-10'],
    ipc_caba: ['2012-07', '2016-12'], ipc_nacional: ['2016-12', '2026-10'],
  };
  for (const [serie, columna] of Object.entries(A.SERIES)) {
    const { filas } = PF.parseCSV(leer(`${serie}.csv`));
    const [desde, hasta] = rangos[serie];
    assert.ok(filas[0].mes === desde, serie);
    assert.ok(filas[filas.length - 1].mes >= hasta, serie);
    filas.forEach((f, i) => {
      assert.equal(f.mes, PF.sumar(desde, i), `${serie} fila ${i}`);
      assert.notEqual(PF.leerNumero(f[columna]), null, `${serie} ${f.mes}`);
      assert.ok(f.fuente.length > 5, `${serie} ${f.mes} sin fuente`);
    });
  }
});

function comparar(a, colA, b, colB, tolerancia, relativa) {
  const A_ = PF.mapa(a, colA);
  const B_ = PF.mapa(b, colB);
  let n = 0;
  const malos = [];
  for (const [mes, v] of B_) {
    if (!A_.has(mes)) continue;
    n++;
    const dif = relativa ? Math.abs(A_.get(mes) / v - 1) : Math.abs(A_.get(mes) - v);
    if (dif > tolerancia) malos.push(`${mes}: ${A_.get(mes)} vs ${v}`);
  }
  return { n, malos };
}

test('cotejo dólar: las dos publicaciones difieren menos de 0,5 %', () => {
  const r = comparar(csv.dolar, 'oficial', leer('cotejo/dolar_175.csv'), 'oficial', 0.005, true);
  assert.equal(r.n, 273);
  assert.deepEqual(r.malos, []);
});

test('cotejo tasa: iguales hasta 2009-06 y menos de 9 % de diferencia después', () => {
  const b = leer('cotejo/plazo_fijo_174.csv');
  const r = comparar(csv.plazoFijo, 'tna_pct', b, 'tna_pct', 0.09, true);
  assert.equal(r.n, 268);
  assert.deepEqual(r.malos, []);
  const antes = comparar(csv.plazoFijo, 'tna_pct', b.split('\n').slice(0, 67).join('\n'), 'tna_pct', 0.0002, false);
  assert.equal(antes.n, 66);
  assert.deepEqual(antes.malos, []);
});

test('cotejo INDEC 2004-2006: la API del BCRA coincide con datos.gob.ar (redondeo a un decimal)', () => {
  const r = comparar(csv.inflacionIndec, 'var_pct', leer('cotejo/ipc_gba_96.csv'), 'var_pct', 0.051);
  assert.equal(r.n, 36);
  assert.deepEqual(r.malos, []);
});

test('cotejo CABA: la variación calculada desde el índice coincide con la que publica la API', () => {
  const calculada = PF.variaciones(PF.mapa(csv.ipcCaba, 'indice'));
  const publicada = PF.mapa(leer('cotejo/ipc_caba_var.csv'), 'var_pct');
  assert.equal(publicada.size, 53);
  for (const [mes, v] of publicada) cerca(calculada.get(mes), v, 0.001);
});

test('cotejo IPC nacional contra BCRA: sólo difieren los cuatro meses documentados de 2017', () => {
  const nac = PF.variaciones(PF.mapa(csv.ipcNacional, 'indice'));
  const bcra = PF.mapa(csv.inflacionIndec, 'var_pct');
  const distintos = [...nac].filter(([m, v]) => Math.abs(v - bcra.get(m)) > 0.051).map(([m]) => m);
  assert.deepEqual(distintos, ['2017-01', '2017-02', '2017-04', '2017-05']);
});

test('cotejo BCRA diario: el promedio por día corrido reproduce el dólar mensual', () => {
  const muestra = PF.parseCSV(leer('cotejo/bcra_diario_muestra.csv')).filas;
  for (const mes of ['2014-01', '2026-09']) {
    // Enero de 2014 necesita además el último cierre de 2013 (el 1/1 fue feriado).
    const filas = muestra.filter((f) => f.serie === 'dolar' && (f.fecha.startsWith(mes) || (mes === '2014-01' && f.fecha.startsWith('2013-12'))));
    const texto = 'fecha,valor\n' + filas.map((f) => `${f.fecha},${f.valor}`).join('\n');
    const v = A.leerFuente(texto, 'valor', true).get(mes);
    cerca(v / datos.dolar.get(mes), 1, 0.0002);
  }
});

test('cotejo BCRA diario: la tasa a 30 días queda a menos de 5 % de la mensual usada', () => {
  const muestra = PF.parseCSV(leer('cotejo/bcra_diario_muestra.csv')).filas;
  for (const mes of ['2014-01', '2026-09']) {
    const v = muestra.filter((f) => f.serie === 'plazo_fijo' && f.fecha.startsWith(mes)).map((f) => Number(f.valor));
    assert.equal(v.length, 22);
    cerca(v.reduce((a, b) => a + b) / v.length / datos.pf.get(mes), 1, 0.05);
  }
});

test('la serie de referencia no tiene huecos y usa San Luis de 2007-01 a 2012-07', () => {
  assert.equal(PF.huecos(datos.inflacion.referencia, '2004-01', '2026-10').length, 0);
  assert.equal(PF.huecos(datos.inflacion.indec, '2004-01', '2026-10').length, 0);
  const sl = PF.parseCSV(leer('cotejo/ipc_san_luis_var.csv')).filas;
  assert.equal(sl.length, 72);
  for (const f of sl) {
    if (f.mes > '2012-07') continue;
    cerca(datos.inflacion.referencia.get(f.mes), Number(f.var_pct), 2e-4);
  }
});

/* Mismos datos sin San Luis: sirve para probar cómo se comporta la cuenta cuando falta inflación. */
const sinSanLuis = PF.armarDatos({ ...csv, ipcSanLuis: 'mes,indice\n' });

test('sin carga del usuario no hay blue', () => {
  assert.equal(datos.blue.size, 0);
  assert.deepEqual(PF.disponibles(datos), ['pf', 'dolar', 'nada']);
});

test('datos.js está al día con los CSV', () => {
  const actual = fs.readFileSync(path.join(raiz, 'datos.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(actual, A.generarDatosJs(raiz));
});

/* ---------- cuentas ---------- */

test('plazo fijo: los tres modos de renovación', () => {
  // 36,5 % TNA * 30/365 = 3 %; 73 % = 6 %
  const c = (renovacion) => PF.curva(juguete, 'pf', '2020-01', '2020-03', { renovacion });
  [1, 1.03, 1.0918].forEach((v, i) => cerca(c('compuesto')[i], v));
  [1, 1.03, 1.09].forEach((v, i) => cerca(c('capital')[i], v));
  [1, 1.03, 1.03].forEach((v, i) => cerca(c('una')[i], v));
});

test('dólar y pesos quietos', () => {
  [1, 1.1, 0.9].forEach((v, i) => cerca(PF.curva(juguete, 'dolar', '2020-01', '2020-03')[i], v));
  assert.deepEqual(PF.curva(juguete, 'nada', '2020-01', '2020-03'), [1, 1, 1]);
  assert.equal(PF.curva(juguete, 'blue', '2020-01', '2020-03'), null);
});

test('mezcla: promedio ponderado, sin rebalanceo, y proporcional si no suma 100', () => {
  const c = PF.curva(juguete, 'mezcla', '2020-01', '2020-03', { mezcla: { pf: 25, dolar: 25 } });
  cerca(c[2], (1.0918 + 0.9) / 2);
  assert.equal(PF.curva(juguete, 'mezcla', '2020-01', '2020-03', { mezcla: { pf: 0 } }), null);
});

test('simular: nominal, pesos de hoy y variación real', () => {
  const r = PF.simular(juguete, { desde: '2020-01', hasta: '2020-03', monto: 1000 });
  assert.equal(r.mesHoy, '2020-04');
  cerca(r.inflacionPeriodo, 21, 1e-9);
  const nada = r.resultados.find((x) => x.estrategia === 'nada');
  cerca(nada.nominal, 1000);
  cerca(nada.hoy, 1100, 1e-9);
  cerca(nada.variacionReal, (1 / 1.21 - 1) * 100, 1e-9);
  cerca(nada.curvaHoy[0], 1000 * 1.331, 1e-9);
});

test('simular: con hueco de inflación da nominal pero no inventa lo real', () => {
  const r = PF.simular(sinSanLuis, { desde: '2008-01', hasta: '2010-01', monto: 100 });
  assert.equal(r.inflacionPeriodo, null);
  for (const x of r.resultados) {
    assert.ok(x.nominal > 0);
    assert.equal(x.hoy, null);
    assert.equal(x.variacionReal, null);
  }
});

test('simular: entrada antes del hueco y salida después permite pesos de hoy pero no la variación real', () => {
  const r = PF.simular(sinSanLuis, { desde: '2010-01', hasta: '2020-01', monto: 100 });
  assert.equal(r.inflacionPeriodo, null);
  assert.ok(r.resultados[0].hoy > 0);
});

test('simular rechaza entradas inválidas', () => {
  const base = { desde: '2020-01', hasta: '2020-03', monto: 100 };
  assert.ok(PF.simular(juguete, { ...base, monto: 0 }).error);
  assert.ok(PF.simular(juguete, { ...base, monto: null }).error);
  assert.ok(PF.simular(juguete, { ...base, hasta: '2020-01' }).error);
  assert.ok(PF.simular(juguete, { ...base, hasta: '2021-01' }).error);
});

test('ventanas, resumen y rachas', () => {
  const v = PF.ventanas(juguete, 1);
  assert.deepEqual(v.map((x) => x.ganador), ['dolar', 'pf']);
  cerca(v[0].margen, (1.1 / 1.03 - 1) * 100);
  assert.deepEqual(PF.resumen(v).ganadas, { dolar: 1, pf: 1 });
  assert.equal(PF.rachas(v).length, 2);
  const unidas = PF.rachas([{ ganador: 'pf', desde: '2020-01', margen: 2 }, { ganador: 'pf', desde: '2020-02', margen: 4 }]);
  assert.equal(unidas[0].cantidad, 2);
  cerca(unidas[0].margenPromedio, 3);
  cerca(unidas[0].margenMaximo, 4);
});

test('las cifras del ANALISIS.md salen del código', () => {
  const r = PF.resumen(PF.ventanas(datos, 12));
  assert.equal(r.total, 261);
  assert.deepEqual(r.ganadas, { pf: 145, dolar: 116 });
  const s = PF.simular(datos, { desde: '2019-12', hasta: '2026-09', monto: 100000 });
  assert.deepEqual(s.resultados.map((x) => Math.round(x.nominal)), [2147925, 2528046, 100000]);
});

/* ---------- carga y actualización ---------- */

test('números en formato argentino', () => {
  assert.equal(PF.leerNumero('1.234,5'), 1234.5);
  assert.equal(PF.leerNumero('1234.5'), 1234.5);
  assert.equal(PF.leerNumero(''), null);
  assert.equal(PF.leerNumero('abc'), null);
});

test('carga del usuario: acepta punto y coma, y no pisa la serie de referencia', () => {
  const c = PF.leerCargaUsuario('mes;dolar_blue;inflacion_alt_pct\n2007-01;3,5;2\n2020-01;80;99\n');
  assert.deepEqual(c.errores, []);
  const d = PF.armarDatos({ ...csv, ipcSanLuis: 'mes,indice\n' }, c);
  assert.equal(d.blue.get('2007-01'), 3.5);
  assert.equal(d.inflacion.referencia.get('2007-01'), 2);
  assert.equal(d.inflacion.referencia.get('2020-01'), datos.inflacion.referencia.get('2020-01'));
  assert.deepEqual(PF.disponibles(d), ['pf', 'dolar', 'blue', 'nada']);
});

test('carga del usuario: con un error no carga nada', () => {
  for (const t of ['a,b\n1,2', 'mes,dolar_blue\n2020-13,5', 'mes,dolar_blue\n2020-01,5\n2020-01,6', 'mes,dolar_blue\n2020-01,5\n2020-02,-1', 'mes,dolar_blue\n']) {
    const c = PF.leerCargaUsuario(t);
    assert.ok(c.errores.length, t);
    assert.equal(c.blue.size + c.alt.size, 0, t);
  }
});

test('el ejemplo viene rotulado como inventado y se puede cargar', () => {
  const c = PF.leerCargaUsuario(csv.ejemplo);
  assert.deepEqual(c.errores, []);
  assert.equal(c.inventado, true);
  assert.equal(c.alt.size, 67);
});

test('actualizar: promedio por día corrido y descarte de meses incompletos', () => {
  const t = 'indice_tiempo,serie\n2026-01-30,10\n2026-02-02,20\n2026-02-27,20\n2026-03-02,30\n';
  const m = A.leerFuente(t, null, true);
  cerca(m.get('2026-02'), Math.round(((10 + 27 * 20) / 28) * 1e4) / 1e4);
  assert.equal(m.has('2026-03'), false);
  assert.throws(() => A.leerFuente(t, null, false), /--diario/);
});

test('actualizar: agrega, no pisa sin permiso y no deja huecos', () => {
  const base = 'mes,oficial,fuente\n2026-01,10,x\n';
  const r = A.fusionar(base, 'oficial', new Map([['2026-01', 11], ['2026-02', 12]]), 'BCRA, hoy', false);
  assert.equal(r.texto, 'mes,oficial,fuente\n2026-01,10,x\n2026-02,12,"BCRA, hoy"\n');
  assert.equal(r.informe.distintos.length, 1);
  assert.equal(PF.parseCSV(r.texto).filas[1].fuente, 'BCRA, hoy');
  assert.match(A.fusionar(base, 'oficial', new Map([['2026-01', 11]]), 'y', true).texto, /2026-01,11,y/);
  assert.throws(() => A.fusionar(base, 'oficial', new Map([['2026-03', 1]]), 'y', false), /hueco/);
});
