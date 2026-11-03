// e2e con Playwright: muestra, filtros, agrupado, detalle, y un archivo de ~50 MB generado acá. Uso: node tests/e2e.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const url = 'file://' + path.resolve(__dirname, '../index.html');
const assert = require('assert');

(async () => {
  const grande = path.join(os.tmpdir(), 'log-grande-' + process.pid + '.log');
  const ws = fs.createWriteStream(grande); let bytes = 0, i = 0;
  while (bytes < 50 * 1024 * 1024) {
    const s = `{"@t":"2026-11-03T${String(10 + (i / 3600 | 0) % 12).padStart(2, '0')}:${String((i / 60 | 0) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z","@mt":"Procesando item {N} del lote {Lote}","@l":"${i % 997 === 0 ? 'Error' : 'Information'}","N":${i},"Lote":${i % 50},"RequestId":"r${i % 2000}","SourceContext":"Api.Worker","Detalle":"${'x'.repeat(60)}"}\n`;
    bytes += Buffer.byteLength(s); i++; if (!ws.write(s)) await new Promise(r => ws.once('drain', r));
  }
  await new Promise(r => ws.end(r));
  console.log('archivo grande:', (bytes / 1048576).toFixed(1), 'MB,', i, 'líneas');

  const b = await chromium.launch();
  for (const [nombre, w, h] of [['360', 360, 740], ['1280', 1280, 800]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    const errores = []; p.on('pageerror', e => errores.push(e.message)); p.on('console', m => m.type() === 'error' && !/favicon/.test(m.text()) && errores.push(m.text()));
    await p.goto(url);
    await p.click('#muestra');
    await p.waitForSelector('#cuerpo tr.f');
    assert.match(await p.textContent('#estado'), /Serilog compact/);
    const total = await p.locator('#cuerpo tr.f').count();
    assert.ok(total > 100, 'filas ' + total);
    // nivel
    await p.click('[data-nv=error]'); await p.waitForTimeout(300);
    assert.ok(await p.locator('#cuerpo tr.f').count() > 0);
    assert.ok(await p.locator('#cuerpo tr.f:not([data-n=error])').count() === 0, 'solo error');
    // detalle con excepción
    await p.click('#cuerpo tr.f'); assert.match(await p.textContent('.det pre'), /TimeoutException/);
    // seguir petición
    await p.click('.det [data-peticion="RequestId"]'); await p.waitForTimeout(300);
    assert.ok((await p.inputValue('#fProps')).startsWith('RequestId='));
    await p.click('#limpiar'); await p.waitForTimeout(300);
    // texto + propiedad
    await p.fill('#fTexto', 'timeout'); await p.fill('#fProps', 'UserId=cami'); await p.waitForTimeout(300);
    const c = await p.textContent('#conteo'); assert.match(c, /^\d+ de /);
    assert.ok(await p.locator('mark').count() > 0, 'resaltado');
    await p.click('#limpiar');
    // agrupar
    await p.click('#agrupar'); assert.ok(await p.locator('#grupos button').count() >= 40);
    await p.click('#grupos button >> nth=0'); await p.waitForTimeout(300);
    assert.ok(await p.locator('#cuerpo tr.f').count() >= 3);
    // descarga
    const [d] = await Promise.all([p.waitForEvent('download'), p.click('#expCsv')]);
    assert.ok(fs.readFileSync(await d.path(), 'utf8').includes('RequestId'));
    // sin scroll horizontal
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'scroll horizontal a ' + w);
    // archivo grande
    const t0 = Date.now();
    await p.setInputFiles('#arch', grande);
    await p.waitForFunction(() => /MB/.test(document.getElementById('estado').textContent) && /50\.\d MB/.test(document.getElementById('estado').textContent), null, { timeout: 120000 });
    console.log(nombre, 'px: 50 MB leídos en', ((Date.now() - t0) / 1000).toFixed(1), 's →', await p.textContent('#estado'));
    await p.fill('#fTexto', 'item 4999'); await p.waitForTimeout(600);
    assert.ok(await p.locator('#cuerpo tr.f').count() > 0);
    await p.screenshot({ path: path.join(os.tmpdir(), 'visor-' + nombre + '.png') });
    assert.deepStrictEqual(errores, [], 'errores: ' + errores.join('|'));
    console.log(nombre, 'px OK');
  }
  await b.close(); fs.unlinkSync(grande);
})().catch(e => { console.error('FALLÓ', e); process.exit(1); });
