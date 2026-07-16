# 申請資料庫匯入工具（測試期間專用）

把 LINE bot 匯出的「特案申請彙整.xlsx」清洗（課別/車名/類別/狀態轉成系統格式、去重、
補齊訂單編號等）後，整批覆蓋 `Case` 資料表。**「企業大口」類別的既有案件永遠保留，不會被覆蓋。**

> 這個目錄是雛型測試階段的過渡工具。正式站上線、申請資料不再靠 Excel 匯入之後，
> 整個 `scripts/testing-import/` 目錄可以直接刪除。

## 用法

```bash
# 更新本機資料庫
node scripts/testing-import/run.mjs --file "路徑/申請彙整.xlsx" --target local

# 更新正式站資料庫（需先 npx vercel login 過有權限的帳號、且此專案已 vercel link）
node scripts/testing-import/run.mjs --file "路徑/申請彙整.xlsx" --target production
```

執行時會依序：
1. 用 `build_cases.py` 清洗 Excel，印出跳過的列與無法比對的車名
2. 依 target 切換 Prisma schema（本機 SQLite / 正式站 Postgres）
3. 在交易中刪除舊的「一般車/員工車/營業車/租賃車」案件、重新寫入清洗後的資料
4. 若是 production，執行完會自動把本機開發環境還原成 SQLite

## 車名比對失敗怎麼辦

腳本跑完若印出「無法比對的車名」，代表 `build_cases.py` 裡的規則猜不出標準車型。
把新車名加進 `build_cases.py` 的 `CAR_OVERRIDES` 字典，對應到正確的標準車型後，重新執行一次。

## 前置需求

- `python3` + `openpyxl`（讀 Excel）
- Node：`@prisma/client`、`prisma`（專案本身已有）
- 要匯 production 時：`npx vercel login`、`npx vercel link` 過此專案
