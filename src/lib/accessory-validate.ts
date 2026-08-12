// 配件變更申請「警示」規則（前後端共用，純函式）
// 命中即顯示紅字警告，但**仍可送出**（不再阻擋）。

// 配件/數量欄位固定每 2 項合成一行的分隔符（OCR 辨識後套用，見 ocr.ts pairAccessoryLines）。
// 放在這個純函式檔（非 server-only）而不是 ocr.ts，是因為 checkAccessoryBlocks 也要在
// client 端（AccessoryForm.tsx）用同一個分隔符把行拆回單一項目，才能各自檢查數量。
export const ACCESSORY_ITEM_SEP = "　|　";

// 把逐項一行的清單，固定每 2 項合成一行（減少行數、電腦/手機看起來都比較緊湊）
export function pairAccessoryLines(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const paired: string[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const a = lines[i];
    const b = lines[i + 1];
    paired.push(b !== undefined ? `${a}${ACCESSORY_ITEM_SEP}${b}` : a);
  }
  return paired.join("\n");
}

export type AccessoryCheckValues = {
  dataNo: string;
  accessoryBefore: string;
  accessoryAfter: string;
  changeDescription: string;
  accessoryNameQty?: string;
};

// 回傳所有命中的警示原因；空陣列＝無警示。
// 規則：
//   1. 說明含「換」「折抵」或「加價多裝」（意義同「換」）視為正常變更情境，排除不查；
//      都沒有時，若含「不裝／不安裝／隨車」等字樣才算命中。
//   2. 配件名稱／數量任一項數量 > 1 時命中。
export function checkAccessoryBlocks(v: AccessoryCheckValues): string[] {
  const reasons: string[] = [];

  const text = [v.accessoryBefore, v.accessoryAfter, v.changeDescription].join("\n");

  if (!text.includes("換") && !text.includes("折抵") && !text.includes("加價多裝")) {
    const hit: string[] = [];
    if (text.includes("不裝")) hit.push("不裝");
    if (text.includes("不安裝")) hit.push("不安裝");
    if (text.includes("隨車")) hit.push("隨車");

    if (hit.length > 0) {
      reasons.push(`說明含「${hit.join("、")}」，不符配件變更定義`);
    }
  }

  // 每行結尾才是數量標記（例如「Q/小天窗隔熱紙SGDX202026RAV4 x1」，數量是結尾的 x1，
  // 不是配件料號中間剛好出現的 X + 數字），所以只比對每行「行尾」的 x數字，不整段掃描。
  // 一行可能是 pairAccessoryLines 合併過的兩個項目，先用同一個分隔符拆開，
  // 否則前一項的 x 數量會卡在行中間，被行尾比對漏掉
  const lines = (v.accessoryNameQty ?? "")
    .split(/\r?\n/)
    .flatMap((line) => line.split(ACCESSORY_ITEM_SEP));
  const overOne = lines
    .map((line) => line.trim().match(/x\s*(\d+)\s*$/i))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => parseInt(m[1], 10))
    .filter((n) => n > 1);
  if (overOne.length > 0) {
    reasons.push(`配件數量有項目 > 1（x${overOne.join("、x")}），請確認是否正確`);
  }

  return reasons;
}
