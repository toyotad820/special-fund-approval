import "server-only";
import { JWT } from "google-auth-library";
import type { OcrFields, OcrResult } from "./ocr";

// ============================================================
// 圖片辨識 — Google Cloud Vision API 測試版（DOCUMENT_TEXT_DETECTION）
//
// 與 ocr.ts（Gemini，production 使用中）並存，互不影響。
// 純文字辨識後依固定標籤（訂單編號/業代編號/客戶名稱/車名/備註）正則硬解欄位。
//
// 環境變數：
//   GOOGLE_VISION_SERVICE_ACCOUNT_KEY  服務帳號 JSON（base64）
// ============================================================

const EMPTY_FIELDS: OcrFields = {
  dataNo: "",
  storeCode: "",
  salesName: "",
  customerName: "",
  carModel: "",
  remarks: "",
};

async function getAccessToken(): Promise<string> {
  const keyB64 = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_KEY;
  if (!keyB64) throw new Error("未設定 GOOGLE_VISION_SERVICE_ACCOUNT_KEY");
  const keyJson = JSON.parse(Buffer.from(keyB64, "base64").toString("utf-8"));
  const jwt = new JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-vision"],
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Vision 授權失敗，未取得 access token");
  return token;
}

function parseVisionText(text: string): OcrFields {
  const lines = text.split("\n").map((l) => l.trim());
  const grab = (label: string) => {
    for (const line of lines) {
      const m = line.match(new RegExp(`${label}[:：]?\\s*(.+)`));
      if (m) return m[1].trim();
    }
    return "";
  };

  const dataNo = (text.match(/D\d{12}/) || [""])[0];
  return {
    dataNo,
    storeCode: dataNo.slice(0, 3),
    salesName: grab("業代編號"),
    customerName: grab("客戶名稱"),
    carModel: grab("車名"),
    remarks: grab("備註"),
  };
}

export async function ocrExtractFieldsVision(image: {
  data: Buffer | string;
  mimeType: string;
}): Promise<OcrResult & { elapsedMs?: number }> {
  const base64 =
    typeof image.data === "string" ? image.data : image.data.toString("base64");

  const t0 = Date.now();
  try {
    const token = await getAccessToken();
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
    const elapsedMs = Date.now() - t0;

    if (!res.ok) {
      return { fields: { ...EMPTY_FIELDS }, raw: "", ok: false, elapsedMs, error: `Vision 回應 ${res.status}` };
    }
    const json = await res.json();
    if (json.responses?.[0]?.error) {
      return {
        fields: { ...EMPTY_FIELDS },
        raw: "",
        ok: false,
        elapsedMs,
        error: json.responses[0].error.message || "Vision 辨識錯誤",
      };
    }
    const text: string = json.responses?.[0]?.fullTextAnnotation?.text ?? "";
    if (!text) {
      return { fields: { ...EMPTY_FIELDS }, raw: "", ok: false, elapsedMs, error: "Vision 未辨識出文字" };
    }
    return { fields: parseVisionText(text), raw: text, ok: true, elapsedMs };
  } catch (e: unknown) {
    return {
      fields: { ...EMPTY_FIELDS },
      raw: "",
      ok: false,
      elapsedMs: Date.now() - t0,
      error: `辨識失敗：${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
