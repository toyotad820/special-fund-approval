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
//   1. 說明含「換」字視為正常變更情境，排除不查；沒有「換」字時，
//      若含「不裝／不安裝／隨車」等字樣才算命中。
//   2. 配件名稱／數量任一項數量 > 1 時命中。
export function checkAccessoryBlocks(
  v: AccessoryCheckValues,
  _ocrDataNo: string
): string[] {
  const reasons: string[] = [];

  const text = [v.accessoryBefore, v.accessoryAfter, v.changeDescription].join("\n");

  if (!text.includes("換")) {
    const hit: string[] = [];
    if (text.includes("不裝")) hit.push("不裝");
    if (text.includes("不安裝")) hit.push("不安裝");
    if (text.includes("隨車")) hit.push("隨車");

    if (hit.length > 0) {
      reasons.push(`說明含「${hit.join("、")}」，不符配件變更定義`);
    }
  }

  const qtyMatches = (v.accessoryNameQty ?? "").match(/x\s*(\d+)/gi) ?? [];
  const hasQtyOverOne = qtyMatches.some((m) => {
    const n = parseInt(m.replace(/^x\s*/i, ""), 10);
    return n > 1;
  });
  if (hasQtyOverOne) {
    reasons.push("配件數量有項目 > 1，請確認是否正確");
  }

  return reasons;
}
