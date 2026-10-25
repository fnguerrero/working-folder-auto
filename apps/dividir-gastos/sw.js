// Service worker mínimo: habilita la instalación y deja la app usable sin conexión.
const CACHE = "dividir-gastos-v1";
const ARCHIVOS = ["./", "./index.html", "./logica.js", "./manifest.json", "./icono.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red, para que una versión nueva llegue sola; el cache es el respaldo.
self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET" || !pedido.url.startsWith(self.location.origin)) return;
  evento.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(pedido).then((hit) => hit || caches.match("./index.html")))
  );
});
