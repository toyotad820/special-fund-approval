// 共用分類色（固定順序，不循環新增色相）。甜甜圈圖與長條圖需顯示同一組類別時，
// 依相同順序索引這個陣列，確保兩張圖對同一類別使用同一顏色。
// 前 5 色刻意避開同色系相鄰（原本 blue+violet、aqua+green 兩組太像），
// 經 dataviz 色票驗證工具跑過全部兩兩比對，確保 5 色一次全部並排時仍可清楚區分。
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#eda100", // yellow
  "#008300", // green
  "#e87ba4", // magenta
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#4a3aa7", // violet
  "#e34948", // red
];
