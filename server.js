// server.js
// เว็บแอปตัดสต๊อกด้วยบาร์โค้ด -> TRCloud (สำหรับ deploy บน Render)
// รวม static frontend (public/index.html) + API routes ไว้ในเซิร์ฟเวอร์เดียว

import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// =================================================================
// ---------------- Dropdown option lists (ແກ້ໄດ້ຜ່ານໜ້າ /admin.html) ----------------
// ຄ່າໃນນີ້ຕ້ອງພິມໃຫ້ "ກົງກັບໃນ TRCloud ຮ້ອຍເປີເຊັນ" (ໂຕພິມນ້ອຍ/ໃຫຍ່, ວັນນະຍຸດ, ຂີດກາງ)
// ຄັ້ງທຳອິດທີ່ເປີດ server ຄ່າຈະຖືກສ້າງຈາກ DEFAULT_* ຫລື env var ຂ້າງລຸ່ມ ແລ້ວບັນທຶກລົງໄຟລ໌
// options-store.json ໄວ້, ຈາກນັ້ນໄປແກ້ໄຂ/ເພີ່ມໄດ້ຈາກໜ້າ /admin.html ໂດຍກົງ ບໍ່ຕ້ອງແກ້ໂຄ້ດອີກ
// =================================================================
const OPTIONS_FILE = path.join(__dirname, "options-store.json");

const DEFAULT_OPTIONS = {
  warehouses: parseListEnv(process.env.TRCLOUD_WAREHOUSES, ["ເຊໂປນ"]),
  departments: parseListEnv(process.env.TRCLOUD_DEPARTMENTS, ["ໂຄງການເຊໂປນ-ແທ່ງຄຳແລແໜ"]),
  projects: parseListEnv(process.env.TRCLOUD_PROJECTS, ["TN-654_ງານຊ່ອມບຳລຸງ"]),
  salesmen: parseListEnv(process.env.TRCLOUD_SALESMEN, ["Linju_Keoduangdy"]),
  accounting_formulas: parseListEnv(process.env.TRCLOUD_ACCOUNTING_FORMULAS, ["mr"]),
};

function parseListEnv(envVal, fallback) {
  return envVal
    ? envVal.split(",").map((w) => w.trim()).filter(Boolean)
    : fallback;
}

function loadOptions() {
  try {
    const raw = fs.readFileSync(OPTIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    // ผสานกับ DEFAULT_OPTIONS เผื่อไฟล์เก่าขาดคีย์ใหม่ (เช่น accounting_formulas ที่เพิ่งเพิ่ม)
    return { ...DEFAULT_OPTIONS, ...parsed };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

function saveOptions(options) {
  fs.writeFileSync(OPTIONS_FILE, JSON.stringify(options, null, 2), "utf8");
}

let OPTIONS = loadOptions();
saveOptions(OPTIONS); // ให้แน่ใจว่าไฟล์มีอยู่ตั้งแต่แรกเริ่ม

// ADMIN_KEY: กันไม่ให้ใครก็ได้เข้ามาแก้ dropdown ได้ผ่าน /admin.html
// ตั้ง env var ADMIN_KEY ใน Render เป็นรหัสที่เจ้าเลือกเอง แล้วใช้รหัสเดียวกันตอนล็อกอินหน้า admin
const ADMIN_KEY = process.env.ADMIN_KEY || "changeme";

function checkAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"] || "";
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "ລະຫັດ admin ບໍ່ຖືກຕ້ອງ" });
  }
  next();
}

app.get("/api/form-options", (req, res) => {
  res.status(200).json(OPTIONS);
});

app.get("/api/admin/options", checkAdminKey, (req, res) => {
  res.status(200).json(OPTIONS);
});

app.post("/api/admin/options", checkAdminKey, (req, res) => {
  const body = req.body || {};
  const fields = ["warehouses", "departments", "projects", "salesmen", "accounting_formulas"];
  const next = { ...OPTIONS };

  for (const field of fields) {
    if (Array.isArray(body[field])) {
      next[field] = body[field]
        .map((v) => String(v).trim())
        .filter(Boolean);
    }
  }

  try {
    saveOptions(next);
    OPTIONS = next;
    return res.status(200).json({ success: true, options: OPTIONS });
  } catch (err) {
    return res.status(500).json({ error: `ບັນທຶກບໍ່ສຳເລັດ: ${err.message}` });
  }
});

// =================================================================
// ---------------- ເລກທີ MR (document_number) ----------------
// ຮູບແບບ: YYMMDD + ເລກແລ່ນຕໍ່ພາຍໃນມື້ນັ້ນ (ຣີເຊັດເປັນ 01 ທຸກມື້ໃໝ່) ເຊັ່ນ 26091601, 26091602, ...
// ໝາຍເຫດ: ນັບຕໍ່ຈາກໄຟລ໌ mr-counter.json ຢູ່ໃນ server — ຖ້າ Render redeploy ໂຄ້ດໃໝ່
// (ບໍ່ແມ່ນແຄ່ sleep/wake ທຳມະດາ) ໄຟລ໌ນີ້ອາດຖືກລ້າງ ແລະ ນັບເລີ່ມ 01 ຄືນອີກໃນມື້ນັ້ນ
// =================================================================
const COUNTER_FILE = path.join(__dirname, "mr-counter.json");

function loadCounterState() {
  try {
    const raw = fs.readFileSync(COUNTER_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { date: "", count: 0 };
  }
}

function saveCounterState(state) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(state), "utf8");
  } catch (err) {
    console.error("[counter] ບັນທຶກໄຟລ໌ຕົວນັບບໍ່ສຳເລັດ:", err.message);
  }
}

function generateDocumentNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateKey = `${yy}${mm}${dd}`;

  const state = loadCounterState();
  if (state.date !== dateKey) {
    state.date = dateKey;
    state.count = 0;
  }
  state.count += 1;
  saveCounterState(state);

  const seq = String(state.count).padStart(2, "0");
  return `${dateKey}${seq}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TRCLOUD_SEARCH_ENDPOINT =
  "https://thaidrill.trcloud.co/application/api-connector/end-point/engine-inventory/search-inventory.php";
const TRCLOUD_MR_ENDPOINT =
  "https://thaidrill.trcloud.co/application/api-connector/end-point/engine-mr/mr.php";

function buildSecureKey(encryptHead, timestamp) {
  const raw = `${encryptHead}t${timestamp}`;
  return crypto.createHash("md5").update(raw).digest("hex");
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
  const {
    items,
    warehouse,
    request_by,
    purpose,
    department,
    project,
    salesman,
    accounting_formula,
  } = req.body || {};

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
    accounting_formula: accounting_formula || "mr",
    gl_entry: "yes",
    date: today,
    contact_id: "0",
    company_format: "MR",
    document_number: generateDocumentNumber(),
    status: "ขนส่งเสร็จสิ้น",
    request_by: request_by || "",
    purpose: purpose || "",
    client_name: "",
    client_telephone: "",
    description: "",
    salesman: salesman || "",
    department: department || "",
    project: project || "",
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
