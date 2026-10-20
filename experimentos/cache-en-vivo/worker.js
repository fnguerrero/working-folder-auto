/* Worker de El caché en vivo: corre las simulaciones fuera del hilo principal. */
importScripts("logica.js");
const K = self.CacheVivo;
self.onmessage = (ev) => { const { id, pedido } = ev.data; try { self.postMessage({ id, resultado: K.correrTodo(pedido) }); } catch (e) { self.postMessage({ id, error: String(e && e.message || e) }); } };
