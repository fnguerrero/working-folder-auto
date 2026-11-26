/* Portada, páginas, gestos, sonidos y lectura. Con ?mudo en la dirección no suena nada. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const CUENTOS = window.CUENTOS;
  const mudo = new URLSearchParams(location.search).has('mudo');

  const guardado = {
    leer(clave, defecto) {
      try {
        const v = localStorage.getItem('cuentos.' + clave);
        return v === null ? defecto : v === '1';
      } catch (e) { return defecto; }
    },
    poner(clave, valor) {
      try { localStorage.setItem('cuentos.' + clave, valor ? '1' : '0'); } catch (e) { /* sin guardado */ }
    }
  };

  const opciones = { sonidos: guardado.leer('sonidos', true), leerSolo: guardado.leer('leerSolo', false) };
  let cuento = null;
  let num = 0; // 0..paginas.length (el último es el "Fin")
  let venimosDePortada = false;

  /* ---------- sonido ---------- */
  let audio = null;
  let canal = null;

  function sonar(nombre) {
    if (mudo || !opciones.sonidos) return;
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    try {
      if (!audio) audio = new Contexto();
      if (audio.state === 'suspended') audio.resume();
      // un sonido por vez: se corta el anterior para que no se amontonen
      if (canal) canal.disconnect();
      canal = audio.createDynamicsCompressor();
      canal.connect(audio.destination);
      window.Sonidos.tocar(nombre, audio, canal);
    } catch (e) { /* si el audio falla, el cuento sigue */ }
  }

  /* ---------- voz ---------- */
  const lector = window.Voz.crearLector({
    sintesis: mudo ? null : window.speechSynthesis,
    Frase: mudo ? null : window.SpeechSynthesisUtterance,
    alCambiar: pintarBotonLeer,
    alFallar: () => avisar('El navegador no pudo leer en voz alta.')
  });

  function pintarBotonLeer(estado) {
    const [icono, texto] = estado === 'leyendo' ? ['⏸', 'Pausa'] : estado === 'pausado' ? ['▶', 'Seguir'] : ['🔊', 'Leer'];
    $('leer-icono').textContent = icono;
    $('leer-texto').textContent = texto;
  }

  function textoActual() {
    if (!cuento) return '';
    const p = cuento.paginas[num];
    return p ? (p.voz || p.texto) : 'Fin.';
  }

  function botonLeer() {
    if (!lector.disponible) {
      avisar(mudo ? 'Modo mudo: la lectura está apagada.' : 'Este navegador no puede leer en voz alta.');
      return;
    }
    const e = lector.estado();
    if (e === 'leyendo') lector.pausar();
    else if (e === 'pausado') lector.seguir();
    else {
      const voces = window.speechSynthesis.getVoices();
      if (voces.length && !window.Voz.elegirVoz(voces)) avisar('No encontré una voz en español en este equipo.');
      lector.leer(textoActual());
    }
  }

  let relojAviso = 0;
  function avisar(mensaje) {
    const a = $('aviso');
    a.textContent = mensaje;
    a.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { a.hidden = true; }, 4000);
  }

  /* ---------- dibujo ---------- */
  const svg = (contenido, etiqueta) =>
    `<svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" ${etiqueta ? `role="group" aria-label="${etiqueta}"` : 'aria-hidden="true" focusable="false"'}>${contenido}</svg>`;

  /* en las miniaturas no puede haber nada tocable ni enfocable */
  const miniatura = (c) => svg(c.paginas[c.tapa || 0].dibujo().replace(/ (class="toca"|role="button"|tabindex="0"|data-son="[^"]*"|data-dice="[^"]*"|aria-label="[^"]*")/g, ''));

  function armarPortada() {
    $('lista').innerHTML = CUENTOS.map((c) => `
      <li><a class="tarjeta" href="#${c.slug}" style="--color:${c.color}">
        <span class="mini">${miniatura(c)}</span>
        <span class="datos"><strong>${c.emoji} ${c.titulo}</strong><span>${c.resumen}</span></span>
      </a></li>`).join('');
    $('imprimir').innerHTML = CUENTOS.map((c) => `<li><a href="cuentos/${c.slug}.md">${c.titulo}</a></li>`).join('');
    $('lista').addEventListener('click', () => { venimosDePortada = true; });
  }

  function pintarPagina() {
    const total = cuento.paginas.length;
    const p = cuento.paginas[num];
    const fin = !p;
    $('lienzo').innerHTML = fin ? miniatura(cuento) : svg(p.dibujo(), 'Dibujo: tocalo para escuchar');
    $('texto').textContent = fin ? 'Fin' : p.texto;
    $('libro').classList.toggle('es-fin', fin);
    $('fin').hidden = !fin;
    $('anterior').disabled = num === 0;
    $('siguiente').disabled = fin;
    $('puntos').innerHTML = cuento.paginas.map((_, i) => `<i class="${i === num ? 'actual' : ''}"></i>`).join('');
    $('numero').textContent = fin ? 'Fin del cuento' : `Página ${num + 1} de ${total}`;
    $('globos').textContent = '';
  }

  function irA(n) {
    if (!cuento) return;
    const destino = Math.max(0, Math.min(cuento.paginas.length, n));
    if (destino === num) return;
    const adelante = destino > num;
    num = destino;
    lector.parar();
    // pasar de página no suma historia: "atrás" del celular vuelve a la portada
    history.replaceState(null, '', `#${cuento.slug}/${num + 1}`);
    pintarPagina();
    const l = $('lienzo');
    l.classList.remove('entra-der', 'entra-izq');
    void l.offsetWidth;
    l.classList.add(adelante ? 'entra-der' : 'entra-izq');
    if (opciones.leerSolo && lector.disponible) lector.leer(textoActual());
  }

  function mostrarRuta() {
    const [slug, pag] = location.hash.slice(1).split('/');
    const nuevo = CUENTOS.find((c) => c.slug === slug) || null;
    const cambio = nuevo !== cuento;
    const n = nuevo ? Math.max(0, Math.min(nuevo.paginas.length, (parseInt(pag, 10) || 1) - 1)) : 0;
    if (!cambio && n === num) return;
    lector.parar();
    cuento = nuevo;
    num = n;
    $('portada').hidden = !!cuento;
    $('libro').hidden = !cuento;
    if (!cuento) {
      venimosDePortada = false;
      $('lienzo').textContent = '';
      document.title = 'Cuentos para Valentín';
      return;
    }
    document.title = `${cuento.titulo} · Cuentos para Valentín`;
    $('titulo-cuento').textContent = cuento.titulo;
    $('libro').style.setProperty('--color', cuento.color);
    window.scrollTo(0, 0);
    pintarPagina();
    if (cambio && opciones.leerSolo && lector.disponible) lector.leer(textoActual());
  }

  function aPortada() {
    if (venimosDePortada) {
      history.back();
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      mostrarRuta();
    }
  }

  /* ---------- tocar el dibujo ---------- */
  function activar(elemento, x, y) {
    const p = cuento && cuento.paginas[num];
    if (!p) return;
    let blanco = elemento && elemento.closest ? elemento.closest('.toca') : null;
    if (!blanco) {
      // tocar el fondo hace sonar lo principal de la página
      blanco = $('lienzo').querySelector(`.toca[data-son="${p.son}"]`);
    }
    const son = blanco ? blanco.dataset.son : p.son;
    sonar(son);
    if (!blanco) return;
    blanco.classList.remove('salta');
    void blanco.getBoundingClientRect();
    blanco.classList.add('salta');
    const caja = $('escena').getBoundingClientRect();
    const cosa = blanco.getBoundingClientRect();
    const px = x === undefined ? cosa.left + cosa.width / 2 : x;
    const py = y === undefined ? cosa.top + cosa.height / 3 : y;
    const globo = document.createElement('span');
    globo.className = 'globo';
    globo.textContent = blanco.dataset.dice;
    $('globos').replaceChildren(globo);
    const mitad = globo.offsetWidth / 2;
    globo.style.left = Math.max(mitad + 4, Math.min(caja.width - mitad - 4, px - caja.left)) + 'px';
    globo.style.top = Math.max(globo.offsetHeight + 4, py - caja.top - 14) + 'px';
    globo.addEventListener('animationend', () => globo.remove());
  }

  function gestos() {
    const escena = $('escena');
    let inicio = null;
    escena.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary || e.button > 0) return;
      inicio = { x: e.clientX, y: e.clientY, id: e.pointerId, blanco: e.target };
      try { escena.setPointerCapture(e.pointerId); } catch (err) { /* puntero ya soltado */ }
    });
    escena.addEventListener('pointerup', (e) => {
      if (!inicio || e.pointerId !== inicio.id) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      const blanco = inicio.blanco;
      inicio = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) irA(num + (dx < 0 ? 1 : -1));
      // los toques de un bebé arrastran un poco: cualquier gesto corto cuenta como toque
      else if (Math.hypot(dx, dy) < 45) activar(blanco, e.clientX, e.clientY);
    });
    escena.addEventListener('pointercancel', () => { inicio = null; });
    escena.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function teclado(e) {
    if (!cuento || e.ctrlKey || e.metaKey || e.altKey) return;
    const enDibujo = e.target.closest && e.target.closest('.toca');
    const enControl = e.target.closest && e.target.closest('button, a, input');
    if (e.key === 'ArrowRight' || e.key === 'PageDown') irA(num + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') irA(num - 1);
    else if (e.key === 'Escape') aPortada();
    else if (enDibujo && (e.key === 'Enter' || e.key === ' ')) activar(enDibujo);
    else if (!enControl && e.key === ' ') botonLeer();
    else if (!enControl && e.key === 'Enter') activar(null);
    else return;
    e.preventDefault();
  }

  function pintarOpciones() {
    $('op-sonidos').setAttribute('aria-pressed', String(opciones.sonidos));
    $('op-sonidos').textContent = opciones.sonidos ? '🔔' : '🔕';
    $('op-leer').setAttribute('aria-pressed', String(opciones.leerSolo));
  }

  /* ---------- arranque ---------- */
  armarPortada();
  pintarOpciones();
  pintarBotonLeer('quieto');
  gestos();

  $('anterior').addEventListener('click', () => irA(num - 1));
  $('siguiente').addEventListener('click', () => irA(num + 1));
  $('leer').addEventListener('click', botonLeer);
  $('casa').addEventListener('click', aPortada);
  $('otro').addEventListener('click', aPortada);
  $('otra-vez').addEventListener('click', () => irA(0));
  $('op-sonidos').addEventListener('click', () => {
    opciones.sonidos = !opciones.sonidos;
    guardado.poner('sonidos', opciones.sonidos);
    pintarOpciones();
    if (!opciones.sonidos && canal) canal.disconnect();
    avisar(opciones.sonidos ? 'Sonidos prendidos.' : 'Sonidos apagados.');
  });
  $('op-leer').addEventListener('click', () => {
    opciones.leerSolo = !opciones.leerSolo;
    guardado.poner('leerSolo', opciones.leerSolo);
    pintarOpciones();
    avisar(opciones.leerSolo ? 'Cada página se lee sola.' : 'Se lee solo cuando tocás «Leer».');
    if (!lector.disponible) return;
    if (opciones.leerSolo) lector.leer(textoActual());
    else lector.parar();
  });

  document.addEventListener('keydown', teclado);
  window.addEventListener('popstate', mostrarRuta);
  window.addEventListener('hashchange', mostrarRuta);
  window.addEventListener('pagehide', () => lector.parar());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    lector.pausar();
    if (canal) canal.disconnect();
  });
  // algunas voces cargan tarde
  if (lector.disponible) window.speechSynthesis.getVoices();

  mostrarRuta();
})();
