// 獨立測試腳本：比較 Gemini vs Google Cloud Vision API 的 OCR 辨識速度與品質
// 不動 src/lib/ocr.ts（production 邏輯維持不變），純粹旁路測試
//
// 用法：node scripts/test-ocr-compare.mjs [圖片路徑]

import { config } from "dotenv";
import { readFileSync } from "fs";
import { JWT } from "google-auth-library";

config({ path: new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") });

const imagePath = process.argv[2] || "c:/S__25944094.jpg";
const imageBuffer = readFileSync(imagePath);
const base64 = imageBuffer.toString("base64");
const mimeType = imagePath.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

console.log(`\n測試圖片：${imagePath}（${(imageBuffer.length / 1024).toFixed(1)} KB）\n`);

// ============================================================
// 1) Gemini（複製自 src/lib/ocr.ts 的 prompt/schema，不動原檔）
// ============================================================
const PROMPT = `你是 TOYOTA 經銷商「OPT 委託安裝工單」的資料擷取助手。請從這張工單圖片擷取以下欄位，逐項回傳；找不到的欄位回傳空字串，不要臆測：

- dataNo：訂單編號（Dxx 開頭、共 13 碼英數字，例如 D111507010401）
- storeCode：所別代碼（訂單編號前 3 碼，例如 D11）
- salesName：業代編號＋姓名，保留前面的業代編號一起回傳（例如「B4569 陳建勳」）
- customerName：客戶名稱
- carModel：車名（例如 Y CROSS、CAMRY、C CROSS）
- remarks：工單下方「簽決簽審意見」或備註欄的內容，逐字回傳不要省略

只回傳 JSON，不要多餘說明。`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    dataNo: { type: "string" },
    storeCode: { type: "string" },
    salesName: { type: "string" },
    customerName: { type: "string" },
    carModel: { type: "string" },
    remarks: { type: "string" },
  },
  required: ["dataNo", "storeCode", "salesName", "customerName", "carModel"],
};

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "未設定 GEMINI_API_KEY" };

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA, temperature: 0 },
    }),
  });
  const elapsed = Date.now() - t0;

  if (!res.ok) {
    return { ok: false, elapsed, error: `HTTP ${res.status}: ${await res.text()}` };
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { ok: true, elapsed, fields: JSON.parse(text) };
}

// ============================================================
// 2) Google Cloud Vision API（DOCUMENT_TEXT_DETECTION，服務帳號認證）
// ============================================================
async function getVisionAccessToken() {
  const keyB64 = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY;
  if (!keyB64) throw new Error("未設定 GOOGLE_VISION_SERVICE_ACCOUNT_KEY");
  const keyJson = JSON.parse(Buffer.from(keyB64, "base64").toString("utf-8"));
  const jwt = new JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
  const { token } = await jwt.getAccessToken();
  return token;
}

// 從 Vision 的純文字結果依固定標籤硬解欄位
function parseVisionText(text) {
  const lines = text.split("\n").map((l) => l.trim());
  const grab = (label) => {
    for (const line of lines) {
      const m = line.match(new RegExp(`${label}[:：]?\\s*(.+)`));
      if (m) return m[1].trim();
    }
    return "";
  };

  const dataNo = (text.match(/D\d{12}/) || [""])[0];
  const storeCode = dataNo.slice(0, 3);
  const salesName = grab("業代編號");
  const customerName = grab("客戶名稱");
  const carModel = grab("車名");
  const remarks = grab("備註");

  return { dataNo, storeCode, salesName, customerName, carModel, remarks };
}

async function testVision() {
  try {
    const token = await getVisionAccessToken();
    const t0 = Date.now();
    const res = await fetch("https://vision.googleapis.com/v1/images:annotate", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["zh-TW", "en"] },
          },
        ],
      }),
    });
    const elapsed = Date.now() - t0;

    if (!res.ok) {
      return { ok: false, elapsed, error: `HTTP ${res.status}: ${await res.text()}` };
    }
    const json = await res.json();
    if (json.responses?.[0]?.error) {
      return { ok: false, elapsed, error: JSON.stringify(json.responses[0].error) };
    }
    const text = json.responses?.[0]?.fullTextAnnotation?.text ?? "";
    return { ok: true, elapsed, text, fields: parseVisionText(text) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const [gemini, vision] = await Promise.all([testGemini(), testVision()]);

console.log("=== Gemini (gemini-flash-latest) ===");
console.log(`耗時：${gemini.elapsed}ms`);
if (gemini.ok) {
  console.log("欄位：", gemini.fields);
} else {
  console.log("失敗：", gemini.error);
}

console.log("\n=== Google Cloud Vision (DOCUMENT_TEXT_DETECTION) ===");
console.log(`耗時：${vision.elapsed ?? "-"}ms`);
if (vision.ok) {
  console.log("正則解析欄位（粗略）：", vision.fields);
  console.log("\n--- 原始辨識全文 ---");
  console.log(vision.text);
} else {
  console.log("失敗：", vision.error);
}
