/* Sonidos sintetizados con WebAudio: no hay archivos de audio.
   Cada receta recibe (s, t): s trae las herramientas, t es el momento en que arranca. */
(function (raiz) {
  'use strict';

  function herramientas(ctx, salida) {
    function envolvente(t, dur, vol, ataque) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + Math.min(ataque, dur * 0.4));
      g.gain.setValueAtTime(vol, t + dur * 0.65);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(salida);
      return g;
    }
    function curva(param, valores, t, dur) {
      param.setValueAtTime(valores[0], t);
      for (let i = 1; i < valores.length; i++) {
        param.linearRampToValueAtTime(valores[i], t + (dur * i) / (valores.length - 1));
      }
    }
    /* tono: f = lista de frecuencias a recorrer. Opciones: tipo, vol, filtro, q, vib [velocidad, hondura] */
    function tono(t, dur, f, o = {}) {
      const osc = ctx.createOscillator();
      osc.type = o.tipo || 'sine';
      curva(osc.frequency, f, t, dur);
      let nodo = osc;
      if (o.filtro) {
        const fl = ctx.createBiquadFilter();
        fl.type = o.clase || 'bandpass';
        fl.Q.value = o.q || 2;
        curva(fl.frequency, [].concat(o.filtro), t, dur);
        nodo.connect(fl);
        nodo = fl;
      }
      nodo.connect(envolvente(t, dur, o.vol || 0.3, o.ataque || 0.02));
      if (o.vib) {
        const lfo = ctx.createOscillator();
        const hondo = ctx.createGain();
        lfo.frequency.value = o.vib[0];
        hondo.gain.value = o.vib[1];
        lfo.connect(hondo).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(t + dur);
      }
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    /* ruido filtrado: agua, hojas, mordiscos */
    function ruido(t, dur, f, o = {}) {
      const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const datos = buf.getChannelData(0);
      let semilla = 12345;
      for (let i = 0; i < n; i++) {
        semilla = (semilla * 16807) % 2147483647;
        datos[i] = (semilla / 2147483647) * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const fl = ctx.createBiquadFilter();
      fl.type = o.clase || 'bandpass';
      fl.Q.value = o.q || 1;
      curva(fl.frequency, [].concat(f), t, dur);
      src.connect(fl).connect(envolvente(t, dur, o.vol || 0.3, o.ataque || 0.01));
      src.start(t);
    }
    return { tono, ruido };
  }

  const diente = (extra) => Object.assign({ tipo: 'sawtooth' }, extra);

  const RECETAS = {
    vaca: (s, t) => s.tono(t, 1.3, [105, 135, 128, 95], diente({ vol: 0.55, filtro: [280, 650, 600, 330], q: 1.6, ataque: 0.18, vib: [5, 2] })),
    oveja: (s, t) => s.tono(t, 0.9, [330, 350, 300], diente({ vol: 0.45, filtro: [900, 1100, 800], q: 2, vib: [11, 22] })),
    pato: (s, t) => [0, 0.28].forEach((d) => s.tono(t + d, 0.18, [420, 300], diente({ vol: 0.55, filtro: [1300, 900], q: 4 }))),
    perro: (s, t) => [0, 0.3].forEach((d) => {
      s.tono(t + d, 0.17, [220, 430, 170], diente({ vol: 0.55, filtro: [600, 900, 450], q: 1.5, ataque: 0.01 }));
      s.ruido(t + d, 0.09, [800, 500], { vol: 0.2 });
    }),
    gato: (s, t) => s.tono(t, 0.8, [480, 760, 690, 430], diente({ vol: 0.35, filtro: [900, 1900, 1200, 700], q: 2.5, ataque: 0.08 })),
    ronroneo: (s, t) => [0, 0.75].forEach((d) => {
      for (let i = 0; i < 14; i++) s.tono(t + d + i * 0.042, 0.032, [62, 55], diente({ vol: 0.35, filtro: 220, clase: 'lowpass', ataque: 0.005 }));
    }),
    gallo: (s, t) => [[0, 0.13, 520, 620], [0.17, 0.13, 560, 700], [0.34, 0.15, 700, 780], [0.52, 0.65, 860, 560]].forEach(([d, dur, a, b]) =>
      s.tono(t + d, dur, [a, b + 80, b], diente({ vol: 0.3, filtro: [1500, 1900, 1200], q: 2, vib: [9, 14] }))),
    pajaro: (s, t) => [0, 0.17, 0.42, 0.59].forEach((d) => s.tono(t + d, 0.11, [2100, 3200, 2500], { vol: 0.22 })),
    abeja: (s, t) => s.tono(t, 1.1, [190, 230, 175, 215, 180], diente({ vol: 0.22, filtro: 900, clase: 'lowpass', ataque: 0.2, vib: [28, 14] })),
    buho: (s, t) => [[0, 0.35], [0.5, 0.75]].forEach(([d, dur]) => s.tono(t + d, dur, [360, 390, 320], { tipo: 'triangle', vol: 0.4, ataque: 0.1 })),
    boing: (s, t) => [0, 0.42].forEach((d, i) => s.tono(t + d, 0.34, [150, 520, 300, 380], { tipo: 'triangle', vol: i ? 0.25 : 0.4 })),
    rueda: (s, t) => [0, 1, 2, 3, 4, 5].forEach((i) => s.tono(t + i * 0.11, 0.1, [330 - i * 30, 200 - i * 18], { tipo: 'triangle', vol: 0.35 - i * 0.035 })),
    risa: (s, t) => [0, 0.13, 0.26, 0.39].forEach((d, i) => s.tono(t + d, 0.1, [620 + i * 50, 880 + i * 40, 700], { tipo: 'triangle', vol: 0.25 })),
    uy: (s, t) => s.tono(t, 0.5, [380, 640, 330], { tipo: 'triangle', vol: 0.35, ataque: 0.05 }),
    plaf: (s, t) => {
      s.ruido(t, 0.45, [1800, 220], { vol: 0.6, clase: 'lowpass' });
      s.tono(t, 0.18, [180, 60], { vol: 0.35 });
    },
    agua: (s, t) => {
      s.ruido(t, 1.1, [700, 1100, 800], { vol: 0.12, q: 0.8, ataque: 0.15 });
      [0, 0.22, 0.44, 0.66, 0.86].forEach((d, i) => s.tono(t + d, 0.14, [240 + i * 25, 620 + i * 40], { vol: 0.28 }));
    },
    plop: (s, t) => s.tono(t, 0.13, [280, 1150], { vol: 0.4, ataque: 0.008 }),
    fru: (s, t) => [0, 0.24, 0.48].forEach((d) => s.ruido(t + d, 0.2, [2400, 4200, 2000], { vol: 0.3, q: 1.2, ataque: 0.06 })),
    beso: (s, t) => {
      s.tono(t, 0.07, [350, 180], { vol: 0.3 });
      s.ruido(t + 0.1, 0.13, [1200, 3800], { vol: 0.4, q: 4 });
    },
    panza: (s, t) => s.tono(t, 1.1, [70, 120, 62, 105, 55], diente({ vol: 0.5, filtro: 330, clase: 'lowpass', ataque: 0.15, vib: [13, 16] })),
    nam: (s, t) => [0, 0.32].forEach((d) => s.tono(t + d, 0.24, [190, 260, 150], diente({ vol: 0.45, filtro: [350, 1300, 350], q: 3 }))),
    crac: (s, t) => [0, 0.05, 0.11].forEach((d, i) => s.ruido(t + d, 0.05, [3200 - i * 600, 1500], { vol: 0.55, q: 0.7, ataque: 0.003 })),
    mmm: (s, t) => s.tono(t, 0.9, [200, 265, 235], { tipo: 'triangle', vol: 0.4, ataque: 0.12, vib: [6, 5] }),
    tin: (s, t) => [1318.5, 1568, 2093].forEach((f, i) => s.tono(t + i * 0.09, 0.5, [f, f], { vol: 0.17, ataque: 0.005 })),
    /* cajita de música: arpegio propio, suave */
    nana: (s, t) => [659.3, 784, 987.8, 784, 880, 659.3, 523.3].forEach((f, i) => {
      const dur = i === 6 ? 1.1 : 0.55;
      s.tono(t + i * 0.34, dur, [f, f], { vol: 0.2, ataque: 0.01 });
      s.tono(t + i * 0.34, dur * 0.6, [f * 2, f * 2], { vol: 0.04, ataque: 0.01 });
    })
  };

  function tocar(nombre, ctx, salida) {
    const receta = RECETAS[nombre];
    if (!receta) return false;
    receta(herramientas(ctx, salida || ctx.destination), ctx.currentTime + 0.03);
    return true;
  }

  const Sonidos = { tocar, nombres: Object.keys(RECETAS) };
  if (typeof module !== 'undefined' && module.exports) module.exports = Sonidos;
  else raiz.Sonidos = Sonidos;
})(typeof window !== 'undefined' ? window : globalThis);
