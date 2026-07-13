// 共用分類色（固定順序，不循環新增色相）。甜甜圈圖與長條圖需顯示同一組類別時，
// 依相同順序索引這個陣列，確保兩張圖對同一類別使用同一顏色。
// 前 5 色為使用者指定的新配色（深藍/青/綠/橙/紅）。
export const CATEGORICAL = [
  "#1E3A8A", // 深藍
  "#06B6D4", // 青色
  "#10B981", // 綠色
  "#F59E0B", // 橙色
  "#E53935", // 紅色
  "#2a78d6", // blue（第 6 類以上才會用到）
  "#1baf7a", // aqua
  "#4A3AA7", // 藍紫色
];

// 特案類別的顏色直接綁定「類別名稱」，不依資料庫的 sortOrder 或依金額排序後的名次。
// 本機測試資料庫和正式資料庫是各自獨立 seed 的，caseCategory 的 sortOrder 不保證一致，
// 若用 sortOrder 或排序名次決定顏色，同一個類別在本機和正式站會顯示不同顏色。
// 這份對照表以正式站目前顯示的顏色為準。新增類別若不在表中，會用 CATEGORICAL 的後備色。
export const CATEGORY_COLOR_BY_NAME: Record<string, string> = {
  一般車: CATEGORICAL[0],
  租賃車: CATEGORICAL[1],
  員工車: CATEGORICAL[2],
  營業車: CATEGORICAL[3],
  企業大口: CATEGORICAL[4],
};
