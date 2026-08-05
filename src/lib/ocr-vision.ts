import "server-only";
import { JWT } from "google-auth-library";
import type { OcrFields, OcrResult } from "./ocr";

// ============================================================
// 圖片辨識 — Google Cloud Vision API 測試版（DOCUMENT_TEXT_DETECTION）
//
// 與 ocr.ts（Gemini，production 使用中）並存，互不影響。
// 純文字辨識後依固定標籤（訂單編號/業代/客戶名稱/車名/備註）正則硬解欄位。
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

// 不依賴「列」的邊界（Vision 分列常常跟表格視覺列對不上：配件代碼被拆成兩列、
// 名稱過長換行、或兩個品項的文字被分到同一個 Y 群），改成把所有列接成一長串文字，
// 直接找出每個「配件代碼」出現的位置，兩個代碼之間的文字就是該項目的完整內容
// （名稱＋可能跨行的續行＋付費方式＋數量…）。這樣不管代碼本身有沒有被拆成兩列、
// 續行黏在哪一列，都能正確歸屬到同一個項目。
// 表格最後一項沒有下一個代碼可以當右邊界，會一路吃到表格外的「應付價格」
// 結算列（例如「0 + 66,695-0 = 66,695」），裡面的獨立數字（那個 0）會被誤判
// 成最後一項的數量。「應付價格」一定是表格外的結算文字，先把它跟後面全部切掉。
const TABLE_END_PATTERN = /應付價格/;

function extractAccessoryItems(rows: string[]): string {
  const fullBlob = rows.join(" ");
  const tableEnd = fullBlob.match(TABLE_END_PATTERN);
  const blob = tableEnd ? fullBlob.slice(0, tableEnd.index) : fullBlob;
  const codeMatches = [...blob.matchAll(new RegExp(CODE_PATTERN.source, "g"))];

  const items: string[] = [];
  for (let i = 0; i < codeMatches.length; i++) {
    const m = codeMatches[i];
    const start = m.index! + m[0].length;
    const end = i + 1 < codeMatches.length ? codeMatches[i + 1].index! : blob.length;
    let after = blob.slice(start, end);
    // 下一個項目的「編號」欄（1~3 位數字）常常會黏在這段文字尾端，先去掉，
    // 不然會被誤判成這一項的數量
    after = after.replace(/\s*\d{1,3}\s*$/, "").trim();
    if (!after) continue;

    // 數量欄一定是獨立的一個位數字（前後都不能接數字/逗號/英文字母），
    // 避免誤吃到配件料號或車型代號裡剛好出現的數字（例如「RAV4」的 4、「XTR20」的 20）
    const qtyRe = /(?<![\d,\p{L}])\d(?![\d,\p{L}])/gu;
    const qtyMatches = [...after.matchAll(qtyRe)];
    const lastQty = qtyMatches[qtyMatches.length - 1];
    const qty = lastQty ? lastQty[0] : "1";

    // 名稱結尾以「付費方式關鍵字」或「數量」兩者中最早出現的位置為準切掉，
    // 不然數量／施工方式（安裝）欄的文字會黏在名稱後面
    const stopMatch = after.match(STOP_PATTERN);
    const cutCandidates = [stopMatch?.index, lastQty?.index].filter(
      (n): n is number => n !== undefined
    );
    const cutAt = cutCandidates.length > 0 ? Math.min(...cutCandidates) : after.length;
    const namePart = after.slice(0, cutAt);
    let name = namePart.replace(/\s+/g, "").trim();
    name = name.replace(/^[^\p{L}]+/u, ""); // 去掉開頭殘留的列號/逗號等雜訊
    if (!name) continue;
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

  // 「備註」欄要跟「烤漆備註」（另一個不相關欄位，剛好也含「備註」兩字）分開找，
  // 而且標籤跟內容有時候會被拆成不同行，這種情況改看下一行的內容
  const grabRemarks = () => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("備註") || line.includes("烤漆")) continue;
      // 冒號後面沒接內容時，[:：]? 是「可選」的，正則引擎會回溯改成不吃冒號，
      // 讓 (.+) 只抓到那個冒號本身當內容，所以要濾掉純冒號/空白的假匹配
      const m = line.match(/備註[:：]?\s*(.+)/);
      const val = m?.[1]?.trim();
      if (val && !/^[:：]+$/.test(val)) return val;
      const next = lines[i + 1]?.replace(/^[:：]\s*/, "").trim();
      if (next) return next;
    }
    return "";
  };

  const dataNo = (text.match(/D\d{12}/) || [""])[0];
  const words = pages.flatMap(extractWords);
  const rows = reconstructRows(words);

  // 「業代」「客戶」抓到的內容常常還黏著完整標籤的後半段（「編號:」「名稱:」），
  // 因為實際印刷標籤是「業代編號」「客戶名稱」，只是前半段被拿來當比對關鍵字，
  // 抓出來的值要把這段殘留的標籤文字去掉
  const stripLabelTail = (v: string) => v.replace(/^(編號|名稱)[:：]\s*/, "").trim();

  return {
    dataNo,
    storeCode: dataNo.slice(0, 3),
    salesName: stripLabelTail(grab("業代")),
    customerName: stripLabelTail(grab("客戶")),
    carModel: grab("車名"),
    accessoryNameQty: extractAccessoryItems(rows),
    remarks: grabRemarks(),
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
