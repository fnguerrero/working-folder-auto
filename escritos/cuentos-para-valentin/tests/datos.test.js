/* Uso: node --test tests/datos.test.js (desde la carpeta del proyecto). No produce sonido. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const cuentos = require('../cuentos.js');
const Sonidos = require('../sonidos.js');
const Voz = require('../voz.js');
const aMarkdown = require('../generar-md.js');

test('cada cuento tiene 5 o 6 páginas cortas, con dibujo y sonidos que existen', () => {
  assert.ok(cuentos.length >= 5);
  assert.strictEqual(new Set(cuentos.map((c) => c.slug)).size, cuentos.length);
  for (const c of cuentos) {
    assert.ok(c.paginas.length >= 5 && c.paginas.length <= 6, c.slug);
    c.paginas.forEach((p, i) => {
      const donde = `${c.slug} pág. ${i + 1}`;
      assert.ok(p.texto.length <= 90, `${donde}: texto largo (${p.texto.length})`);
      const svg = p.dibujo();
      assert.ok(!/undefined|NaN|\[object/.test(svg), `${donde}: dibujo roto`);
      const usados = [...svg.matchAll(/data-son="([^"]+)"/g)].map((m) => m[1]);
      assert.ok(usados.length, `${donde}: nada para tocar`);
      for (const son of [...usados, p.son]) assert.ok(Sonidos.nombres.includes(son), `${donde}: falta el sonido ${son}`);
      assert.ok(usados.includes(p.son), `${donde}: el sonido principal no está en el dibujo`);
    });
  }
});

test('los .md están al día con cuentos.js', () => {
  for (const c of cuentos) {
    const md = fs.readFileSync(path.join(__dirname, '..', 'cuentos', `${c.slug}.md`), 'utf8').replace(/\r\n/g, '\n');
    assert.strictEqual(md, aMarkdown(c), `${c.slug}.md: correr node generar-md.js`);
  }
});

test('elige la voz rioplatense antes que otras y descarta las que no son en español', () => {
  const v = (lang) => ({ lang, localService: false });
  assert.strictEqual(Voz.elegirVoz([v('en-US'), v('es-ES'), v('es-AR'), v('es-MX')]).lang, 'es-AR');
  assert.strictEqual(Voz.elegirVoz([v('es-ES'), v('es_US')]).lang, 'es_US');
  assert.strictEqual(Voz.elegirVoz([v('en-US')]), null);
});

test('la pausa retoma desde la frase interrumpida y los eventos viejos no pisan nada', () => {
  const dichas = [];
  const sintesis = { speak: (u) => dichas.push(u), cancel() {}, getVoices: () => [] };
  function Frase(text) { this.text = text; }
  const lector = Voz.crearLector({ sintesis, Frase });
  lector.leer('Uno. ¡Dos! Tres.');
  dichas[0].onend();
  lector.pausar();
  assert.strictEqual(lector.estado(), 'pausado');
  dichas[1].onend(); // evento tardío de la frase cancelada
  dichas[1].onerror();
  assert.strictEqual(lector.estado(), 'pausado');
  lector.seguir();
  assert.strictEqual(dichas[2].text, '¡Dos!');
  dichas[2].onend();
  dichas[3].onend();
  assert.strictEqual(lector.estado(), 'quieto');
  assert.deepStrictEqual(dichas.map((u) => u.text), ['Uno.', '¡Dos!', '¡Dos!', 'Tres.']);
});
