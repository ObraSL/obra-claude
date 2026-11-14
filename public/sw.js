// Service worker mínimo: solo lo justo para que el navegador considere la app
// "instalable" (icono en el móvil).
//
// IMPORTANTE: NO se cachean las páginas (navegaciones HTML). Se intentó antes y
// provocaba que el móvil siguiera viendo una versión antigua de la app cuando el
// servidor no estaba accesible. Mientras estamos iterando el diseño, siempre
// queremos la última versión. El modo sin conexión de verdad (fichar sin
// cobertura) se hará aparte, con su propia cola de datos.
const CACHE_NAME = "control-de-obra-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Borra cualquier caché anterior (incluida la v1, que sí guardaba páginas).
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Las páginas siempre desde la red: nunca servimos HTML antiguo.
  if (request.mode === "navigate") return;
  if (request.method !== "GET") return;

  // Para el resto (imágenes, iconos, JS/CSS con hash en el nombre) intentamos
  // red primero y solo tiramos de caché si la red falla.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && new URL(request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
