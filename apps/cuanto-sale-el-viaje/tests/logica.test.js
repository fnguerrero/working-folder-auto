const test = require('node:test');
const assert = require('node:assert');
const { calcular, pesos, resumen } = require('../logica.js');

const base = { km: 100, consumo: 8, precioLitro: 1000, peajes: 500, estacionamiento: 2000, desgasteKm: 50, personas: 2, idaVuelta: true };

test('ida y vuelta duplica km y peajes, no el estacionamiento', () => {
  const r = calcular(base);
  assert.strictEqual(r.kmTotal, 200);
  assert.strictEqual(r.nafta, 16000);
  assert.strictEqual(r.peajes, 1000);
  assert.strictEqual(r.estacionamiento, 2000);
  assert.strictEqual(r.desgaste, 10000);
  assert.strictEqual(r.total, 29000);
  assert.strictEqual(r.porPersona, 14500);
  assert.strictEqual(r.sinDesgaste, 19000);
  assert.strictEqual(r.porKm, 145);
});
test('solo ida', () => {
  assert.strictEqual(calcular({ ...base, idaVuelta: false }).kmTotal, 100);
});
test('entradas inválidas valen cero y personas mínimo 1', () => {
  const r = calcular({ km: 'x', consumo: -3, precioLitro: null, personas: 0 });
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.personas, 1);
  assert.strictEqual(r.porKm, 0);
});
test('alternativa: conviene o no', () => {
  assert.strictEqual(calcular({ ...base, alternativa: 20000 }).autoConviene, true);
  const r = calcular({ ...base, alternativa: 10000 });
  assert.strictEqual(r.autoConviene, false);
  assert.strictEqual(r.diferencia, 4500);
  assert.strictEqual(r.personasParaEmpatar, 3); // 29000/3 = 9666 < 10000
});
test('empate exacto necesita una persona más', () => {
  const r = calcular({ ...base, alternativa: 14500 });
  assert.strictEqual(r.autoConviene, false);
  assert.strictEqual(r.personasParaEmpatar, 3);
});
test('formato y resumen', () => {
  assert.strictEqual(pesos(1234.6), '$' + (1235).toLocaleString('es-AR'));
  assert.ok(resumen(base, calcular(base)).includes('por persona'));
});
