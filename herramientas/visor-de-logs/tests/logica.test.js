const test = require('node:test');
const assert = require('node:assert');
const L = require('../logica.js');

test('Serilog compact: plantilla renderizada, nivel por defecto y excepción', () => {
  const r = L.parsearTexto([
    '{"@t":"2026-11-03T10:00:00.1234567Z","@mt":"Pedido {PedidoId} de {Cliente:l} creado","PedidoId":42,"Cliente":"Ana","RequestId":"r1"}',
    '{"@t":"2026-11-03T10:00:01Z","@mt":"Falló","@l":"Error","@x":"System.Exception: boom\\n   at A.B()","RequestId":"r1"}'
  ].join('\n'));
  assert.equal(r.length, 2);
  assert.equal(r[0].fmt, 'Serilog compact');
  assert.equal(r[0].msg, 'Pedido 42 de Ana creado');
  assert.equal(r[0].nivel, 'info');
  assert.equal(r[0].t, Date.UTC(2026, 10, 3, 10, 0, 0, 123));
  assert.equal(r[1].nivel, 'error');
  assert.match(r[1].ex, /at A\.B/);
  assert.equal(r[1].props.RequestId, 'r1');
});

test('Serilog JSON normal', () => {
  const r = L.parsearTexto('{"Timestamp":"2026-11-03T07:00:00.000-03:00","Level":"Warning","MessageTemplate":"Lento {Ms} ms","Properties":{"Ms":900,"SourceContext":"Api.Foo","Datos":{"a":1}}}');
  assert.equal(r[0].fmt, 'Serilog');
  assert.equal(r[0].nivel, 'warn');
  assert.equal(r[0].msg, 'Lento 900 ms');
  assert.equal(r[0].t, Date.UTC(2026, 10, 3, 10, 0, 0));
  assert.equal(r[0].cat, 'Api.Foo');
  assert.equal(r[0].props['Datos.a'], 1);
});

test('JsonConsoleFormatter de ASP.NET', () => {
  const r = L.parsearTexto('{"Timestamp":"2026-11-03T10:00:00.000Z","EventId":1,"LogLevel":"Information","Category":"Microsoft.Hosting.Lifetime","Message":"Now listening","State":{"Message":"Now listening","address":"http://localhost:5000","{OriginalFormat}":"Now listening on: {address}"},"Scopes":[{"RequestId":"abc"}]}');
  assert.equal(r[0].fmt, 'ASP.NET JsonConsole');
  assert.equal(r[0].cat, 'Microsoft.Hosting.Lifetime');
  assert.equal(r[0].props.address, 'http://localhost:5000');
  assert.equal(r[0].props.RequestId, 'abc');
});

test('NLog JSON', () => {
  const r = L.parsearTexto('{"time":"2026-11-03 10:00:00.5","level":"FATAL","logger":"App.Main","message":"Se cayó","exception":"System.Boom","user":"x"}');
  assert.equal(r[0].nivel, 'fatal');
  assert.equal(r[0].ex, 'System.Boom');
  assert.equal(r[0].cat, 'App.Main');
  assert.equal(r[0].t, Date.UTC(2026, 10, 3, 10, 0, 0, 500));
  assert.equal(r[0].props.user, 'x');
});

test('texto plano: nivel, hora y stack trace como continuación', () => {
  const r = L.parsearTexto([
    '2026-11-03 10:00:00.123 [ERR] Algo salió mal',
    '   at Foo.Bar() in C:\\x.cs:line 3',
    'System.Exception: otra',
    '2026-11-03 10:00:01,000 INFO listo'
  ].join('\n'));
  assert.equal(r.length, 2);
  assert.equal(r[0].nivel, 'error');
  assert.equal(r[0].msg, 'Algo salió mal');
  assert.match(r[0].ex, /Foo\.Bar[\s\S]*otra/);
  assert.equal(r[1].nivel, 'info');
  assert.equal(r[1].t, Date.UTC(2026, 10, 3, 10, 0, 1, 0));
});

test('consola de .NET (dos líneas por entrada)', () => {
  const r = L.parsearTexto('warn: Microsoft.AspNetCore.Hosting[4]\n      Request slow\ninfo: App[0]\n      ok');
  assert.equal(r.length, 2);
  assert.equal(r[0].nivel, 'warn'); assert.equal(r[0].cat, 'Microsoft.AspNetCore.Hosting'); assert.equal(r[0].msg, 'Request slow');
});

test('filtros combinados: nivel, texto, propiedad y tiempo', () => {
  const rows = L.parsearTexto([
    '{"@t":"2026-11-03T10:00:00Z","@mt":"uno","UserId":1}',
    '{"@t":"2026-11-03T10:05:00Z","@mt":"dos fallo","@l":"Error","UserId":2}',
    '{"@t":"2026-11-03T10:10:00Z","@mt":"tres fallo","@l":"Error","UserId":1}'
  ].join('\n'));
  assert.equal(L.filtrar(rows, { niveles: new Set(['error']) }).length, 2);
  assert.equal(L.filtrar(rows, { texto: 'FALLO', props: 'UserId=1' }).length, 1);
  assert.equal(L.filtrar(rows, { props: 'userid!=1' }).length, 1);
  assert.equal(L.filtrar(rows, { props: 'UserId~' }).length, 3);
  assert.equal(L.filtrar(rows, { desde: Date.UTC(2026, 10, 3, 10, 3), hasta: Date.UTC(2026, 10, 3, 10, 7) }).length, 1);
  assert.equal(L.filtrar(rows, { texto: 'f.llo', regex: true }).length, 2);
});

test('agrupar por petición y peor nivel', () => {
  const rows = L.parsearTexto([
    '{"@t":"2026-11-03T10:00:00Z","@mt":"a","RequestId":"x"}',
    '{"@t":"2026-11-03T10:00:02Z","@mt":"b","@l":"Error","RequestId":"x"}',
    '{"@t":"2026-11-03T10:00:01Z","@mt":"c","RequestId":"y"}'
  ].join('\n'));
  assert.deepEqual(L.claveDePeticion(rows), ['RequestId']);
  const g = L.agrupar(rows, 'RequestId');
  assert.equal(g.length, 2);
  assert.equal(g[0].valor, 'x'); assert.equal(g[0].n, 2); assert.equal(g[0].peor, 'error'); assert.equal(g[0].hasta - g[0].desde, 2000);
});

test('ordenar varios archivos por hora y exportar', () => {
  const a = L.parsearTexto('{"@t":"2026-11-03T10:00:05Z","@mt":"tarde"}', 'a');
  const b = L.parsearTexto('{"@t":"2026-11-03T10:00:01Z","@mt":"temprano, con coma","K":"v\\"q"}', 'b');
  const o = L.ordenarPorHora(a.concat(b));
  assert.equal(o[0].msg, 'temprano, con coma');
  const csv = L.aCSV(o);
  assert.match(csv, /^hora,nivel,categoria,mensaje,excepcion,K,MessageTemplate\r\n/);
  assert.match(csv, /"temprano, con coma",,"v""q"/);
  assert.equal(JSON.parse(L.aJSON(o))[1].mensaje, 'tarde');
});

test('rendimiento: 200 mil líneas', () => {
  const lineas = [];
  for (let i = 0; i < 200000; i++) lineas.push(`{"@t":"2026-11-03T10:${String(i % 60).padStart(2, '0')}:00Z","@mt":"Item {N}","N":${i},"RequestId":"r${i % 500}"}`);
  const t0 = Date.now();
  const rows = L.parsearTexto(lineas.join('\n'));
  const f = L.filtrar(rows, { texto: 'item 1501', props: 'RequestId~r1' });
  assert.equal(rows.length, 200000);
  assert.ok(f.length > 0);
  assert.ok(Date.now() - t0 < 8000, 'tardó ' + (Date.now() - t0));
});
