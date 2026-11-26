// Preferencias de lectura (tamaño de letra y tema), guardadas en el navegador.
(function () {
  var raiz = document.documentElement;
  function leer(k) { try { return localStorage.getItem('clementina.' + k); } catch (e) { return null; } }
  function guardar(k, v) { try { localStorage.setItem('clementina.' + k, v); } catch (e) { /* sin almacenamiento */ } }
  var escala = parseFloat(leer('escala')) || 1;
  var tema = leer('tema');
  function aplicar() {
    raiz.style.setProperty('--escala', escala);
    if (tema) raiz.setAttribute('data-tema', tema);
  }
  aplicar();
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-accion]');
    if (!b) return;
    var a = b.getAttribute('data-accion');
    if (a === 'tema') {
      var oscuro = tema ? tema === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches;
      tema = oscuro ? 'claro' : 'oscuro';
      guardar('tema', tema);
    } else {
      escala = Math.min(1.5, Math.max(0.85, Math.round((escala + (a === 'mas' ? 0.1 : -0.1)) * 100) / 100));
      guardar('escala', escala);
    }
    aplicar();
  });
})();
