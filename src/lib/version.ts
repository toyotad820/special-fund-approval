// 版本號規則（三碼）：主版號.次版號.修訂號
//   主版號：重大改版／架構大改
//   次版號：中小幅度功能新增或調整
//   修訂號：錯誤修正
// 每次調整功能或修 bug，請同步更新 APP_VERSION，並在 CHANGELOG 開頭加一筆。

export const APP_VERSION = "1.2.0";

export const CHANGELOG: { version: string; date: string; note: string }[] = [
  {
    version: "1.2.0",
    date: "2026-07-12",
    note: "各所統計長條圖改依特案類別堆疊、圖表與表格合併橫向捲動、擷取圖片改手機比例寬度",
  },
  {
    version: "1.0.0",
    date: "2026-07-10",
    note: "開始記錄版本：新增版本號顯示、所長申請課別改下拉選單、課別格式不一致修正",
  },
];
