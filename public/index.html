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

// =================================================================
// ---------------- ຄ່າຄົງທີ່ (fixed values) ----------------
// ຄ່າເຫລົ່ານີ້ຖືກ fix ໄວ້ຢູ່ server ແລ້ວ ບໍ່ມີຊ່ອງໃຫ້ເລືອກໃນໜ້າເວັບ
// ຕ້ອງພິມໃຫ້ "ກົງກັບໃນ TRCloud ຮ້ອຍເປີເຊັນ" (ໂຕພິມນ້ອຍ/ໃຫຍ່, ວັນນະຍຸດ, ຂີດກາງ)
// ຖ້າຢາກປ່ຽນ ໂດຍບໍ່ຕ້ອງແກ້ໂຄ້ດ ໃຫ້ຕັ້ງ env var ທີ່ກ່ຽວຂ້ອງໃນ Render
// =================================================================
const FIXED_WAREHOUSE = process.env.TRCLOUD_WAREHOUSE || "คลังเซโปน";
const FIXED_PROJECT = process.env.TRCLOUD_PROJECT || "โครงการเซโปน-แท่งคำและนาลู";
const FIXED_DEPARTMENT = process.env.TRCLOUD_DEPARTMENT || "";
const FIXED_SALESMAN = process.env.TRCLOUD_SALESMAN || "";
const FIXED_ACCOUNTING_FORMULA =
  process.env.TRCLOUD_ACCOUNTING_FORMULA || "Internal Issue_ค่าวัสดุสิ้นเปลือง";
const FIXED_STATUS = process.env.TRCLOUD_STATUS || "ขนส่งเสร็จสิ้น";

// ສະແດງຄ່າຄົງທີ່ໃຫ້ໜ້າເວັບອ່ານໄປສະແດງ (ອ່ານຢ່າງດຽວ ແກ້ຜ່ານໜ້າເວັບບໍ່ໄດ້)
app.get("/api/form-options", (req, res) => {
  res.status(200).json({
    warehouse: FIXED_WAREHOUSE,
    project: FIXED_PROJECT,
    department: FIXED_DEPARTMENT,
    salesman: FIXED_SALESMAN,
    accounting_formula: FIXED_ACCOUNTING_FORMULA,
    status: FIXED_STATUS,
  });
});

// =================================================================
// ---------------- ເລກທີ MR (document_number) ----------------
// ວິທີເກົ່າ (ສ້າງເລກເອງຈາກໄຟລ໌ນັບ) ເຮັດໃຫ້ເລກຊ້ຳກັນ ແລະ ຕັດສະຕ໊ອກບໍ່ໄດ້ ເພາະ:
//   - Render Free Tier ລ້າງ disk ທຸກຄັ້ງທີ່ redeploy ຕົວນັບຈຶ່ງເລີ່ມ 01 ຄືນໃໝ່
//   - ຕົວນັບຂອງເຮົາບໍ່ຮູ້ຈັກເລກທີ່ TRCloud ອອກເອງ (ຈາກການສ້າງໃບດ້ວຍມື)
// ວິທີໃໝ່: ສົ່ງ document_number ເປັນຄ່າຫວ່າງ ໃຫ້ TRCloud ລັນເລກເອງຕໍ່ຈາກລະບົບຂອງມັນ
// (ໃນໜ້າ TRCloud ຊ່ອງເລກໃບເບີກຕັ້ງເປັນ "number only - AUTO" ຢູ່ແລ້ວ)
// ຖ້າຢາກກັບໄປໃສ່ເລກເອງ ໃຫ້ຕັ້ງ env var TRCLOUD_DOC_NUMBER_MODE=manual
// =================================================================
const DOC_NUMBER_MODE = process.env.TRCLOUD_DOC_NUMBER_MODE || "auto";

function generateDocumentNumber() {
  if (DOC_NUMBER_MODE !== "manual") {
    return ""; // ໃຫ້ TRCloud ລັນເລກເອງ — ກັນເລກຊ້ຳໄດ້ແນ່ນອນທີ່ສຸດ
  }
  // manual: YYMMDD + HHMMSS + ເລກສຸ່ມ 3 ໂຕ (ໂອກາດຊ້ຳຕ່ຳຫລາຍ ແຕ່ບໍ່ຮັບປະກັນ 100%)
  const now = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp =
    String(now.getFullYear()).slice(-2) +
    p(now.getMonth() + 1) +
    p(now.getDate()) +
    p(now.getHours()) +
    p(now.getMinutes()) +
    p(now.getSeconds());
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${stamp}${rand}`;
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

// ຊື່ຊ່ອງລາຄາທຶນທີ່ TRCloud ອາດໃຊ້ — ລອງຕາມລຳດັບ ເອົາອັນທຳອິດທີ່ມີຄ່າ > 0
const COST_FIELD_CANDIDATES = [
  "std_cost",
  "standard_cost",
  "average_cost",
  "avg_cost",
  "cost",
  "price",
  "unit_price",
];

function pickCost(product) {
  if (!product) return null;
  for (const field of COST_FIELD_CANDIDATES) {
    const raw = product[field];
    if (raw === undefined || raw === null || raw === "") continue;
    const num = Number(String(raw).replace(/,/g, ""));
    if (Number.isFinite(num) && num > 0) {
      return { value: num, field };
    }
  }
  return null;
}

// ຄົ້ນຫາສິນຄ້າ 1 ລາຍການຈາກ TRCloud (ໃຊ້ຮ່ວມກັນລະຫວ່າງ /api/lookup ແລະ /api/submit-mr)
async function searchProduct(sku) {
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

  const { data } = await callTRCloud(TRCLOUD_SEARCH_ENDPOINT, payload);
  if (data.success !== 1) return null;

  const results = data.result || [];
  return results.find((p) => p.product_id === sku) || results[0] || null;
}

// ---------------- GET /api/lookup?sku=... ----------------
app.get("/api/lookup", async (req, res) => {
  const sku = (req.query.sku || "").toString().trim();
  if (!sku) {
    return res.status(400).json({ error: "กรุณาระบุ sku" });
  }

  try {
    const product = await searchProduct(sku);

    if (!product) {
      return res.status(404).json({ error: `ไม่พบสินค้ารหัส "${sku}" ในระบบ` });
    }

    const cost = pickCost(product);
    // log ຊື່ຊ່ອງທັງໝົດທີ່ TRCloud ສົ່ງມາ ເພື່ອໃຫ້ຮູ້ວ່າຊ່ອງລາຄາທຶນຊື່ຫຍັງແທ້ (ເບິ່ງໃນ Render > Logs)
    console.log(`[/api/lookup] ${sku} fields:`, Object.keys(product).join(", "));
    console.log(`[/api/lookup] ${sku} cost:`, cost ? `${cost.value} (${cost.field})` : "ບໍ່ພົບ");

    return res.status(200).json({
      product_id: product.product_id,
      product_name: product.product_name,
      balance: product.balance,
      unit: product.unit,
      cost: cost ? cost.value : null,
    });
  } catch (err) {
    console.error("[/api/lookup] error:", err.message);
    return res.status(502).json({ error: `เชื่อมต่อ TRCloud ไม่สำเร็จ: ${err.message}` });
  }
});

// ---------------- POST /api/submit-mr ----------------
app.post("/api/submit-mr", async (req, res) => {
  const { items, request_by, purpose } = req.body || {};

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

  // ດຶງລາຄາທຶນຂອງແຕ່ລະລາຍການຈາກ TRCloud ກ່ອນສົ່ງ
  // (TRCloud ບໍ່ໄດ້ຕື່ມລາຄາໃຫ້ອັດຕະໂນມັດ ຈຶ່ງເຫັນ 0.00 ໃນໃບເບີກ — ຕ້ອງສົ່ງໄປເອງ)
  // ຖ້າດຶງບໍ່ໄດ້ ຈະປ່ອຍຫວ່າງໄວ້ ແລ້ວປ່ອຍໃຫ້ TRCloud ຈັດການເອງ ບໍ່ໃຫ້ການເບີກລົ້ມເຫລວ
  const productLines = [];
  for (const it of items) {
    let unitCost = it.cost !== undefined && it.cost !== null ? Number(it.cost) : null;

    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      try {
        const found = await searchProduct(it.product_id);
        const cost = pickCost(found);
        unitCost = cost ? cost.value : null;
      } catch (err) {
        console.error(`[submit-mr] ດຶງລາຄາ ${it.product_id} ບໍ່ສຳເລັດ:`, err.message);
        unitCost = null;
      }
    }

    const qty = Number(it.quantity);
    const line = {
      id: it.product_id,
      product: it.product_name || it.product_id,
      quantity: String(qty),
      warehouse: FIXED_WAREHOUSE,
      remark: "",
      serial: "",
    };

    if (Number.isFinite(unitCost) && unitCost > 0) {
      line.price = String(unitCost);
      line.amount = String(unitCost * qty);
    }

    console.log(
      `[submit-mr] ${it.product_id} x${qty} ລາຄາ/ໜ່ວຍ:`,
      line.price !== undefined ? line.price : "ບໍ່ພົບ (ປ່ອຍຫວ່າງ)"
    );
    productLines.push(line);
  }

  const payload = {
    company_id: process.env.TRCLOUD_COMPANY_ID,
    passkey: process.env.TRCLOUD_PASSKEY,
    securekey: secureKey,
    timestamp,
    accounting_formula: FIXED_ACCOUNTING_FORMULA,
    gl_entry: "yes",
    date: today,
    contact_id: "0",
    company_format: "MR",
    document_number: generateDocumentNumber(),
    status: FIXED_STATUS,
    request_by: request_by || "",
    purpose: purpose || "",
    client_name: "",
    client_telephone: "",
    description: "",
    salesman: FIXED_SALESMAN,
    department: FIXED_DEPARTMENT,
    project: FIXED_PROJECT,
    warehouse: FIXED_WAREHOUSE,
    url: "",
    approve_status: "",
    c1: "",
    c2: "",
    c3: "",
    c4: "",
    c5: "",
    product: productLines,
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
