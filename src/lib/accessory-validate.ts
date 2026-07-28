// 配件變更申請「警示」規則（前後端共用，純函式）
// 命中即顯示紅字警告，但**仍可送出**（不再阻擋）。

export type AccessoryCheckValues = {
  dataNo: string;
  accessoryBefore: string;
  accessoryAfter: string;
  changeDescription: string;
};

// 回傳所有命中的警示原因；空陣列＝無警示。
// 規則：說明含「不裝／不安裝／隨車」等字樣。
//   例外：「不裝升級」「不裝換」屬正常情境，不視為命中。
export function checkAccessoryBlocks(
  v: AccessoryCheckValues,
  _ocrDataNo: string
): string[] {
  const reasons: string[] = [];

  const text = [v.accessoryBefore, v.accessoryAfter, v.changeDescription].join("\n");

  // 「不裝」排除「不裝升級」「不裝換」後仍出現才算命中
  const cleaned = text.replace(/不裝升級|不裝換/g, "");
  const hit: string[] = [];
  if (cleaned.includes("不裝")) hit.push("不裝");
  if (text.includes("不安裝")) hit.push("不安裝");
  if (text.includes("隨車")) hit.push("隨車");

  if (hit.length > 0) {
    reasons.push(`說明含「${hit.join("、")}」，不符配件變更定義`);
  }

  return reasons;
}
