/* Lectura en voz alta con speechSynthesis.
   La pausa no usa speechSynthesis.pause() porque en Chrome de Android corta la lectura:
   se lee frase por frase, y al seguir se retoma desde el comienzo de la frase interrumpida. */
(function (raiz) {
  'use strict';

  const frases = (texto) => (texto.match(/[^.!?]+[.!?]*/g) || [texto]).map((f) => f.trim()).filter(Boolean);

  /* Prefiere español rioplatense, después latinoamericano, después cualquiera en español. */
  function elegirVoz(voces) {
    const orden = ['es-ar', 'es-uy', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-cl', 'es-es', 'es'];
    const puntaje = (v) => {
      const lang = String(v.lang || '').toLowerCase().replace('_', '-');
      if (!lang.startsWith('es')) return -1;
      const i = orden.indexOf(lang);
      return (i < 0 ? 1 : 100 - i * 10) + (v.localService ? 1 : 0);
    };
    return voces.filter((v) => puntaje(v) >= 0).sort((a, b) => puntaje(b) - puntaje(a))[0] || null;
  }

  function crearLector({ sintesis, Frase, alCambiar, alFallar }) {
    let estado = 'quieto'; // quieto | leyendo | pausado
    let cola = [];
    let indice = 0;
    let turno = 0;
    let actual = null; // se guarda la referencia: si no, Chrome puede perder el evento onend

    const disponible = !!(sintesis && Frase);
    const cambiar = (nuevo) => {
      estado = nuevo;
      if (alCambiar) alCambiar(estado);
    };

    function decir() {
      if (indice >= cola.length) {
        actual = null;
        cambiar('quieto');
        return;
      }
      const mio = ++turno;
      const u = new Frase(cola[indice]);
      const voz = elegirVoz(sintesis.getVoices());
      if (voz) u.voice = voz;
      u.lang = voz ? voz.lang : 'es-AR';
      u.rate = 0.85;
      u.pitch = 1.1;
      u.onend = () => {
        if (mio !== turno) return;
        indice++;
        decir();
      };
      u.onerror = () => {
        if (mio !== turno) return;
        turno++;
        cambiar('quieto');
        if (alFallar) alFallar();
      };
      actual = u;
      sintesis.speak(u);
    }

    function callar() {
      turno++;
      actual = null;
      if (disponible) sintesis.cancel();
    }

    return {
      disponible,
      estado: () => estado,
      frase: () => (actual ? actual.text : null),
      leer(texto) {
        if (!disponible) return;
        callar();
        cola = frases(texto);
        indice = 0;
        cambiar('leyendo');
        decir();
      },
      pausar() {
        if (estado !== 'leyendo') return;
        callar();
        cambiar('pausado');
      },
      seguir() {
        if (estado !== 'pausado') return;
        cambiar('leyendo');
        decir();
      },
      parar() {
        callar();
        cola = [];
        indice = 0;
        cambiar('quieto');
      }
    };
  }

  const Voz = { frases, elegirVoz, crearLector };
  if (typeof module !== 'undefined' && module.exports) module.exports = Voz;
  else raiz.Voz = Voz;
})(typeof window !== 'undefined' ? window : globalThis);
