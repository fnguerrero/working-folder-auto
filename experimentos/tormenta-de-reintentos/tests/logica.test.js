const test = require('node:test');
const assert = require('node:assert');
const R = require('../logica.js');

const sinFallas = { fallaBase: 0, fallaCaida: 0, lentitudCaida: 1, capacidad: 500 };

test('sin fallas no hay reintentos ni cortes', () => {
  const r = R.simular(Object.assign({}, sinFallas, { reintentos: 5, timeout: 20000 }));
  assert.strictEqual(r.totales.reintentos, 0);
  assert.strictEqual(r.totales.intentos, r.totales.pedidos);
  assert.strictEqual(r.exito, 1);
  assert.strictEqual(r.aperturas, 0);
});

test('con todo fallando, cada pedido hace 1 + N intentos', () => {
  const r = R.simular({ fallaBase: 1, fallaCaida: 1, lentitudCaida: 1, capacidad: 2000, reintentos: 3, breaker: false, timeout: 20000 });
  assert.strictEqual(r.totales.intentos, r.totales.pedidos * 4);
  assert.strictEqual(r.exito, 0);
});

test('los pedidos terminan todos, bien o mal', () => {
  for (const c of Object.values(R.ESCENARIOS)) {
    const r = R.simular(c);
    assert.strictEqual(r.totales.bien + r.totales.mal, r.totales.pedidos);
  }
});

test('misma semilla, mismo resultado; el tráfico no depende de la política', () => {
  assert.deepStrictEqual(R.simular({}), R.simular({}));
  const [a, b] = [R.simular({ reintentos: 0 }), R.simular({ reintentos: 8 })];
  assert.strictEqual(a.totales.pedidos, b.totales.pedidos);
});

test('la tasa de llegadas es la pedida', () => {
  const r = R.simular({ rps: 300, duracion: 60 });
  assert.ok(Math.abs(r.totales.pedidos - 18000) < 600, String(r.totales.pedidos));
});

test('el backoff exponencial baja la carga pico frente al fijo', () => {
  const base = { reintentos: 5, jitter: false, breaker: false, espera: 100, esperaMax: 20000, capacidad: 400 };
  const fijo = R.simular(Object.assign({}, base, { backoff: 'fijo' }));
  const exp = R.simular(Object.assign({}, base, { backoff: 'exponencial' }));
  assert.ok(exp.pico < fijo.pico, `${exp.pico} vs ${fijo.pico}`);
});

test('el breaker reduce la carga durante la caída', () => {
  for (const semilla of [1, 7, 99]) {
    const con = R.simular({ semilla, breaker: true });
    const sin = R.simular({ semilla, breaker: false });
    assert.ok(con.amplificacionCaida < sin.amplificacionCaida);
    assert.ok(con.totales.cortados > 0);
    assert.ok(con.aperturas > 0);
  }
});

test('los reintentos ingenuos amplifican más que la política cuidada', () => {
  const l = Object.fromEntries(R.comparar({}).map(x => [x.clave, x.r]));
  assert.strictEqual(l.sin.amplificacion, 1);
  assert.ok(l.ingenuos.amplificacionCaida > 2);
  assert.ok(l.cuidados.amplificacionCaida < l.ingenuos.amplificacionCaida);
});

test('breaker: abre, prueba una sola vez y cierra o reabre', () => {
  const b = R.crearBreaker(0.5, 4, 10000, 5000);
  for (let i = 0; i < 3; i++) b.anotar(i, true, 'normal');
  assert.strictEqual(b.estado, 'cerrado');
  b.anotar(3, true, 'normal');
  assert.strictEqual(b.estado, 'abierto');
  assert.strictEqual(b.pedir(100), null);
  assert.strictEqual(b.pedir(5003), 'prueba');
  assert.strictEqual(b.pedir(5004), null);
  b.anotar(5100, true, 'prueba');
  assert.strictEqual(b.estado, 'abierto');
  assert.strictEqual(b.pedir(10100), 'prueba');
  b.anotar(10200, false, 'prueba');
  assert.strictEqual(b.estado, 'cerrado');
  assert.strictEqual(b.aperturas, 2);
});

test('breaker: las fallas viejas salen de la ventana', () => {
  const b = R.crearBreaker(0.5, 4, 1000, 500);
  for (let i = 0; i < 3; i++) b.anotar(i, true, 'normal');
  for (let i = 0; i < 4; i++) b.anotar(5000 + i, false, 'normal');
  b.anotar(5010, true, 'normal');
  assert.strictEqual(b.estado, 'cerrado');
});

test('espera: fija, exponencial, tope y jitter', () => {
  const c = { backoff: 'exponencial', espera: 100, esperaMax: 500, jitter: false };
  assert.deepStrictEqual([1, 2, 3, 4].map(n => R.espera(c, n)), [100, 200, 400, 500]);
  assert.strictEqual(R.espera(Object.assign({}, c, { backoff: 'fijo' }), 4), 100);
  assert.strictEqual(R.espera(Object.assign({}, c, { jitter: true }), 3, () => 0.5), 200);
});

test('el montículo saca en orden y respeta la llegada en los empates', () => {
  const m = new R.Monticulo();
  [5, 1, 3, 1, 4].forEach((t, i) => m.meter(t, 'x', i));
  const sale = [];
  for (let e = m.sacar(); e; e = m.sacar()) sale.push([e.t, e.dato]);
  assert.deepStrictEqual(sale, [[1, 1], [1, 3], [3, 2], [4, 4], [5, 0]]);
});

test('normalizar acota valores raros', () => {
  const c = R.normalizar({ rps: 'hola', reintentos: 99, caidaDesde: 50, caidaHasta: 10, backoff: 'x' });
  assert.strictEqual(c.rps, R.BASE.rps);
  assert.strictEqual(c.reintentos, 10);
  assert.ok(c.caidaHasta >= c.caidaDesde);
  assert.strictEqual(c.backoff, 'exponencial');
});

test('el snippet de C# refleja la política', () => {
  const s = R.csharp({ reintentos: 4, backoff: 'fijo', jitter: false, breaker: false, timeout: 750 });
  assert.match(s, /MaxRetryAttempts = 4/);
  assert.match(s, /DelayBackoffType\.Constant/);
  assert.match(s, /UseJitter = false/);
  assert.match(s, /AddTimeout\(TimeSpan\.FromMilliseconds\(750\)\)/);
  assert.doesNotMatch(s, /CircuitBreaker/);
  assert.doesNotMatch(R.csharp({ reintentos: 0 }), /AddRetry/);
});

test('diagnóstico: ingenuos en rojo y sin incidente en verde', () => {
  const sin = R.simular(R.ESCENARIOS.sin);
  assert.strictEqual(R.diagnosticar(R.simular(R.ESCENARIOS.ingenuos), sin).nivel, 'rojo');
  const tranqui = R.simular({ caidaDesde: 0, caidaHasta: 0, fallaBase: 0, timeout: 5000 });
  assert.strictEqual(R.diagnosticar(tranqui).nivel, 'verde');
});
