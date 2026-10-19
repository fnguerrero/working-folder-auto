/* Corre la prueba de la regex en un hilo aparte, para que un backtracking catastrófico no cuelgue la página. */
"use strict";
importScripts("logica.js");
self.onmessage = (e) => {
  const { patron, opciones, texto } = e.data;
  try {
    const p = self.RegexEnCriollo.parsear(patron, opciones);
    const t0 = Date.now();
    const r = self.RegexEnCriollo.probar(p, texto);
    self.postMessage({ ok: true, matches: r.matches, problemas: r.problemas, error: r.error, ms: Date.now() - t0 });
  } catch (err) { self.postMessage({ ok: false, error: err.message }); }
};
