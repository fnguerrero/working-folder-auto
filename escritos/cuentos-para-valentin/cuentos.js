/* Los cuentos: texto, dibujo y sonidos de cada página.
   Después de cambiar un texto: node generar-md.js */
(function (raiz) {
  'use strict';

  const D = (typeof module !== 'undefined' && module.exports) ? require('./dibujos.js') : raiz.Dibujos;
  const P = D.poner;

  /* Marca una parte del dibujo como tocable.
     son = nombre del sonido (sonidos.js), dice = lo que aparece escrito, nombre = para lectores de pantalla. */
  const toca = (son, dice, nombre, x, y, s, dibujo, espejo) =>
    P(x, y, s, `<g class="toca" data-son="${son}" data-dice="${dice}" role="button" tabindex="0" aria-label="${nombre}">${dibujo}</g>`, espejo);

  /* pagina(texto, sonido principal, función que dibuja, texto alternativo para la voz) */
  const pagina = (texto, son, dibujo, voz) => ({ texto, son, dibujo, voz });

  const cuentos = [
    {
      slug: 'quien-hace-muuu',
      titulo: '¿Quién hace muuu?',
      emoji: '🐮',
      color: '#8fd16a',
      resumen: 'Los animales del campo y sus voces.',
      paginas: [
        pagina('Se despierta el campo. El gallo canta: ¡quiquiriquí!', 'gallo', () =>
          D.campo('#ffe0a8') +
          toca('tin', '¡Buen día!', 'El sol', 320, 150, 1.05, D.sol()) +
          D.rect(80, 224, 118, 14, 5, '#c58b5c') + D.rect(92, 236, 12, 54, 4, '#a9714b') + D.rect(172, 236, 12, 54, 4, '#a9714b') +
          toca('gallo', '¡Quiquiriquí!', 'El gallo', 140, 224, 1.35, D.gallo())),
        pagina('¿Quién hace muuu? La vaca, que come pasto verde. ¡Muuu!', 'vaca', () =>
          D.campo() + P(340, 232, 0.8, D.flor('#fff')) +
          toca('vaca', '¡Muuu!', 'La vaca', 200, 284, 1.5, D.vaca()) +
          D.pastito(62, 252) + D.pastito(76, 256) + D.pastito(52, 262)),
        pagina('¿Quién hace beee? La oveja, suavecita como una nube. ¡Beee!', 'oveja', () =>
          D.campo('#cdeafd', false) +
          toca('plop', '¡Puf!', 'La nube', 292, 76, 1.6, D.nube(0, 0)) + D.nube(70, 48, 0.7) +
          toca('oveja', '¡Beee!', 'La oveja', 206, 282, 1.65, D.oveja()) +
          P(48, 282, 0.9, D.flor('#ff8fab')) + P(358, 292, 1, D.flor('#ffd23f'))),
        pagina('¿Quién hace cuac? El pato, que chapotea en la laguna. ¡Cuac, cuac!', 'pato', () =>
          D.campo() + D.aguaLaguna(200, 262, 180, 46) +
          toca('pato', '¡Cuac, cuac!', 'El pato', 196, 266, 1.65, D.pato()) +
          toca('pato', '¡Cuac!', 'El patito', 322, 262, 0.75, D.pato()) +
          D.gota(94, 226) + D.gota(116, 210) + D.gota(278, 196) +
          P(48, 234, 0.8, D.flor('#fff'))),
        pagina('¿Quién hace guau? El perro, que mueve la cola cuando te ve. ¡Guau, guau!', 'perro', () =>
          D.campo() + P(56, 238, 0.85, D.arbol()) +
          toca('perro', '¡Guau, guau!', 'El perro', 212, 290, 1.75, D.perro()) +
          D.linea('M356 156 q16 8 14 26 M340 140 q22 4 32 16')),
        pagina('Se va el día y todos saludan juntos. ¡Chau, chau, hasta mañana!', 'nana', () =>
          D.campo('#ffc4a3') + toca('nana', '¡Chau, chau!', 'El sol que se esconde', 200, 148, 0.9, D.sol(true)) +
          D.loma('#8ecb64', 222, 40) +
          toca('vaca', '¡Muuu!', 'La vaca', 92, 266, 0.85, D.vaca()) +
          toca('oveja', '¡Beee!', 'La oveja', 308, 260, 0.9, D.oveja(), true) +
          toca('perro', '¡Guau!', 'El perro', 196, 306, 0.8, D.perro()) +
          toca('pato', '¡Cuac!', 'El pato', 338, 310, 0.65, D.pato()) +
          toca('gallo', '¡Quiquiriquí!', 'El gallo', 52, 312, 0.65, D.gallo(), true))
      ]
    },
    {
      slug: 'la-pelota-roja',
      titulo: 'La pelota roja',
      emoji: '🔴',
      color: '#ff8a80',
      resumen: 'Se escapó la pelota. ¿Dónde estará?',
      paginas: [
        pagina('Osito tiene una pelota roja. La tira para arriba: ¡boing, boing!', 'boing', () =>
          D.campo() +
          toca('risa', '¡Ji, ji!', 'Osito', 140, 292, 1.35, D.osito({ brazos: 'arriba', boca: 'abierta' })) +
          toca('boing', '¡Boing!', 'La pelota roja', 292, 130, 1.5, D.pelota()) +
          D.linea('M270 152 q-6 14 -2 28 M292 156 v30 M314 152 q6 14 2 28', '#fff', 5)),
        pagina('Uy, la pelota rueda y rueda... ¡y se escapó!', 'rueda', () =>
          D.campo() + D.lineasMovimiento(238, 226) +
          toca('rueda', '¡Rueda!', 'La pelota roja', 292, 280, 1.4, D.pelota()) +
          toca('uy', '¡Uy!', 'Osito', 96, 290, 1.2, D.osito({ brazos: 'arriba', boca: 'o' }))),
        pagina('¿Estará abajo de la mesa? No, ahí está el gato. ¡Miau!', 'gato', () =>
          D.pieza() + D.ventana(80, 80, '#bfe7fb', D.nube(80, 66, 0.45)) +
          toca('gato', '¡Miau!', 'El gato', 232, 286, 1.15, D.gato()) +
          P(232, 292, 1.35, D.mesa(true)) +
          toca('uy', '¿Y la pelota?', 'Osito', 62, 300, 0.95, D.osito({ boca: 'o' }))),
        pagina('¿Estará entre las flores? No, ahí zumba una abeja. ¡Bzzz!', 'abeja', () =>
          D.campo() +
          toca('abeja', '¡Bzzz!', 'La abeja', 210, 108, 1.5, D.abeja()) +
          toca('tin', '¡Tilín!', 'Flor rosa', 70, 288, 1.7, D.flor('#ff8fab', 56)) +
          toca('tin', '¡Tilín!', 'Flor amarilla', 168, 304, 1.5, D.flor('#ffd23f', 62)) +
          toca('tin', '¡Tilín!', 'Flor violeta', 264, 284, 1.6, D.flor('#b794f6', 48)) +
          toca('tin', '¡Tilín!', 'Flor blanca', 352, 306, 1.5, D.flor('#fff', 66)) +
          toca('plop', '¡Hola!', 'La vaquita de San Antonio', 112, 310, 1.4, D.mariquita()),
          '¿Estará entre las flores? No, ahí zumba una abeja. ¡Bsss!'),
        pagina('¿Estará atrás del árbol? ¡Sí! La encontró el perro. ¡Guau!', 'perro', () =>
          D.campo() +
          toca('perro', '¡Guau!', 'El perro', 276, 286, 1.15, D.perro()) +
          toca('boing', '¡Boing!', 'La pelota roja', 218, 298, 1.1, D.pelota()) +
          toca('fru', '¡Fru, fru!', 'El árbol', 108, 284, 1.45, D.arbol()) +
          toca('pajaro', '¡Pío!', 'El pajarito', 130, 54, 0.9, D.pajarito())),
        pagina('Ahora juegan los dos. ¡Tuya, mía, tuya, mía!', 'boing', () =>
          D.campo() + P(332, 78, 0.85, D.sol()) +
          toca('risa', '¡Ji, ji!', 'Osito', 82, 292, 1.15, D.osito({ ojos: 'felices', boca: 'abierta', brazos: 'arriba' })) +
          toca('perro', '¡Guau, guau!', 'El perro', 316, 292, 1.15, D.perro()) +
          toca('boing', '¡Boing!', 'La pelota roja', 192, 150, 1.25, D.pelota()) +
          D.linea('M126 150 q22 -46 52 -44 M262 150 q-18 -42 -44 -44', '#fff', 5).replace('/>', ' stroke-dasharray="4 12"/>'))
      ]
    },
    {
      slug: 'osito-al-agua',
      titulo: 'Osito al agua',
      emoji: '🛁',
      color: '#6fd0e8',
      resumen: 'Del barro a la bañadera.',
      paginas: [
        pagina('Osito jugó en el barro. ¡Plaf! Quedó todo sucio.', 'plaf', () =>
          D.campo() +
          toca('plaf', '¡Plaf!', 'El charco de barro', 200, 282, 1.7, D.charco()) +
          toca('risa', '¡Ji, ji!', 'Osito embarrado', 200, 280, 1.4, D.osito({ ojos: 'felices', boca: 'abierta', manchas: true, brazos: 'arriba' }))),
        pagina('Se llena la bañadera con agua tibiecita. ¡Glu, glu, glu!', 'agua', () =>
          D.banio() +
          toca('agua', '¡Glu, glu!', 'La canilla', 306, 130, 1.25, D.chorro(-37, -20, 105) + D.canilla()) +
          toca('plaf', '¡Splash!', 'La bañadera', 200, 296, 1.15, D.baniadera()) +
          toca('risa', '¡Allá voy!', 'Osito', 52, 306, 0.85, D.osito({ manchas: true, brazos: 'arriba' }))),
        pagina('Al agua van Osito y su patito amarillo. ¡Cuac!', 'pato', () =>
          D.banio() +
          P(200, 300, 1.25, D.baniadera(
            toca('risa', '¡Ji, ji!', 'Osito', -34, -40, 1.05, D.osito({ remera: null, boca: 'abierta' })) +
            toca('pato', '¡Cuac!', 'El patito amarillo', 68, -84, 0.75, D.pato()))) +
          D.gota(60, 120) + D.gota(350, 140) + D.gota(330, 108)),
        pagina('Jabón en la panza y jabón en las orejas. ¡Cuántas burbujas! ¡Plop!', 'plop', () => {
          const burbujas = [[58, 70, 22], [112, 118, 13], [330, 60, 28], [296, 128, 15], [360, 150, 11], [82, 164, 16], [250, 44, 12], [146, 42, 9]];
          return D.banio() +
            P(200, 300, 1.25, D.baniadera(
              toca('risa', '¡Ji, ji!', 'Osito', -14, -40, 1.05, D.osito({ remera: null, ojos: 'felices' })) +
              D.burbuja(-48, -184, 15) + D.burbuja(-24, -194, 12) + D.burbuja(22, -186, 14) +
              D.burbuja(-70, -90, 20) + D.burbuja(-40, -84, 15) + D.burbuja(8, -82, 18) + D.burbuja(44, -90, 14) + D.burbuja(82, -86, 21))) +
            burbujas.map(([x, y, r]) => toca('plop', '¡Plop!', 'Una burbuja', x, y, 1, D.burbuja(0, 0, r))).join('');
        }),
        pagina('La toalla lo abraza fuerte y lo seca. ¡Fru, fru!', 'fru', () =>
          D.banio() +
          toca('risa', '¡Ji, ji!', 'Osito', 200, 292, 1.5, D.osito({ remera: null, ojos: 'felices' })) +
          toca('fru', '¡Fru, fru!', 'La toalla', 200, 296, 1.5, D.toalla()) +
          P(340, 292, 0.65, D.pato()) + D.linea('M96 190 q-16 14 -2 30 M306 190 q16 14 2 30')),
        pagina('Limpito y perfumado. ¡Qué rico olor, Osito! ¡Muac!', 'beso', () =>
          D.pieza('#ffd9e6') +
          toca('beso', '¡Muac!', 'Osito', 200, 296, 1.55, D.osito({ ojos: 'felices', remera: '#06d6a0' })) +
          toca('tin', '¡Tilín!', 'Un corazón', 84, 108, 1.9, D.corazon(0, 0)) +
          toca('tin', '¡Tilín!', 'Un corazón', 320, 84, 1.5, D.corazon(0, 0)) +
          D.corazon(336, 176, 0.9) + D.estrella(60, 188, 12) + D.estrella(130, 46, 10) + D.estrella(262, 40, 8))
      ]
    },
    {
      slug: 'la-merienda',
      titulo: 'La merienda de Osito',
      emoji: '🍌',
      color: '#ffd166',
      resumen: 'Frutas, colores y una panza contenta.',
      paginas: [
        pagina('Es la hora de la merienda y a Osito le hace ruido la panza. ¡Grrr!', 'panza', () =>
          D.pieza('#e3f4d7') + D.ventana(316, 90, '#bfe7fb', P(342, 72, 0.35, D.sol())) +
          toca('panza', '¡Grrr!', 'La panza de Osito', 176, 296, 1.5, D.osito({ boca: 'o' })) +
          D.linea('M96 246 q-16 -8 -26 4 M98 266 q-16 0 -24 12 M256 246 q16 -8 26 4 M254 266 q16 0 24 12')),
        pagina('Primero, una banana amarilla. Se pela de a poquito. ¡Ñam!', 'nam', () =>
          D.pieza('#fff3b0') +
          P(112, 254, 1.25, D.osito({ boca: 'abierta' })) +
          P(200, 320, 1.3, D.mesa()) + P(268, 188, 1.1, D.plato()) +
          toca('nam', '¡Ñam!', 'La banana amarilla', 268, 184, 1.5, D.banana())),
        pagina('Después, una manzana roja. La muerde y hace ¡crac!', 'crac', () =>
          D.pieza('#ffd6d6') +
          P(288, 254, 1.25, D.osito({ ojos: 'felices', boca: 'abierta' })) +
          P(200, 320, 1.3, D.mesa()) + P(132, 188, 1.1, D.plato()) +
          toca('crac', '¡Crac!', 'La manzana roja', 132, 185, 1.6, D.manzana(true))),
        pagina('Una naranja redonda, de color naranja. ¡Cómo rueda!', 'rueda', () =>
          D.pieza('#ffe0bf') +
          P(104, 254, 1.2, D.osito({ ojos: 'felices' })) + P(200, 320, 1.3, D.mesa()) +
          toca('rueda', '¡Rueda!', 'La naranja', 264, 185, 1.6, D.naranja()) +
          D.linea('M188 138 h22 M176 156 h34 M190 174 h20', '#fff', 6)),
        pagina('Y un vaso de leche blanca. ¡Glu, glu, glu!', 'agua', () =>
          D.pieza('#d8ebff') +
          P(120, 254, 1.25, D.osito({ ojos: 'cerrados', boca: 'o' })) +
          P(200, 320, 1.3, D.mesa()) +
          toca('agua', '¡Glu, glu!', 'El vaso de leche', 264, 186, 1.45, D.vasoLeche())),
        pagina('Panza llena, corazón contento. ¡Mmm, qué rico!', 'mmm', () =>
          D.pieza('#e8dcff') +
          toca('mmm', '¡Mmm!', 'Osito contento', 200, 256, 1.35, D.osito({ ojos: 'felices', boca: 'abierta', brazos: 'arriba' })) +
          P(200, 332, 1.55, D.mesa(true)) + P(110, 168, 0.9, D.plato()) + P(290, 168, 0.9, D.plato()) +
          toca('crac', '¡Crac!', 'El corazón de la manzana', 108, 168, 0.55, D.manzana(true)) +
          toca('agua', '¡Glu!', 'El vaso vacío', 292, 168, 0.65, D.vasoLeche()) +
          toca('tin', '¡Tilín!', 'Un corazón', 68, 84, 1.7, D.corazon(0, 0)) + D.corazon(326, 98, 1.3))
      ]
    },
    {
      slug: 'hasta-maniana',
      titulo: 'Hasta mañana',
      emoji: '🌙',
      color: '#a597ff',
      resumen: 'Para decirle chau al día, de a poco.',
      paginas: [
        pagina('El sol se va a dormir atrás de la loma. Hasta mañana, sol.', 'nana', () =>
          D.lienzo('#ffb38a') + D.nube(84, 66, 0.9, '#ffe0d0') + D.nube(318, 96, 0.7, '#ffe0d0') +
          toca('nana', 'Hasta mañana', 'El sol', 200, 180, 1.55, D.sol(true)) +
          D.loma('#6ea85a', 232, 40) + `<path d="M0 262 Q190 218 400 266 V320 H0 Z" fill="#558b48"/>` +
          D.zeta(284, 112, 26) + D.zeta(308, 86, 34)),
        pagina('Los pajaritos se acurrucan en el nido. Hasta mañana, pajaritos. ¡Pío, pío!', 'pajaro', () =>
          D.lienzo('#8f7fc4') + D.estrella(70, 56) + D.estrella(320, 40, 7) + D.estrella(356, 130, 6) +
          D.rama(-10, 252, 372) +
          toca('pajaro', '¡Pío!', 'El pajarito celeste', 142, 236, 1.6, D.pajarito('#4cc9f0', { dormido: true })) +
          toca('pajaro', '¡Pío!', 'El pajarito amarillo', 258, 236, 1.6, D.pajarito('#ffd23f', { dormido: true }), true) +
          toca('pajaro', '¡Pío!', 'El pajarito rosa', 200, 226, 1.15, D.pajarito('#ff8fab', { dormido: true })) +
          P(200, 246, 1.65, D.nido()) + D.zeta(296, 150, 22) + D.zeta(316, 124, 30)),
        pagina('El gato se hace un ovillo. Hasta mañana, gato. Prrr, prrr.', 'ronroneo', () =>
          D.pieza('#6d6aa8', '#8a6a63') + D.ventana(84, 88, '#2c2f63', D.estrella(62, 70, 6) + D.estrella(110, 112, 5)) +
          D.elip(212, 272, 150, 28, '#e7798f') + D.elip(212, 272, 112, 18, '#f4a0b0', false) +
          toca('ronroneo', 'Prrr...', 'El gato dormido', 212, 270, 1.65, D.gato({ dormido: true })) +
          D.zeta(300, 150, 24) + D.zeta(324, 122, 34),
          'El gato se hace un ovillo. Hasta mañana, gato. Purr, purr.'),
        pagina('Los juguetes vuelven a su caja. Hasta mañana, pelota.', 'boing', () =>
          D.pieza('#5f6aa6', '#84655f') + D.ventana(320, 84, '#2c2f63', P(332, 70, 0.3, D.luna())) +
          toca('boing', '¡Boing!', 'La pelota', 168, 222, 1.35, D.pelota()) +
          toca('pato', '¡Cuac!', 'El patito de goma', 252, 218, 0.8, D.pato()) +
          toca('crac', '¡Toc!', 'Un cubo', 216, 182, 1.1, D.cubo('#06d6a0', 'A')) +
          toca('tin', 'A guardar', 'La caja de juguetes', 200, 298, 1.35, D.caja()) +
          toca('crac', '¡Toc!', 'Un cubo', 62, 298, 1.25, D.cubo('#4895ef', 'V'))),
        pagina('Sale la luna, redonda y blanca, y las estrellas brillan. Uuuh, dice el búho.', 'buho', () => {
          const estrellas = [[54, 56, 15], [124, 112, 11], [62, 168, 9], [352, 150, 12], [322, 46, 16], [150, 34, 8]];
          return D.lienzo('#252a5e') +
            toca('tin', '¡Tilín!', 'La luna', 232, 108, 1.35, D.luna()) +
            estrellas.map(([x, y, r]) => toca('tin', '¡Tilín!', 'Una estrella', x, y, 1, D.estrella(0, 0, r))).join('') +
            D.loma('#2f5560', 262, 40) + D.rama(-10, 262, 168) +
            toca('buho', 'Uuuh...', 'El búho', 92, 264, 1.25, D.buho());
        }),
        pagina('Osito cierra los ojitos. Shhh... Hasta mañana, que sueñes lindo.', 'nana', () =>
          D.pieza('#454a85', '#6d5560') + D.ventana(300, 80, '#1d2150', P(312, 66, 0.34, D.luna()) + D.estrella(272, 96, 6)) +
          P(200, 298, 1.4, D.cama(
            toca('nana', 'Shhh...', 'Osito dormido', -62, -2, 0.82, D.osito({ ojos: 'cerrados', remera: '#ffd166' })))) +
          D.zeta(112, 104, 24) + D.zeta(136, 76, 34) + D.zeta(168, 48, 44),
          'Osito cierra los ojitos. Chsss. Hasta mañana, que sueñes lindo.')
      ]
    }
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = cuentos;
  else raiz.CUENTOS = cuentos;
})(typeof window !== 'undefined' ? window : globalThis);
