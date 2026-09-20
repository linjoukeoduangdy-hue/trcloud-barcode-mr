import express from "express";
import crypto from "crypto";
import path from "path";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const COOKIE_SECRET = process.env.COOKIE_SECRET || "please-change-this-secret-in-render";
app.use(cookieParser(COOKIE_SECRET));

const PORT = process.env.PORT || 3000;

function parseUsersEnv(envVal) {
  if (!envVal) return null;
  try {
    const parsed = JSON.parse(envVal);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.error("[APP_USERS] JSON ຜິດພາດ, ໃຊ້ຄ່າ default ແທນ:", err.message);
  }
  return null;
}

const USERS =
  parseUsersEnv(process.env.APP_USERS) || [
    { username: "linjou", password: "changeme123", salesman: "Linju_Keoduangdy", display_name: "Linjou" },
  ];

const PUBLIC_PATHS = ["/login.html", "/api/login", "/healthz", "/sw.js"];

function findUserByUsername(username) {
  return USERS.find((u) => u.username === username) || null;
}

// ---------------- ຊ່ອງທາງ login / logout / ຂໍ້ມູນຜູ້ໃຊ້ປັດຈຸບັນ ----------------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS.find((u) => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: "ຊື່ຜູ້ໃຊ້ ຫລື ລະຫັດຜ່ານ ບໍ່ຖືກຕ້ອງ" });
  }

  res.cookie("session_user", user.username, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  return res.status(200).json({
    success: true,
    username: user.username,
    display_name: user.display_name || user.username,
    salesman: user.salesman || "",
  });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("session_user");
  return res.status(200).json({ success: true });
});

// ---------------- ປະຕູກັ້ນ: ຕ້ອງ login ກ່ອນຈຶ່ງເຂົ້າໜ້າ/API ອື່ນໆໄດ້ ----------------
app.use((req, res, next) => {
  if (PUBLIC_PATHS.includes(req.path)) return next();

  const username = req.signedCookies?.session_user;
  const user = username ? findUserByUsername(username) : null;

  if (user) {
    req.currentUser = user;
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "ກະລຸນາລ໋ອກອິນກ່ອນ" });
  }
  return res.redirect("/login.html");
});

app.get("/api/me", (req, res) => {
  const user = req.currentUser;
  res.status(200).json({
    username: user.username,
    display_name: user.display_name || user.username,
    salesman: user.salesman || "",
  });
});
app.use(express.static(path.join(__dirname, "public")));
// =================================================================
const FIXED_WAREHOUSE = process.env.TRCLOUD_WAREHOUSE || "คลังเซโปน";
const FIXED_DEPARTMENT_VALUE =
  process.env.TRCLOUD_DEPARTMENT || "โครงการเซโปน-แท่งคำและนาลู";
const FIXED_ACCOUNTING_FORMULA =
  process.env.TRCLOUD_ACCOUNTING_FORMULA || "Internal Issue_ค่าวัสดุสิ้นเปลือง";
const FIXED_STATUS = process.env.TRCLOUD_STATUS || "ขนส่งเสร็จสิ้น";

app.get("/api/form-options", (req, res) => {
  res.status(200).json({
    warehouse: FIXED_WAREHOUSE,
    department: FIXED_DEPARTMENT_VALUE,
    accounting_formula: FIXED_ACCOUNTING_FORMULA,
    status: FIXED_STATUS,
  });
});

// =================================================================
const DOC_NUMBER_MODE = process.env.TRCLOUD_DOC_NUMBER_MODE || "auto";

function generateDocumentNumber() {
  if (DOC_NUMBER_MODE !== "manual") {
    return ""; 
  }
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
  "std_cost",
  "standard_cost",
  "average_cost",
  "avg_cost",
  "cost",
  "price",
  "unit_price";

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
  const { items, request_by, purpose, name } = req.body || {};

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
    transport_status: FIXED_STATUS,
    shipping_status: FIXED_STATUS,
    delivery_status: FIXED_STATUS,
    request_by: request_by || "",
    purpose: purpose || "",
    client_name: name || "",
    client_telephone: "",
    description: "",
    salesman: req.currentUser.salesman || "",
    department: FIXED_DEPARTMENT_VALUE,
    project: "",
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
app.get("/healthz", (req, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
