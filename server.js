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

  const formData = new URLSearchParams();
  formData.append("json", JSON.stringify(payload));

  try {
    const trResp = await fetch(TRCLOUD_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        Origin: process.env.TRCLOUD_ORIGIN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await trResp.json();

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

  const formData = new URLSearchParams();
  formData.append("json", JSON.stringify(payload));

  try {
    const trResp = await fetch(TRCLOUD_MR_ENDPOINT, {
      method: "POST",
      headers: {
        Origin: process.env.TRCLOUD_ORIGIN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await trResp.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: `เชื่อมต่อ TRCloud ไม่สำเร็จ: ${err.message}` });
  }
});

// health check เผื่อ Render ping ตรวจสอบ
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
