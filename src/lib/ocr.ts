import "server-only";
import { joinAccessoryItems } from "./accessory-validate";

// ============================================================
// 圖片辨識介面層（OPT 委託安裝工單 → 結構化欄位）
//
// 目前實作：Google Gemini（REST，免額外 SDK）。
// 換模型時只需改本檔內部實作，呼叫端（server actions / 表單）維持不變：
//   ocrExtractFields(image) → OcrResult
//
// 環境變數：
//   GEMINI_API_KEY  必填，未設定時回傳空欄位（ok:false），不阻斷開發流程
//   GEMINI_MODEL    選填，預設 gemini-flash-latest
// ============================================================

export type OcrFields = {
  dataNo: string; // 資料編號（訂單編號，Dxx 開頭 13 碼）
  storeCode: string; // 所別（Dxx）
  salesName: string; // 員編/姓名
  customerName: string; // 客戶名稱
  carModel: string; // 車名
  accessoryNameQty: string; // 配件名稱／數量（工單表格逐項配件，換行分隔）
  remarks: string; // 備註/簽決欄位（用「換」字分割變更前/後）
};

export type OcrResult = {
  fields: OcrFields;
  raw: string; // 模型原始回傳，供稽核追溯（存 AccessoryImage.ocrRaw）
  ok: boolean; // 是否成功辨識（false=未設定金鑰或呼叫失敗，欄位為空）
  error?: string;
};

const EMPTY_FIELDS: OcrFields = {
  dataNo: "",
  storeCode: "",
  salesName: "",
  customerName: "",
  carModel: "",
  accessoryNameQty: "",
  remarks: "",
};

const PROMPT = `你是 TOYOTA 經銷商「OPT 委託安裝工單」的資料擷取助手。請從這張工單圖片擷取以下欄位，逐項回傳；找不到的欄位回傳空字串，不要臆測：

- dataNo：訂單編號（Dxx 開頭、共 13 碼英數字，例如 D111507010401）
- storeCode：所別代碼（訂單編號前 3 碼，例如 D11）
- salesName：業代編號＋姓名，保留前面的業代編號一起回傳（例如「B4569 陳建勳」）
- customerName：客戶名稱
- carModel：車名（例如 Y CROSS、CAMRY、C CROSS）
- accessoryNameQty：工單表格中每一項配件的「名稱」與「數量」，逐項列出、每項一行，格式為「名稱 x數量」（例如「LED後座觸控閱讀燈 x1」）。只列有配件名稱的列，忽略純「專案代碼」「精裝碼」「差額」等無配件名稱的列。數量欄位一律看該列自己的「數量」直欄，不要被相鄰列（尤其上一列若是「專案代碼」空白列）影響；工單上出現的品項數量最少是 1，絕不會是 0，若讀出來是 0 代表看錯欄位，請重新確認
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
    accessoryNameQty: { type: "string" },
    remarks: { type: "string" },
  },
  required: [
    "dataNo",
    "storeCode",
    "salesName",
    "customerName",
    "carModel",
  ],
} as const;

// 「專案代碼」列沒有配件名稱，提示詞已經要求模型忽略，但偶爾還是會漏進來，
// 這裡在程式碼層再濾掉一次，不完全依賴模型每次都聽指示
function stripProjectCodeLines(v: string): string {
  return v
    .split(/\r?\n/)
    .filter((line) => !line.includes("專案代碼"))
    .join("\n");
}

// 工單上列出來的品項數量最少是 1，不會是 0——模型偶爾會把相鄰列（例如上一列
// 是空白的「專案代碼」列）誤讀成 0，這裡做保底修正，不依賴模型每次都聽指示。
// 不假設「x0」一定黏在行尾（模型偶爾會多回傳空白、標點、或用全形×），
// 改成抓該行「最後一個」x＋數字的出現位置（就是數量標記，因為配件代碼裡
// 即使剛好有 x/X 開頭的料號如 XTR40，也一定排在數量標記之前），只換掉那段
function fixZeroQty(v: string): string {
  return v
    .split(/\r?\n/)
    .map((line) => {
      // 抓該行「最後一個」x/×＋數字，那才是數量標記（配件代碼裡即使剛好有
      // x/X 開頭的料號如 XTR40，也一定排在數量標記之前，不會是最後一個）
      const re = /[x×]\s*([0-9０-９]+)/gi;
      let last: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) last = m;
      if (!last) return line;
      const digits = last[1];
      if (digits !== "0" && digits !== "０") return line;
      const start = last.index;
      const end = start + last[0].length;
      return line.slice(0, start) + last[0].replace(/[0０]$/, "1") + line.slice(end);
    })
    .join("\n");
}

function coerceFields(obj: unknown): OcrFields {
  const o = (obj ?? {}) as Record<string, unknown>;
  const str = (k: keyof OcrFields) =>
    typeof o[k] === "string" ? (o[k] as string).trim() : "";
  return {
    dataNo: str("dataNo").toUpperCase(),
    storeCode: str("storeCode").toUpperCase(),
    salesName: str("salesName"),
    customerName: str("customerName"),
    carModel: str("carModel"),
    accessoryNameQty: joinAccessoryItems(
      fixZeroQty(stripProjectCodeLines(str("accessoryNameQty")))
    ),
    remarks: str("remarks"),
  };
}

// image.data 可為 Buffer 或 base64 字串
export async function ocrExtractFields(image: {
  data: Buffer | string;
  mimeType: string;
}): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      fields: { ...EMPTY_FIELDS },
      raw: "",
      ok: false,
      error: "未設定 GEMINI_API_KEY，略過辨識（欄位請人工填寫）",
    };
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const base64 =
    typeof image.data === "string" ? image.data : image.data.toString("base64");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: image.mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        // 429 配額／500、503 高需求 皆為暫時性，退避重試
        if ((res.status === 429 || res.status === 500 || res.status === 503) && attempt < 2) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        return {
          fields: { ...EMPTY_FIELDS },
          raw: text,
          ok: false,
          error: `Gemini 回應 ${res.status}`,
        };
      }

      const json = await res.json();
      const text: string =
        json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      if (!text) {
        return {
          fields: { ...EMPTY_FIELDS },
          raw: JSON.stringify(json),
          ok: false,
          error: "Gemini 未回傳內容",
        };
      }

      const parsed = JSON.parse(text);
      return { fields: coerceFields(parsed), raw: text, ok: true };
    } catch (e: unknown) {
      const aborted = e instanceof Error && e.name === "AbortError";
      const msg = aborted ? "辨識逾時（20 秒），請重新嘗試" : e instanceof Error ? e.message : String(e);
      if (attempt === 2 || aborted) {
        return {
          fields: { ...EMPTY_FIELDS },
          raw: "",
          ok: false,
          error: aborted ? msg : `辨識失敗：${msg}`,
        };
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    fields: { ...EMPTY_FIELDS },
    raw: "",
    ok: false,
    error: "辨識失敗：重試次數超限",
  };
}
