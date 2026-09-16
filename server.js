// server.js
// เว็บแอปตัดสต๊อกด้วยบาร์โค้ด -> TRCloud (สำหรับ deploy บน Render)
// รวม static frontend (public/index.html) + API routes ไว้ในเซิร์ฟเวอร์เดียว

import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// ---------------- Warehouse list ----------------
// ລາຍຊື່ຄັງ (warehouse) ຕ້ອງພິມໃຫ້ "ກົງກັບໃນ TRCloud ຮ້ອຍເປີເຊັນ" (ໂຕພິມນ້ອຍ/ໃຫຍ່, ວັນນະຍຸດ)
// ເອົາຊື່ຈາກ dropdown "ຄັງສິນຄ້າ" ໃນໜ້າ TRCloud > ເບີກສິນຄ້າ/ວັດຖຸດິບ > General ມາໃສ່ຢູ່ນີ້
// ຖ້າຢາກແກ້ໄວອອນລາຍ ໂດຍບໍ່ຕ້ອງແກ້ໂຄ້ດ, ຕັ້ງ env var TRCLOUD_WAREHOUSES ເປັນລາຍການຄັ່ນດ້ວຍ , ແທນ
const DEFAULT_WAREHOUSES = ["ເຊໂປນ"];
const WAREHOUSES = process.env.TRCLOUD_WAREHOUSES
  ? process.env.TRCLOUD_WAREHOUSES.split(",").map((w) => w.trim()).filter(Boolean)
  : DEFAULT_WAREHOUSES;

app.get("/api/warehouses", (req, res) => {
  res.status(200).json({ warehouses: WAREHOUSES });
});

const TRCLOUD_SEARCH_ENDPOINT =
  "https://thaidrill.trcloud.co/application/api-connector/end-point/engine-inventory/search-inventory.php";
const TRCLOUD_MR_ENDPOINT =
  "https://thaidrill.trcloud.co/application/api-connector/end-point/engine-mr/mr.php";

function buildSecureKey(encryptHead, timestamp) {
  const raw = `${encryptHead}t${timestamp}`;
  return crypto.createHash("md5").update(raw).digest("hex");
}

function generateDocumentNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
  return `${yy}${mm}${dd}${rand}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * เรียก TRCloud API พร้อม:
 * - ใส่ User-Agent แบบ browser (บาง endpoint ที่มี Cloudflare กั้นอยู่ จะบล็อก/ปฏิเสธ request
 *   ที่ไม่มี User-Agent เหมือนคนใช้เบราว์เซอร์จริง เป็นระยะ)
 * - retry อัตโนมัติสูงสุด 3 ครั้งถ้าเจอ error ชั่วคราว (network error, 5xx, หรือ body ว่าง/parse ไม่ได้)
 * - อ่าน response เป็น text ก่อนเสมอ แล้วค่อยลอง parse JSON เพื่อให้เห็น raw response
 *   จริงๆ ตอน debug ถ้า parse ไม่ผ่าน (ไม่ใช่เดาจาก error ทั่วไปแบบเดิม)
 */
async function callTRCloud(url, payload, { retries = 3, retryDelayMs = 1500 } = {}) {
  const formData = new URLSearchParams();
  formData.append("json", JSON.stringify(payload));

  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const trResp = await fetch(url, {
        method: "POST",
        headers: {
          Origin: process.env.TRCLOUD_ORIGIN,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
        body: formData.toString(),
      });

      const rawText = await trResp.text();

      if (!rawText || !rawText.trim()) {
        throw new Error(`TRCloud ตอบกลับเป็นค่าว่าง (HTTP ${trResp.status})`);
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        // แนบ raw response (ตัดให้สั้นลง) ไว้ใน error เพื่อ debug ได้ง่ายขึ้น
        const snippet = rawText.slice(0, 300);
        throw new Error(
          `แปลงผลลัพธ์จาก TRCloud เป็น JSON ไม่ได้ (HTTP ${trResp.status}): ${snippet}`
        );
      }

      return { ok: trResp.ok, status: trResp.status, data };
    } catch (err) {
      lastError = err;
      console.error(`[callTRCloud] พยายามครั้งที่ ${attempt}/${retries} ล้มเหลว: ${err.message}`);
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError;
}

// ---------------- GET /api/lookup?sku=... ----------------
app.get("/api/lookup", async (req, res) => {
  const sku = (req.query.sku || "").toString().trim();
  if (!sku) {
    return res.status(400).json({ error: "กรุณาระบุ sku" });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secureKey = buildSecureKey(process.env.TRCLOUD_ENCRYPT_HEAD, timestamp);

  const payload = {
    company_id: process.env.TRCLOUD_COMPANY_ID,
    passkey: process.env.TRCLOUD_PASSKEY,
    securekey: secureKey,
    timestamp,
    keyword: sku,
    start: 0,
  };

  try {
    const { data } = await callTRCloud(TRCLOUD_SEARCH_ENDPOINT, payload);

    if (data.success !== 1) {
      return res.status(404).json({ error: data.message || "ไม่พบสินค้า" });
    }

    const results = data.result || [];
    const exact = results.find((p) => p.product_id === sku);
    const product = exact || results[0];

    if (!product) {
      return res.status(404).json({ error: `ไม่พบสินค้ารหัส "${sku}" ในระบบ` });
    }

    return res.status(200).json({
      product_id: product.product_id,
      product_name: product.product_name,
      balance: product.balance,
      unit: product.unit,
    });
  } catch (err) {
    console.error("[/api/lookup] error:", err.message);
    return res.status(502).json({ error: `เชื่อมต่อ TRCloud ไม่สำเร็จ: ${err.message}` });
  }
});

// ---------------- POST /api/submit-mr ----------------
app.post("/api/submit-mr", async (req, res) => {
  const { items, warehouse, request_by, purpose, department } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "ไม่มีรายการสินค้าในตะกร้า" });
  }

  for (const it of items) {
    if (!it.product_id || !it.quantity || Number(it.quantity) <= 0) {
      return res.status(400).json({ error: "รายการสินค้าต้องมี product_id และ quantity มากกว่า 0" });
    }
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const secureKey = buildSecureKey(process.env.TRCLOUD_ENCRYPT_HEAD, timestamp);
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    company_id: process.env.TRCLOUD_COMPANY_ID,
    passkey: process.env.TRCLOUD_PASSKEY,
    securekey: secureKey,
    timestamp,
    accounting_formula: "mr",
    gl_entry: "yes",
    date: today,
    contact_id: "0",
    company_format: "MR",
    document_number: generateDocumentNumber(),
    status: "",
    request_by: request_by || "",
    purpose: purpose || "",
    client_name: "",
    client_telephone: "",
    description: "",
    salesman: "",
    department: department || "",
    project: "",
    warehouse: warehouse || "",
    url: "",
    approve_status: "",
    c1: "",
    c2: "",
    c3: "",
    c4: "",
    c5: "",
    product: items.map((it) => ({
      id: it.product_id,
      product: it.product_name || it.product_id,
      quantity: String(it.quantity),
      warehouse: warehouse || "",
      remark: "",
      serial: "",
    })),
  };

  try {
    const { data } = await callTRCloud(TRCLOUD_MR_ENDPOINT, payload);
    return res.status(200).json(data);
  } catch (err) {
    console.error("[/api/submit-mr] error:", err.message);
    return res.status(502).json({ error: `เชื่อมต่อ TRCloud ไม่สำเร็จ: ${err.message}` });
  }
});

// health check เผื่อ Render ping ตรวจสอบ
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
