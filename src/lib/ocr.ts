import "server-only";

// ============================================================
// 圖片辨識介面層（OPT 委託安裝工單 → 結構化欄位）
//
// 實作：Google Cloud Vision API（DOCUMENT_TEXT_DETECTION）
//   Vision 只回純文字，欄位由本地啟發式解析抽取。
//
// 環境變數：
//   GOOGLE_VISION_API_KEY  必填，未設定回空欄位（ok:false）
// ============================================================

export type OcrFields = {
  dataNo: string; // 資料編號（Dxx 開頭 13 碼）
  storeCode: string; // 所別（Dxx）
  salesName: string; // 業代編號＋姓名
  customerName: string; // 客戶名稱
  carModel: string; // 車名
  remarks: string; // 備註（用「換」字分割變更前/後）
};

export type OcrResult = {
  fields: OcrFields;
  raw: string; // Vision 原始全文，供稽核＋人工核對
  ok: boolean;
  error?: string;
};

const EMPTY_FIELDS: OcrFields = {
  dataNo: "",
  storeCode: "",
  salesName: "",
  customerName: "",
  carModel: "",
  remarks: "",
};

// 從 Vision 全文解析結構化欄位
function parseOcrText(fullText: string): OcrFields {
  const lines = fullText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = lines.join(" ");

  // 資料編號：D + 12 碼英數
  const dataNoMatch = joined.match(/D[0-9A-Z]{12}/i);
  const dataNo = dataNoMatch ? dataNoMatch[0].toUpperCase() : "";
  const storeCode = dataNo ? dataNo.substring(0, 3) : "";

  // 業代：字母+數字編號 後接中文姓名（例：B4569 陳建勳）
  const salesMatch = joined.match(/[A-Z]\d{3,5}\s*[一-鿿]{2,4}/i);
  const salesName = salesMatch ? salesMatch[0].replace(/\s+/g, " ").trim() : "";

  // 客戶名稱：找「客戶」附近的中文
  const customerMatch = joined.match(/客戶[名稱]*[：:\s]+([一-鿿]{2,10})/);
  const customerName = customerMatch ? customerMatch[1].trim() : "";

  // 車名：找「車名/車型」附近
  const carMatch = joined.match(/車[名型][：:\s]+([A-Z一-鿿0-9\s]{2,15}?)(?=\s{2,}|客戶|業代|$)/i);
  const carModel = carMatch ? carMatch[1].trim() : "";

  return { dataNo, storeCode, salesName, customerName, carModel, remarks: "" };
}

export async function ocrExtractFields(image: {
  data: Buffer | string;
  mimeType: string;
}): Promise<OcrResult> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return {
      fields: { ...EMPTY_FIELDS },
      raw: "",
      ok: false,
      error: "未設定 GOOGLE_VISION_API_KEY，略過辨識（欄位請人工填寫）",
    };
  }

  const base64 =
    typeof image.data === "string" ? image.data : image.data.toString("base64");

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  const body = JSON.stringify({
    requests: [
      {
        image: { content: base64 },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
        imageContext: { languageHints: ["zh-Hant", "en"] },
      },
    ],
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        fields: { ...EMPTY_FIELDS },
        raw: text,
        ok: false,
        error: `Vision 回應 ${res.status}`,
      };
    }

    const json = await res.json();
    const fullText: string =
      json?.responses?.[0]?.fullTextAnnotation?.text ?? "";

    if (!fullText) {
      return {
        fields: { ...EMPTY_FIELDS },
        raw: JSON.stringify(json),
        ok: false,
        error: "Vision 未辨識到文字",
      };
    }

    return { fields: parseOcrText(fullText), raw: fullText, ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      fields: { ...EMPTY_FIELDS },
      raw: "",
      ok: false,
      error: `辨識失敗：${msg}`,
    };
  }
}
