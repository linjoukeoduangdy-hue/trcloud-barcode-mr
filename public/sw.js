// sw.js — ໃຫ້ໜ້າເວັບເປີດໄດ້ໄວ (ຈາກແຄຊ໌ກ່ອນສະເໝີ) ແລະ ຍັງໃຊ້ໄດ້ເຖິງແມ່ນບໍ່ມີອິນເຕີເນັດເລີຍ
// (ຫລັງຈາກເຄີຍເປີດຄັ້ງໜຶ່ງຕອນມີເນັດແລ້ວ) — /api/* ບໍ່ຖືກແຄຊ໌ ເພາະຕ້ອງການຂໍ້ມູນສົດສະເໝີ

const CACHE_NAME = "trcloud-mr-shell-v4";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/login.html",
  "/html5-qrcode.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // ແຄຊ໌ເທື່ອລະໄຟລ໌ແຍກກັນ — ຖ້າໄຟລ໌ໃດໄຟລ໌ໜຶ່ງພັງ (ເຊັ່ນ "/" ຕ້ອງ login ກ່ອນ)
      // ບໍ່ໃຫ້ກະທົບໄຟລ໌ອື່ນ (login.html ເດີມ cache.addAll() ແບບເກົ່າ ຖ້າໄຟລ໌ໃດໜຶ່ງພັງ
      // ຈະເຮັດໃຫ້ "ທຸກໄຟລ໌" ບໍ່ຖືກແຄຊ໌ເລີຍ ນີ້ຄືຈຸດອ່ອນທີ່ແກ້ຢູ່ນີ້)
      Promise.all(
        SHELL_FILES.map((url) =>
          fetch(url)
            .then((resp) => (resp && resp.ok ? cache.put(url, resp) : null))
            .catch(() => {})
        )
      )
    )
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
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return; // ບໍ່ເອີ້ນ respondWith — ປ່ອຍໃຫ້ browser ຈັດການແບບປົກກະຕິ
  }

  // app shell: cache-first ໃຫ້ເປີດໄວທັນທີ ແລ້ວອັບເດດແຄຊ໌ຢູ່ເບື້ອງຫລັງ (stale-while-revalidate)
  // ສຳຄັນ: ຕ້ອງສົ່ງ Response ທີ່ແທ້ຈິງກັບທຸກຄັ້ງ — ຖ້າ resolve ເປັນ undefined
  // browser ຈະສະແດງ "ERR_FAILED" (ນີ້ຄື bug ທີ່ແກ້ຢູ່ນີ້: ມີ fallback ສຸດທ້າຍສະເໝີ)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(async () => {
          const fallback = cached || (await caches.match("/index.html"));
          if (fallback) return fallback;
          // ບໍ່ມີຫຍັງໃຫ້ fallback ເລີຍ (ຄັ້ງທຳອິດ+network ພັງ) — ສົ່ງໜ້າ error ແທນ undefined
          return new Response(
            "<h1>ເຊື່ອມຕໍ່ server ບໍ່ໄດ້</h1><p>ກະລຸນາລອງໃໝ່ພາຍຫລັງ</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        });

      return cached || networkFetch;
    })
  );
});
