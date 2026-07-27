// 配件變更申請「擋送」規則（前後端共用，純函式、無 server-only）
// 命中任一條件即不允許送出，必須先修正（不走「警告後強制送出」）。

export type AccessoryCheckValues = {
  dataNo: string;
  accessoryBefore: string;
  accessoryAfter: string;
  changeDescription: string;
};

// 觸發擋送的關鍵字（配件不可為「不裝／隨車／不安裝」類項目）
export const BLOCK_KEYWORDS = ["不裝", "不安裝", "隨車"] as const;

// 回傳所有命中的擋送原因；空陣列＝可送出。
// ocrDataNo：辨識到的工單訂單編號，用於與輸入的資料編號比對；空字串代表尚未成功辨識。
export function checkAccessoryBlocks(
  v: AccessoryCheckValues,
  ocrDataNo: string
): string[] {
  const reasons: string[] = [];

  // 1. 尚未成功辨識（含辨識失敗回空欄位）→ 無法比對，擋送要求重新辨識
  if (!ocrDataNo.trim()) {
    reasons.push("尚未成功辨識工單，請重新上傳並辨識圖片");
  } else if (v.dataNo.trim().toUpperCase() !== ocrDataNo.trim().toUpperCase()) {
    // 2. 輸入的資料編號與工單辨識結果不符
    reasons.push("資料編號與工單辨識結果不符，請確認是否上傳到正確工單");
  }

  // 3. 說明／配件欄含「不裝／隨車／不安裝」等字樣
  const haystack = [
    v.accessoryBefore,
    v.accessoryAfter,
    v.changeDescription,
  ].join("\n");
  const hit = BLOCK_KEYWORDS.filter((k) => haystack.includes(k));
  if (hit.length > 0) {
    reasons.push(`配件／說明不可含「${hit.join("、")}」等字樣`);
  }

  return reasons;
}
