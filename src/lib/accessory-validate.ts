// 配件變更申請「警示」規則（前後端共用，純函式）
// 命中即顯示紅字警告，但**仍可送出**（不再阻擋）。

export type AccessoryCheckValues = {
  dataNo: string;
  accessoryBefore: string;
  accessoryAfter: string;
  changeDescription: string;
  accessoryNameQty?: string;
};

// 回傳所有命中的警示原因；空陣列＝無警示。
// 規則：
//   1. 說明含「換」或「折抵」（意義同「換」）視為正常變更情境，排除不查；
//      兩者都沒有時，若含「不裝／不安裝／隨車」等字樣才算命中。
//   2. 配件名稱／數量任一項數量 > 1 時命中。
export function checkAccessoryBlocks(
  v: AccessoryCheckValues,
  _ocrDataNo: string
): string[] {
  const reasons: string[] = [];

  const text = [v.accessoryBefore, v.accessoryAfter, v.changeDescription].join("\n");

  if (!text.includes("換") && !text.includes("折抵")) {
    const hit: string[] = [];
    if (text.includes("不裝")) hit.push("不裝");
    if (text.includes("不安裝")) hit.push("不安裝");
    if (text.includes("隨車")) hit.push("隨車");

    if (hit.length > 0) {
      reasons.push(`說明含「${hit.join("、")}」，不符配件變更定義`);
    }
  }

  // 每行結尾才是數量標記（例如「Q/小天窗隔熱紙SGDX202026RAV4 x1」，數量是結尾的 x1，
  // 不是配件料號中間剛好出現的 X + 數字），所以只比對每行「行尾」的 x數字，不整段掃描
  const lines = (v.accessoryNameQty ?? "").split(/\r?\n/);
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
