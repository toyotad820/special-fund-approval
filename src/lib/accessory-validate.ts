// 配件變更申請「警示」規則（前後端共用，純函式）
// 命中即顯示紅字警告，但**仍可送出**（不再阻擋）。

// 配件/數量欄位的品項分隔符：OCR 辨識完不分行，逐項串成一行、中間用這個分隔，
// 交給文字框自然換行（電腦版一行能塞幾項算幾項，手機版變窄自然變少，不強制固定數量）。
// 放在這個純函式檔（非 server-only）而不是 ocr.ts，是因為 AccessoryForm.tsx（client 端）
// 也要用同一個分隔符把這份文字拆回單一項目，畫出色彩預覽。
export const ACCESSORY_ITEM_SEP = "｜";

// 把逐項一行的清單，串成一行、項目間用 ACCESSORY_ITEM_SEP 分隔
export function joinAccessoryItems(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join(` ${ACCESSORY_ITEM_SEP} `);
}

// 把 accessoryNameQty 這份文字拆回單一項目陣列，供色彩預覽等 UI 使用。
// 相容舊資料：換行也視為項目分隔（合併前/未經過 OCR 的舊案件仍是逐行存的）。
export function splitAccessoryItems(text: string): string[] {
  return text
    .split(new RegExp(`\\r?\\n|${ACCESSORY_ITEM_SEP}`))
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

// 單一品項字串結尾的「x數量」是否 > 1（例如「RAV4拉桿三件式 x1」→ 1，「另一項配件 x2」→ 2）。
// 只看字串「結尾」的 x＋數字，不是配件料號中間剛好出現的 X + 數字（例如 XTR40）。
export function accessoryItemQty(item: string): number | null {
  const m = item.trim().match(/x\s*(\d+)\s*$/i);
  return m ? parseInt(m[1], 10) : null;
}

export type AccessoryCheckValues = {
  dataNo: string;
  accessoryBefore: string;
  accessoryAfter: string;
  changeDescription: string;
  accessoryNameQty?: string;
};

// 回傳所有命中的警示原因；空陣列＝無警示。
// 規則：說明含「換」「折抵」或「加價多裝」（意義同「換」）視為正常變更情境，排除不查；
// 都沒有時，若含「不裝／不安裝／隨車」等字樣才算命中。
// （原本還有「配件數量 > 1」文字警示，已改用色彩預覽取代，不再重複提醒——見 AccessoryForm.tsx）
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

  return reasons;
}
