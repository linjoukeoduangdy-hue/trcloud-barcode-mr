// sw.js — ໃຫ້ໜ້າເວັບເປີດໄດ້ໄວ (ຈາກແຄຊ໌ກ່ອນສະເໝີ) ແລະ ຍັງໃຊ້ໄດ້ເຖິງແມ່ນບໍ່ມີອິນເຕີເນັດເລີຍ
// (ຫລັງຈາກເຄີຍເປີດຄັ້ງໜຶ່ງຕອນມີເນັດແລ້ວ) — /api/* ບໍ່ຖືກແຄຊ໌ ເພາະຕ້ອງການຂໍ້ມູນສົດສະເໝີ

const CACHE_NAME = "trcloud-mr-shell-v3";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/login.html",
  "/html5-qrcode.min.js",
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

  // /api/* ແລະ ຄຳຂໍທີ່ບໍ່ແມ່ນ GET: ໄປ network ໂດຍກົງສະເໝີ ບໍ່ແຄຊ໌
  // (login.html ເອງແຄຊ໌ໄດ້ປອດໄພ — ມັນບໍ່ກວດ session ຕອນໂຫລດ, ກວດແຕ່ຕອນກົດປຸ່ມ login ເທົ່ານັ້ນ)
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return; // ບໍ່ເອີ້ນ respondWith — ປ່ອຍໃຫ້ browser ຈັດການແບບປົກກະຕິ
  }

  // app shell (ໜ້າເວັບ + library ສະແກນບາໂຄດ): cache-first ໃຫ້ເປີດໄວທັນທີ
  // ແລ້ວອັບເດດແຄຊ໌ຢູ່ເບື້ອງຫລັງ (stale-while-revalidate) — ບໍ່ຕ້ອງລໍ Render ຕື່ນກ່ອນຈຶ່ງເຫັນຫຍັງ
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => cached || caches.match("/index.html"));

      // ມີແຄຊ໌ຢູ່ແລ້ວ → ສົ່ງຄືນທັນທີ (ໄວ), ພ້ອມອັບເດດຢູ່ເບື້ອງຫລັງ
      // ຍັງບໍ່ມີແຄຊ໌ (ເປີດຄັ້ງທຳອິດ) → ຕ້ອງລໍ network
      return cached || networkFetch;
    })
  );
});
