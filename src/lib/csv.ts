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
