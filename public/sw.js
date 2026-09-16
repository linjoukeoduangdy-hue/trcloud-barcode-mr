// sw.js — ໃຫ້ໜ້າເວັບເປີດໄດ້ ແລະ ສະແກນບາໂຄດໄດ້ ເຖິງແມ່ນບໍ່ມີອິນເຕີເນັດເລີຍ
// (ຫລັງຈາກເຄີຍເປີດຄັ້ງໜຶ່ງຕອນມີເນັດແລ້ວ) — /api/* ບໍ່ຖືກແຄຊ໌ ເພາະຕ້ອງການຂໍ້ມູນສົດສະເໝີ

const CACHE_NAME = "trcloud-mr-shell-v1";
const SHELL_FILES = [
  "/",
  "/index.html",
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // /api/* ແລະ ຄຳຂໍທີ່ບໍ່ແມ່ນ GET: ໃຫ້ໄປ network ໂດຍກົງສະເໝີ ບໍ່ແຄຊ໌
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return; // ບໍ່ເອີ້ນ respondWith — ປ່ອຍໃຫ້ browser ຈັດການແບບປົກກະຕິ
  }

  // app shell / CDN script: network-first, fallback ເປັນແຄຊ໌ຕອນອອບລາຍ
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
