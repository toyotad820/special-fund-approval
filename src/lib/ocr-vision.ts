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
  accessoryNameQty: "",
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

// Vision 的 fullTextAnnotation.text 是依「段落」順序輸出，表格分欄會被打散、
// 同一列的儲存格散落在不同段落。改用每個字詞的座標，依 Y 座標分群重建「列」，
// 再依 X 座標排序組回該列文字，這樣才能正確對齊表格欄位。
type Word = { text: string; cx: number; cy: number; height: number };

function extractWords(page: unknown): Word[] {
  const words: Word[] = [];
  const p = page as {
    blocks?: {
      paragraphs?: {
        words?: {
          symbols?: { text?: string }[];
          boundingBox?: { vertices?: { x?: number; y?: number }[] };
        }[];
      }[];
    }[];
  };
  for (const block of p.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const w of para.words ?? []) {
        const text = (w.symbols ?? []).map((s) => s.text ?? "").join("");
        const verts = w.boundingBox?.vertices ?? [];
        const xs = verts.map((v) => v.x ?? 0);
        const ys = verts.map((v) => v.y ?? 0);
        if (!text || xs.length === 0) continue;
        words.push({
          text,
          cx: (Math.min(...xs) + Math.max(...xs)) / 2,
          cy: (Math.min(...ys) + Math.max(...ys)) / 2,
          height: Math.max(...ys) - Math.min(...ys),
        });
      }
    }
  }
  return words;
}

// 依 Y 座標分群成列，同列內依 X 排序組字串
function reconstructRows(words: Word[]): string[] {
  if (words.length === 0) return [];
  const avgHeight = words.reduce((s, w) => s + w.height, 0) / words.length || 20;
  const sorted = [...words].sort((a, b) => a.cy - b.cy);

  const rows: Word[][] = [];
  let current: Word[] = [sorted[0]];
  let currentY = sorted[0].cy;
  for (let i = 1; i < sorted.length; i++) {
    const w = sorted[i];
    if (Math.abs(w.cy - currentY) <= avgHeight * 0.6) {
      current.push(w);
      currentY = (currentY * (current.length - 1) + w.cy) / current.length;
    } else {
      rows.push(current);
      current = [w];
      currentY = w.cy;
    }
  }
  rows.push(current);

  return rows.map((row) =>
    row
      .sort((a, b) => a.cx - b.cx)
      .map((w) => w.text)
      .join(" ")
  );
}

// 表格列樣式：含「配件代碼」（英數+連字號）的列視為配件項目，
// 取代碼後最長的一段文字為名稱，列尾最後一個個位數字為數量。
// Vision 每個中文字都拆成獨立字詞、join 時插入空白，所以關鍵字比對要允許字間空白。
function spacedPattern(word: string): string {
  return word.split("").join("\\s*");
}

const CODE_PATTERN = /[A-Z]{2}\d{2}\s*-\s*[A-Z0-9]{3,}/;
const STOP_PATTERN = new RegExp(
  `(?:${spacedPattern("客付")}|${spacedPattern("寄付")}|${spacedPattern("公司贈送")})`
);

function extractAccessoryItems(rows: string[]): string {
  // 配件名稱過長時 Vision 會拆成兩列輸出，續行沒有配件代碼；
  // 只要前一列還沒出現付費方式關鍵字，就視為續行併回去
  const merged: string[] = [];
  for (const row of rows) {
    const prev = merged[merged.length - 1];
    const prevHasCode = prev && CODE_PATTERN.test(prev);
    const prevHasStop = prev && STOP_PATTERN.test(prev);
    if (prevHasCode && !prevHasStop && !CODE_PATTERN.test(row)) {
      merged[merged.length - 1] = `${prev} ${row}`;
    } else {
      merged.push(row);
    }
  }

  const items: string[] = [];
  for (const row of merged) {
    const codeMatch = row.match(CODE_PATTERN);
    if (!codeMatch) continue;
    const after = row.slice(codeMatch.index! + codeMatch[0].length).trim();
    if (!after) continue;
    const stopMatch = after.match(STOP_PATTERN);
    const namePart = stopMatch ? after.slice(0, stopMatch.index) : after;
    let name = namePart.replace(/\s+/g, "").trim();
    name = name.replace(/^[^\p{L}]+/u, ""); // 去掉開頭殘留的列號/逗號等雜訊
    if (!name) continue;
    const qtyMatches = row.match(/(?<![\d,])\d(?![\d,])/g);
    const qty = qtyMatches ? qtyMatches[qtyMatches.length - 1] : "1";
    items.push(`${name} x${qty}`);
  }
  return items.join("\n");
}

function parseVisionText(text: string, pages: unknown[]): OcrFields {
  const lines = text.split("\n").map((l) => l.trim());
  const grab = (label: string) => {
    for (const line of lines) {
      const m = line.match(new RegExp(`${label}[:：]?\\s*(.+)`));
      if (m) return m[1].trim();
    }
    return "";
  };

  const dataNo = (text.match(/D\d{12}/) || [""])[0];
  const words = pages.flatMap(extractWords);
  const rows = reconstructRows(words);

  return {
    dataNo,
    storeCode: dataNo.slice(0, 3),
    salesName: grab("業代編號"),
    customerName: grab("客戶名稱"),
    carModel: grab("車名"),
    accessoryNameQty: extractAccessoryItems(rows),
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
    const pages: unknown[] = json.responses?.[0]?.fullTextAnnotation?.pages ?? [];
    if (!text) {
      return { fields: { ...EMPTY_FIELDS }, raw: "", ok: false, elapsedMs, error: "Vision 未辨識出文字" };
    }
    return { fields: parseVisionText(text, pages), raw: text, ok: true, elapsedMs };
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
