// CSV 匯出用：處理逗號/換行/引號的標準跳脫，並防「CSV 公式注入」——
// 文字欄位開頭若是 =、+、-、@，Excel/Sheets 開啟時可能被當公式執行，前面補一個
// 半形單引號讓試算表強制當文字處理（Excel 顯示上會忽略這個引號，不影響閱讀）。
// 只對字串型別做這個檢查：數字型別（金額）不會是公式，負數的「-」開頭要維持
// 是數字，不能被誤加引號變成文字。
export function csvCell(v: string | number): string {
  if (typeof v === "number") return String(v);
  let s = v ?? "";
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// 自動判斷編碼解碼：UTF-8（含 BOM）優先，失敗則退回 Big5（繁中 Excel 常見）
export function decodeCsvBytes(buf: Uint8Array): string {
  // UTF-8 BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf);
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("big5").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf);
    }
  }
}

// 極簡 CSV 解析：支援雙引號包覆、逗號、換行、跳脫（""）
export function parseCsv(text: string): string[][] {
  // 去除 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // 忽略；\r\n 由 \n 處理
    } else {
      field += ch;
    }
  }
  // 最後一欄/列
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 過濾全空白列
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// 解析為物件陣列（首列為表頭）
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
    return obj;
  });
}
