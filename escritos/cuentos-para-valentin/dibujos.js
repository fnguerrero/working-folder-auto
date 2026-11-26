/* Piezas de dibujo en SVG. Lienzo de 400 x 320.
   Cada personaje u objeto se dibuja con el origen (0,0) en el medio de su base. */
(function (raiz) {
  'use strict';

  const T = '#43304a'; // trazo
  const borde = `stroke="${T}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const linea = (d, color = T, ancho = 3) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const forma = (d, fill) => `<path d="${d}" fill="${fill}" ${borde}/>`;
  const circ = (x, y, r, fill, conBorde = true) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${conBorde ? borde : ''}/>`;
  const elip = (x, y, rx, ry, fill, conBorde = true, giro = 0) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" ${conBorde ? borde : ''}${giro ? ` transform="rotate(${giro} ${x} ${y})"` : ''}/>`;
  const rect = (x, y, w, h, rx, fill, conBorde = true) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${conBorde ? borde : ''}/>`;

  const ojo = (x, y, r = 4.5) => circ(x, y, r, T, false) + circ(x + r * 0.35, y - r * 0.35, r * 0.34, '#fff', false);
  const ojoCerrado = (x, y, a = 6) => linea(`M${x - a} ${y} q${a} ${a} ${a * 2} 0`);
  const ojoFeliz = (x, y, a = 6) => linea(`M${x - a} ${y + 2} q${a} ${-a * 1.3} ${a * 2} 0`);
  const cachete = (x, y, r = 6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff7f8e" opacity=".5"/>`;

  /* ---------- ubicar y volver tocable ---------- */
  function poner(x, y, s, contenido, espejo) {
    return `<g transform="translate(${x} ${y}) scale(${espejo ? -s : s} ${s})">${contenido}</g>`;
  }

  /* ---------- fondos ---------- */
  const lienzo = (color) => `<rect x="0" y="0" width="400" height="320" fill="${color}"/>`;
  const nube = (x, y, s = 1, color = '#fff') =>
    poner(x, y, s, `<path d="M-40 10 q-18 -2 -14 -16 q4 -12 18 -9 q4 -20 26 -18 q18 0 22 16 q22 -6 24 12 q2 15 -18 15 z" fill="${color}"/>`);
  const loma = (color, y, alto) =>
    `<path d="M0 ${y} Q100 ${y - alto} 210 ${y} T400 ${y - 12} V320 H0 Z" fill="${color}"/>`;
  const pastito = (x, y, color = '#3f9142') => linea(`M${x - 8} ${y} l3 -11 M${x} ${y} l0 -15 M${x + 8} ${y} l-3 -11`, color);

  function campo(cielo = '#bfe7fb', conNubes = true) {
    return lienzo(cielo) +
      (conNubes ? nube(80, 58, 0.9) + nube(300, 86, 0.65) : '') +
      loma('#a6d977', 214, 62) +
      `<path d="M0 246 Q200 222 400 248 V320 H0 Z" fill="#86c95c"/>` +
      pastito(34, 290) + pastito(190, 312) + pastito(362, 282);
  }

  function pieza(pared = '#ffe3c2', piso = '#d9a36b') {
    let t = lienzo(pared);
    for (let x = 30; x < 400; x += 68) {
      for (let y = 30; y < 210; y += 62) {
        t += `<circle cx="${x + ((y / 62) % 2 > 1 ? 34 : 0)}" cy="${y}" r="4" fill="#fff" opacity=".6"/>`;
      }
    }
    return t + `<rect x="0" y="236" width="400" height="84" fill="${piso}"/>` +
      linea('M0 236 H400') + linea('M0 276 H400 M110 236 V276 M290 276 V320', '#b5824f', 2);
  }

  function banio() {
    let t = lienzo('#cdeef0');
    for (let x = 0; x <= 400; x += 50) t += linea(`M${x} 0 V244`, '#fff', 3);
    for (let y = 44; y <= 244; y += 50) t += linea(`M0 ${y} H400`, '#fff', 3);
    return t + `<rect x="0" y="244" width="400" height="76" fill="#8fb8c9"/>` + linea('M0 244 H400');
  }

  const ventana = (x, y, cielo, adentro = '') =>
    rect(x - 46, y - 40, 92, 80, 8, cielo) + adentro + linea(`M${x} ${y - 40} V${y + 40} M${x - 46} ${y} H${x + 46}`) +
    rect(x - 54, y + 40, 108, 10, 4, '#fff');

  function estrella(x, y, r = 9, color = '#ffe16b') {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const q = i % 2 ? r * 0.45 : r;
      d += `${i ? 'L' : 'M'}${(x + Math.cos(a) * q).toFixed(1)} ${(y + Math.sin(a) * q).toFixed(1)}`;
    }
    return `<path d="${d}Z" fill="${color}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>`;
  }

  /* ---------- cielo ---------- */
  function sol(dormido) {
    let rayos = '';
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      rayos += linea(`M${(Math.cos(a) * 43).toFixed(1)} ${(Math.sin(a) * 43).toFixed(1)} L${(Math.cos(a) * 55).toFixed(1)} ${(Math.sin(a) * 55).toFixed(1)}`, '#ffb627', 6);
    }
    return rayos + circ(0, 0, 34, '#ffd23f') +
      (dormido ? ojoCerrado(-12, -4) + ojoCerrado(12, -4) : ojo(-12, -6) + ojo(12, -6)) +
      linea('M-10 10 q10 10 20 0') + cachete(-21, 7) + cachete(21, 7);
  }

  function luna() {
    return `<circle r="62" fill="#fff6c9" opacity=".18"/>` + circ(0, 0, 46, '#fff3bf') +
      elip(-24, -18, 8, 7, '#f2e29a', false) + elip(25, 22, 7, 6, '#f2e29a', false) + circ(20, -27, 4, '#f2e29a', false) +
      ojoCerrado(-15, -2, 7) + ojoCerrado(15, -2, 7) + linea('M-9 15 q9 8 18 0') + cachete(-26, 12) + cachete(26, 10);
  }

  /* ---------- animales ---------- */
  function vaca() {
    const pata = (x) => rect(x, -34, 16, 34, 6, '#fff') + rect(x, -10, 16, 10, 4, '#5b4a55');
    return linea('M62 -70 q30 5 22 40') + circ(84, -27, 7, T) +
      pata(-40) + pata(-18) + pata(18) + pata(42) +
      elip(10, -60, 62, 40, '#fff') +
      `<path d="M14 -94 q26 -8 36 12 q-6 20 -28 12 q-16 -8 -8 -24z M40 -40 q18 -14 26 -2 q-6 16 -24 14z" fill="#5b4a55"/>` +
      elip(24, -23, 15, 9, '#ffb3c1') +
      forma('M-72 -122 q-20 -8 -14 -24 q4 14 22 14z', '#f2d59a') + forma('M-26 -122 q20 -8 14 -24 q-4 14 -22 14z', '#f2d59a') +
      elip(-84, -102, 18, 9, '#fff', true, -20) + elip(-14, -102, 18, 9, '#fff', true, 20) +
      elip(-49, -94, 34, 34, '#fff') +
      `<path d="M-66 -122 q16 -10 20 4 q-2 18 -18 20 q-14 -6 -2 -24z" fill="#5b4a55"/>` +
      ojo(-62, -104) + ojo(-36, -104) +
      elip(-49, -75, 28, 19, '#ffb3c1') + circ(-59, -78, 3.5, T, false) + circ(-39, -78, 3.5, T, false) +
      linea('M-58 -66 q9 7 18 0');
  }

  function oveja() {
    const pata = (x) => rect(x, -30, 12, 30, 5, '#5b4a55');
    const lana = [[-34, -62, 24], [-8, -82, 27], [26, -82, 26], [52, -62, 24], [34, -40, 24], [2, -36, 25], [-28, -40, 22], [8, -60, 36]];
    return pata(-26) + pata(-6) + pata(18) + pata(36) +
      lana.map(([x, y, r]) => circ(x, y, r, '#fffaf0')).join('') +
      lana.map(([x, y, r]) => circ(x, y, r - 2, '#fffaf0', false)).join('') +
      linea('M-4 -64 q8 -10 16 0 M24 -46 q8 -10 16 0') +
      elip(-67, -72, 15, 8, '#8d7686', true, -25) + elip(-23, -72, 15, 8, '#8d7686', true, 25) +
      elip(-45, -60, 23, 27, '#8d7686') +
      circ(-56, -86, 11, '#fffaf0') + circ(-34, -86, 11, '#fffaf0') + circ(-45, -91, 12, '#fffaf0') +
      circ(-54, -64, 8, '#fff', false) + circ(-36, -64, 8, '#fff', false) + ojo(-53, -63) + ojo(-37, -63) +
      linea('M-51 -46 q6 6 12 0');
  }

  function pato(color = '#ffd93d') {
    return forma('M-46 -34 q-6 34 42 34 q48 0 54 -34 q4 -22 20 -28 q-28 -6 -36 14 q-34 -12 -62 -4z', color) +
      circ(-30, -66, 27, color) +
      forma('M-52 -68 q-28 -2 -28 8 q2 12 28 6 q8 -8 0 -14z', '#ff9f1c') + linea('M-76 -60 q12 2 22 -2', T, 2) +
      ojo(-37, -75) + cachete(-22, -60) +
      forma('M-10 -30 q20 -20 46 -8 q-10 26 -36 20 q-12 -4 -10 -12z', color);
  }

  function gallo() {
    return linea('M-8 0 v-24 M14 0 v-24 M-16 0 h14 M6 0 h14', '#e07a00', 4) +
      forma('M30 -55 q40 -50 44 -10 q-14 -8 -20 4 q26 -4 20 24 q-12 -10 -24 0z', '#2a9d8f') +
      elip(8, -48, 38, 30, '#c8553d') +
      forma('M-34 -72 q-2 30 22 36 l22 -18 q-14 -20 -14 -36z', '#e9a23b') +
      forma('M-32 -108 q-6 -22 8 -14 q2 -18 14 -6 q14 -8 8 16z', '#e63946') +
      circ(-18, -94, 20, '#e9a23b') +
      forma('M-34 -100 l-24 4 l24 8z', '#ffb703') + forma('M-34 -90 l-16 12 l20 -2z', '#ffb703') +
      elip(-30, -72, 6, 11, '#e63946') + ojo(-22, -98) +
      forma('M-2 -56 q22 -14 40 2 q-14 26 -36 12z', '#a4412d');
  }

  function perro({ dormido = false } = {}) {
    const c = '#c98a4b';
    return linea('M44 -46 q30 -8 28 -38', T, 15) + linea('M44 -46 q30 -8 28 -38', c, 10) +
      elip(14, -38, 42, 32, c) + elip(28, -10, 24, 12, c) +
      rect(-24, -34, 15, 34, 7, c) + rect(0, -34, 15, 34, 7, c) +
      circ(-26, -78, 34, c) +
      elip(-58, -80, 12, 26, '#7a4b2a', true, 18) + elip(6, -80, 12, 26, '#7a4b2a', true, -18) +
      elip(-26, -64, 21, 16, '#f6dcb8') +
      (dormido ? ojoCerrado(-39, -86) + ojoCerrado(-13, -86) : ojo(-39, -88) + ojo(-13, -88)) +
      elip(-26, -72, 9, 6, T) + linea('M-26 -66 v6 M-36 -60 q10 9 20 0') +
      (dormido ? '' : forma('M-31 -55 q-1 14 7 14 q8 0 5 -15z', '#ff7f8e'));
  }

  function gato({ dormido = false } = {}) {
    const c = '#f4a259';
    if (dormido) {
      return elip(8, -30, 56, 30, c) +
        linea('M60 -22 q16 26 -40 18 q-24 -2 -40 -6', T, 17) + linea('M60 -22 q16 26 -40 18 q-24 -2 -40 -6', c, 12) +
        forma('M-62 -50 l-4 -30 l24 16z', c) + forma('M-22 -64 l20 -16 l2 30z', c) +
        circ(-32, -40, 30, c) + linea('M-40 -68 v10 M-30 -70 v11 M16 -58 q6 10 0 20 M34 -54 q6 10 0 18', '#c96f2b', 4) +
        ojoCerrado(-44, -42) + ojoCerrado(-20, -42) + forma('M-36 -32 h8 l-4 5z', '#ff7f8e') +
        linea('M-40 -22 q4 4 8 -2 q4 6 8 2', T, 2) + cachete(-52, -30) + cachete(-12, -30);
    }
    return linea('M26 -16 q44 2 30 -50', T, 17) + linea('M26 -16 q44 2 30 -50', c, 12) +
      elip(0, -30, 32, 30, c) + elip(0, -22, 16, 18, '#ffe0bd', false) +
      rect(-20, -20, 14, 20, 7, c) + rect(6, -20, 14, 20, 7, c) +
      forma('M-30 -78 l-4 -34 l26 18z', c) + forma('M30 -78 l4 -34 l-26 18z', c) +
      circ(0, -70, 31, c) + linea('M-9 -99 v10 M0 -101 v11 M9 -99 v10', '#c96f2b', 4) +
      ojo(-12, -74, 5.5) + ojo(12, -74, 5.5) + forma('M-5 -64 h10 l-5 6z', '#ff7f8e') +
      linea('M-9 -52 q4.5 6 9 -4 q4.5 10 9 4', T, 2) +
      linea('M-20 -62 l-24 -4 M-20 -55 l-23 5 M20 -62 l24 -4 M20 -55 l23 5', T, 2);
  }

  function pajarito(color = '#4cc9f0', { dormido = false } = {}) {
    return linea('M-6 0 v-8 M8 0 v-8', '#e07a00') +
      forma('M16 -22 l22 -10 l-6 20z', color) + elip(0, -24, 23, 20, color) +
      elip(0, -16, 13, 10, '#fff', false) +
      forma('M-21 -30 l-13 5 l13 6z', '#ffb703') +
      (dormido ? ojoCerrado(-9, -30, 4) : ojo(-9, -30, 4)) +
      forma('M2 -26 q16 -8 18 6 q-10 8 -18 -6z', color);
  }

  function abeja() {
    return linea('M30 8 q22 22 40 4', T, 2).replace('/>', ' stroke-dasharray="3 7"/>') +
      elip(-6, -26, 13, 18, '#e8f7ff', true, -20) + elip(14, -25, 12, 16, '#e8f7ff', true, 20) +
      elip(0, 0, 30, 22, '#ffd23f') + linea('M3 -20 q-7 20 0 40 M17 -17 q-6 17 0 33', T, 7) +
      forma('M29 -4 l12 4 l-12 5z', T) + ojo(-17, -5) + linea('M-23 7 q6 6 12 0', T, 2) +
      linea('M-20 -18 q-6 -14 -14 -12 M-9 -21 q0 -14 -7 -18', T, 2);
  }

  function mariquita() {
    return circ(-13, -9, 9, T) + elip(2, -10, 16, 12, '#e63946') + linea('M2 -22 v23', T, 2) +
      circ(-5, -13, 3, T, false) + circ(9, -15, 3, T, false) + circ(8, -5, 3, T, false) + circ(-16, -11, 2, '#fff', false);
  }

  function buho() {
    const c = '#9c6b4e';
    return forma('M-24 -58 l-6 -22 l20 12z', c) + forma('M24 -58 l6 -22 l-20 12z', c) +
      elip(0, -36, 30, 36, c) + elip(0, -24, 18, 22, '#e8c9a0', false) +
      circ(-12, -50, 13, '#fff') + circ(12, -50, 13, '#fff') + ojo(-11, -50, 6) + ojo(11, -50, 6) +
      forma('M-6 -40 h12 l-6 10z', '#ffb703') + linea('M-14 0 v-3 M14 0 v-3', '#ffb703', 5);
  }

  /* Osito: ojos = abiertos | felices | cerrados; boca = sonrisa | abierta | o */
  function osito({ ojos = 'abiertos', boca = 'sonrisa', remera = '#4895ef', manchas = false, brazos = 'abajo' } = {}) {
    const c = '#d59a63', claro = '#f6dcb8';
    const brazo = brazos === 'arriba'
      ? elip(-40, -78, 12, 26, c, true, -48) + elip(40, -78, 12, 26, c, true, 48)
      : elip(-36, -50, 12, 26, c, true, 28) + elip(36, -50, 12, 26, c, true, -28);
    const o = ojos === 'cerrados' ? ojoCerrado(-14, -108) + ojoCerrado(14, -108)
      : ojos === 'felices' ? ojoFeliz(-14, -108) + ojoFeliz(14, -108)
        : ojo(-14, -108, 5) + ojo(14, -108, 5);
    const b = boca === 'abierta' ? forma('M-12 -88 q12 22 24 0z', '#b23a48')
      : boca === 'o' ? elip(0, -81, 5, 7, '#b23a48')
        : linea('M0 -92 v5 M-10 -87 q10 10 20 0');
    return elip(-22, -12, 18, 14, c) + elip(22, -12, 18, 14, c) + elip(-24, -10, 9, 7, claro, false) + elip(24, -10, 9, 7, claro, false) +
      brazo + elip(0, -44, 34, 36, c) +
      (remera ? forma('M-30 -62 q30 14 60 0 q8 18 2 36 q-32 16 -64 0 q-6 -18 2 -36z', remera) : elip(0, -38, 20, 22, claro, false)) +
      circ(-34, -136, 17, c) + circ(34, -136, 17, c) + circ(-34, -136, 8, claro, false) + circ(34, -136, 8, claro, false) +
      circ(0, -108, 42, c) + elip(0, -91, 23, 18, claro) + o + elip(0, -98, 8, 5.5, T, false) + b +
      cachete(-28, -94, 7) + cachete(28, -94, 7) +
      (manchas ? `<path d="M-34 -124 q14 -12 20 2 q2 12 -14 10 q-12 -2 -6 -12z M22 -94 q16 -2 12 10 q-12 8 -16 -2z M-18 -52 q18 -10 24 6 q-4 18 -20 10 q-10 -6 -4 -16z M14 -24 q16 -8 22 6 q-8 14 -20 6z M-46 -56 q10 -6 12 6 q-6 10 -12 -6z" fill="#6f4a2f"/>` : '');
  }

  /* ---------- plantas ---------- */
  function arbol() {
    return forma('M-18 0 q8 -50 0 -100 h36 q-8 50 0 100z', '#9c6b4e') +
      [[-48, -108, 38], [48, -108, 38], [-26, -148, 42], [28, -148, 42], [0, -112, 46]].map(([x, y, r]) => circ(x, y, r, '#4fa35a')).join('') +
      circ(0, -118, 40, '#4fa35a', false);
  }

  function flor(color = '#ffd23f', alto = 50) {
    let p = '';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      p += circ((Math.cos(a) * 13).toFixed(1), (-alto + Math.sin(a) * 13).toFixed(1), 10, color);
    }
    return linea(`M0 0 V${-alto}`, '#2f7d3a', 5) + forma(`M0 -14 q20 -18 26 -4 q-12 14 -26 4z`, '#5cb85c') + p + circ(0, -alto, 9, '#ff8c42');
  }

  /* ---------- cosas ---------- */
  function pelota() {
    return circ(0, -27, 27, '#e63946') + linea('M-25 -35 q25 20 50 0', '#fff', 7) +
      elip(-9, -42, 8, 5, '#fff', false, -30);
  }

  const lineasMovimiento = (x, y) => linea(`M${x} ${y} h-30 M${x + 6} ${y + 16} h-44 M${x} ${y + 32} h-26`, '#fff', 5);

  function mesa(conMantel) {
    const patas = rect(-84, -86, 16, 86, 5, '#a9714b') + rect(68, -86, 16, 86, 5, '#a9714b');
    const tapa = rect(-100, -104, 200, 20, 8, '#c58b5c');
    if (!conMantel) return patas + tapa;
    return patas + tapa + forma('M-96 -104 h192 v20 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0 q-12 16 -24 0z', '#ff8fab');
  }

  function charco() {
    return elip(0, 0, 70, 16, '#8a5a36') + elip(-14, -3, 30, 6, '#a9744b', false) +
      circ(-78, -16, 7, '#8a5a36') + circ(76, -26, 9, '#8a5a36') + circ(60, -48, 5, '#8a5a36') + circ(-62, -40, 4, '#8a5a36');
  }

  const aguaLaguna = (x, y, rx, ry) =>
    elip(x, y, rx, ry, '#63c5ea') + linea(`M${x - rx * 0.6} ${y} q10 -7 20 0 t20 0 M${x + rx * 0.2} ${y + ry * 0.45} q10 -7 20 0 t20 0`, '#fff', 3);

  function baniadera(contenido = '', conAgua = true) {
    // el contenido queda entre el fondo y el frente, así parece que está adentro
    return (conAgua ? elip(0, -92, 128, 17, '#63c5ea') : elip(0, -92, 128, 17, '#e8f4f8')) + contenido +
      forma('M-140 -92 q140 24 280 0 q-4 76 -64 80 h-152 q-60 -4 -64 -80z', '#fff') +
      forma('M-92 -14 q-4 14 -20 14 l6 -22z', '#ffb703') + forma('M92 -14 q4 14 20 14 l-6 -22z', '#ffb703') +
      linea('M-116 -62 q4 32 34 38', '#cdeef0', 7);
  }

  function canilla() {
    return forma('M0 0 v-34 q0 -16 -18 -16 h-30 q-12 0 -12 14 v8 h16 v-6 h24 v34z', '#c9d6df') +
      rect(-24, -66, 28, 10, 5, '#e63946') + linea('M-10 -56 v6');
  }

  const chorro = (x, y1, y2) => rect(x - 8, y1, 16, y2 - y1, 8, '#8fd8f5');

  const burbuja = (x, y, r) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" fill-opacity=".75" stroke="#6bb8d6" stroke-width="2.5"/>` +
    linea(`M${x - r * 0.55} ${y - r * 0.1} q${r * 0.05} ${-r * 0.45} ${r * 0.45} ${-r * 0.5}`, '#fff', 3);

  const gota = (x, y) => forma(`M${x} ${y - 12} q10 14 0 18 q-10 -4 0 -18z`, '#63c5ea');

  function toalla() {
    return forma('M-46 -86 q46 22 92 0 q18 42 8 82 q-54 14 -108 0 q-10 -40 8 -82z', '#ffd166') +
      linea('M-50 -30 q50 14 100 0 M-52 -18 q52 14 104 0', '#ef476f', 6);
  }

  function banana() {
    return forma('M-46 -40 q6 44 58 38 q30 -6 38 -36 l-9 -8 q-14 24 -36 24 q-26 2 -39 -26z', '#ffd93d') +
      forma('M41 -46 l7 -11 l9 5 l-7 14z', '#8a6d2f') + linea('M-30 -26 q20 30 58 14', '#e0b400', 3);
  }

  function manzana(mordida) {
    return forma('M0 -52 q26 -18 38 6 q10 22 -8 40 q-14 14 -30 4 q-16 10 -30 -4 q-18 -18 -8 -40 q12 -24 38 -6z', '#e63946') +
      (mordida ? [[35, -40, 11], [39, -27, 11], [33, -15, 10]].map(([x, y, r]) => circ(x, y, r, '#fff1cf', false)).join('') + linea('M30 -50 q-14 8 -4 14 q-10 8 0 14 q-8 8 -2 14', T, 3) : '') +
      linea('M0 -50 q0 -14 8 -20', '#7a4b2a', 5) + forma('M6 -62 q18 -18 28 -4 q-14 14 -28 4z', '#5cb85c') + elip(-22, -34, 5, 10, '#fff', false, 25);
  }

  function naranja() {
    return circ(0, -32, 32, '#ff9f1c') + linea('M0 -62 v-8', '#7a4b2a', 5) + forma('M2 -64 q18 -16 30 -2 q-14 14 -30 2z', '#5cb85c') +
      ojo(-10, -34, 4) + ojo(10, -34, 4) + linea('M-9 -22 q9 9 18 0') + elip(-17, -48, 7, 4, '#ffd08a', false, -35);
  }

  function vasoLeche() {
    return forma('M-26 -70 h52 l-6 70 h-40z', '#e8f7ff') + `<path d="M-22 -54 h44 l-4.5 50 h-35z" fill="#fff"/>` +
      linea('M-22 -54 h44', '#c9d6df', 2) + linea('M10 -50 l22 -46', '#ef476f', 7) + linea('M-17 -44 l3 28', '#c9ecff', 4);
  }

  const plato = () => elip(0, 0, 54, 11, '#fff') + elip(0, -2, 34, 5, '#e8eef2', false);

  function nido() {
    return forma('M-62 -22 q62 18 124 0 q-8 36 -62 36 q-54 0 -62 -36z', '#a9714b') +
      linea('M-52 -10 q40 20 82 6 M-34 4 q34 14 70 -14 M-56 -20 q28 18 60 12', '#7a4b2a', 3);
  }

  const rama = (x, y, hasta) =>
    linea(`M${x} ${y} Q${(x + hasta) / 2} ${y + 18} ${hasta} ${y}`, '#7a4b2a', 14) +
    elip(hasta, y - 12, 20, 10, '#4fa35a', true, -30) + elip((x + hasta) / 2 + 46, y + 20, 18, 9, '#4fa35a', true, 30);

  function caja() {
    return forma('M-70 -64 h140 l-10 64 h-120z', '#d99a5b') + rect(-76, -76, 152, 16, 6, '#e8b27a') +
      estrella(0, -32, 18, '#fff3bf');
  }

  const cubo = (color, letra) =>
    rect(-18, -36, 36, 36, 6, color) +
    `<text x="0" y="-9" text-anchor="middle" font-family="sans-serif" font-size="24" font-weight="700" fill="#fff">${letra}</text>`;

  function cama(contenido = '') {
    return rect(-136, -128, 26, 128, 10, '#a9714b') + rect(112, -76, 22, 76, 9, '#a9714b') +
      rect(-120, -58, 244, 36, 12, '#fff') + elip(-72, -64, 44, 20, '#e8f4ff') + contenido +
      forma('M-36 -74 q80 -22 158 6 l0 46 h-170 q-8 -34 12 -52z', '#7b6cf6') +
      linea('M-38 -62 q80 -18 158 8', '#fff', 7) + estrella(0, -38, 9) + estrella(50, -42, 9) + estrella(94, -34, 7);
  }

  const zeta = (x, y, t) =>
    `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${t}" font-weight="800" fill="#fff" stroke="${T}" stroke-width="1.5">z</text>`;

  const corazon = (x, y, s = 1) =>
    poner(x, y, s, forma('M0 10 q-24 -16 -14 -28 q8 -8 14 3 q6 -11 14 -3 q10 12 -14 28z', '#ff5d8f'));

  const nota = (x, y, color = '#fff') =>
    elip(x, y, 7, 5, color, true, -20) + linea(`M${x + 6} ${y - 2} v-24 q10 2 10 10`, T, 3);

  const D = {
    T, linea, forma, circ, elip, rect, poner, lienzo, nube, loma, pastito, campo, pieza, banio, ventana, estrella,
    sol, luna, vaca, oveja, pato, gallo, perro, gato, pajarito, abeja, mariquita, buho, osito, arbol, flor,
    pelota, lineasMovimiento, mesa, charco, aguaLaguna, baniadera, canilla, chorro, burbuja, gota, toalla,
    banana, manzana, naranja, vasoLeche, plato, nido, rama, caja, cubo, cama, zeta, corazon, nota
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else raiz.Dibujos = D;
})(typeof window !== 'undefined' ? window : globalThis);
