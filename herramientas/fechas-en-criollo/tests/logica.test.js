const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../logica.js');
const AR = 'America/Argentina/Buenos_Aires';

test('Argentina está 3 horas atrás de UTC todo el año', () => {
  assert.equal(F.offsetMin(Date.UTC(2026, 0, 15, 12), AR), -180);
  assert.equal(F.offsetMin(Date.UTC(2026, 6, 15, 12), AR), -180);
  assert.equal(F.offsetMin(Date.UTC(2026, 6, 15, 12), 'UTC'), 0);
});
test('zonas con horario de verano cambian de desfase', () => {
  assert.equal(F.offsetMin(Date.UTC(2026, 0, 15, 12), 'Europe/Madrid'), 60);
  assert.equal(F.offsetMin(Date.UTC(2026, 6, 15, 12), 'Europe/Madrid'), 120);
  assert.equal(F.offsetMin(Date.UTC(2026, 0, 15, 12), 'America/New_York'), -300);
});
test('epoch en segundos y en milisegundos (1700000000 = 14/11/2023 22:13:20 UTC)', () => {
  const a = F.interpretar('1700000000', AR), b = F.interpretar('1700000000000', AR);
  assert.equal(a.ms, 1700000000000); assert.equal(b.ms, 1700000000000);
  assert.match(a.tipo, /segundos/); assert.match(b.tipo, /milisegundos/);
  const u = F.formatear(a.ms, 'UTC'); assert.equal(u.texto, '14/11/2023 22:13:20'); assert.equal(u.dia, 'martes');
  assert.equal(F.formatear(a.ms, AR).texto, '14/11/2023 19:13:20');
});
test('ticks de .NET: 621355968000000000 es el 1/1/1970', () => {
  assert.equal(F.interpretar('621355968000000000', 'UTC').ms, 0);
  assert.equal(F.ticks(0), '621355968000000000');
  assert.equal(F.ticks(1700000000000), '638355968000000000');
  assert.equal(F.interpretar(F.ticks(1700000000123), 'UTC').ms, 1700000000123);
});
test('ISO con Z o con desfase', () => {
  assert.equal(F.interpretar('2026-11-13T07:00:00Z', AR).ms, Date.UTC(2026, 10, 13, 7));
  assert.equal(F.interpretar('2026-11-13T04:00:00-03:00', 'UTC').ms, Date.UTC(2026, 10, 13, 7));
  assert.equal(F.interpretar('2026-11-13 04:00:00-0300', 'UTC').ms, Date.UTC(2026, 10, 13, 7));
});
test('hora sin zona se toma en la zona elegida', () => {
  assert.equal(F.interpretar('2026-11-13 04:00', AR).ms, Date.UTC(2026, 10, 13, 7));
  assert.equal(F.interpretar('13/11/2026 04:00', AR).ms, Date.UTC(2026, 10, 13, 7));
  assert.equal(F.interpretar('13/11/2026 04:00', 'UTC').ms, Date.UTC(2026, 10, 13, 4));
  assert.equal(F.interpretar('2026-07-01', 'Europe/Madrid').ms, Date.UTC(2026, 5, 30, 22));
});
test('fecha inexistente o formato raro devuelve error, sin explotar', () => {
  assert.ok(F.interpretar('31/02/2026', AR).error);
  assert.ok(F.interpretar('hola', AR).error);
  assert.ok(F.interpretar('', AR).error);
  assert.ok(F.interpretar('2026-13-01', AR).error);
  assert.ok(F.interpretar('2026-11-13 25:00', AR).error);
});
test('formatear: ISO con desfase, medianoche como 00 y día de la semana', () => {
  const f = F.formatear(Date.UTC(2026, 10, 13, 3, 0, 0), AR);
  assert.equal(f.iso, '2026-11-13T00:00:00-03:00'); assert.equal(f.offset, 'UTC-03:00'); assert.equal(f.dia, 'viernes');
  assert.equal(F.formatear(0, 'UTC').iso, '1970-01-01T00:00:00Z');
});
test('el reloj de una base MySQL en UTC: 07:00 UTC es 04:00 en Argentina', () => {
  assert.equal(F.formatear(F.interpretar('2026-11-13 07:00:00', 'UTC').ms, AR).texto, '13/11/2026 04:00:00');
});
test('diferencia entre dos instantes', () => {
  const d = F.diferencia(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 3, 5, 30, 15));
  assert.deepEqual([d.signo, d.dias, d.horas, d.minutos, d.segundos], [1, 2, 5, 30, 15]);
  assert.equal(F.diferencia(10000, 0).signo, -1);
});
test('csharp incluye el epoch en ms', () => {
  assert.match(F.csharp(1700000000000), /FromUnixTimeMilliseconds\(1700000000000L\)/);
});
