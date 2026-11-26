// Service worker mínimo: habilita la instalación y deja la app usable sin conexión.
const PREFIJO = "expensas-en-criollo-";
const CACHE = PREFIJO + "v1";
const ARCHIVOS = ["./", "./index.html", "./estilo.css", "./logica.js", "./app.js", "./manifest.json", "./icono.svg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())
  );
});

// El origen de GitHub Pages se comparte con otros proyectos: solo se borran los caches propios.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith(PREFIJO) && k !== CACHE).map((k) => caches.delete(k))))
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
      .catch(() => caches.open(CACHE).then((c) => c.match(pedido).then((hit) => hit || c.match("./index.html"))))
  );
});
