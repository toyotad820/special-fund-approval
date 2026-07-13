# 特案支援金報備系統（雛型）

和泰汽車 24 據點特案支援金線上報備與簽核工具。本階段為**雛型測試版**。

規格文件：`G:\我的雲端硬碟\Claude-workspace\projects\特案支援金報備系統\docs\需求規格確認書.html`

## 技術

- Next.js 16（App Router, TypeScript, Tailwind CSS）
- Prisma 6 + SQLite（雛型；上雲改 PostgreSQL）
- iron-session + bcryptjs（帳密登入）

## 本機啟動

```bash
npm install
cp .env.example .env      # 並填入 SESSION_SECRET
npm run db:push           # 建立 SQLite 資料表
npm run db:seed           # 灌入測試資料
npm run dev               # 開發伺服器（http://localhost:3000）
```

## 測試帳號（密碼皆 1234）

| 帳號 | 角色 | 說明 |
|------|------|------|
| `boss` | 部長 | 第二關審核、全域報表 |
| `staff1` | Staff | 全域報表、後台設定 |
| `s01` | 所長（D01）| 送單 + 第一關審核 |
| `k01a` | 課長（D01 一課）| 送單 |
| `k01b` | 課長（D01 二課）| 送單 |
| `s02` | 所長（D02）| 送單 + 第一關審核 |
| `k02a` | 課長（D02 一課）| 送單 |

## 已實作（Phase 1 核心）

- 帳密登入 / 登出、角色權限
- 填單 + 防呆（訂單編號 13 碼且唯一、金額規則、必填）；所長送單需手動填課別（必填數字）
- **儲存草稿**：欄位可不填即先存檔，日後於首頁繼續編輯或正式送出
- 送單 → 所長（第一關）→ 部長（第二關）簽核
- 審核意見 / 駁回原因（含駁回關卡標註）、駁回後修改重送、未審前撤回
- 草稿／駁回／撤回案件皆可刪除或修改後重送
- 送出／存草稿後跳出結果視窗（成功或問題），可查看案件或關閉
- 逾期站內標示（超過 3 天）
- 依角色可視範圍（課長=本課、所長=本所、部長/staff=全部；草稿僅本人可見）
- Excel 式可排序案件列表（狀態欄在前、垂直捲軸容器）
- 報表（依據點 / 類別統計，不含草稿）＋當月明細 CSV 匯出
- 後台管理平台（限部長/staff）：人員（新增/編輯/停用/重設密碼/刪除、**CSV 匯入，支援 Big5/UTF-8**）、特案類別、車種、月份開關

## 尚未實作（後續）

- LINE 通知、附件上傳（Phase 2）
- 串接 AD/SSO、部署至公司內部主機

## 雲端部署（Vercel，正式站）

程式碼：https://github.com/toyotad820/special-fund-approval

正式站：https://special-fund-approval.vercel.app

推送到 `main` 分支後 Vercel 會自動建置部署。正式站接獨立的 Postgres 資料庫，**跟本機 SQLite 資料不共用**，本機測試/匯入的資料不會自動同步過去。

**部署專用的 schema**：`prisma/schema.production.prisma`（PostgreSQL）。本機開發仍用 `prisma/schema.prisma`（SQLite），**修改資料模型時兩份要同步更新**。

**環境變數**：`DATABASE_URL`、`SESSION_SECRET` 於 Vercel 專案設定的 Environment Variables 管理。

**安全性提醒**：測試帳號密碼統一是 `1234`。正式匯入真實員工資料前，請先更換測試帳號密碼、並評估是否需要加上存取限制。

## 冒煙測試

```bash
npm run dev            # 另開視窗先啟動
npm run smoke          # 跑完整核心流程的端到端檢查
```

## 常用指令

- `npm run db:reset`：清空並重建測試資料
- `npx prisma studio`：以 GUI 檢視資料庫

## 產生測試案件資料（方便瀏覽 UI／報表）

`prisma/seed-testcases.mjs` 會建立約 20 筆涵蓋各種狀態（待審核、已核准、已駁回含原因、
已撤回、草稿）、跨 D01/D02 兩所多課、跨本月與上月的測試案件，方便直接測試畫面與報表。
安全可重複執行——每次會先清掉先前產生的測試案件（`orderNo` 開頭 `DTEST`）再重建。

**本機**：
```bash
node prisma/seed-testcases.mjs
```

**正式站（Vercel）**：Vercel 沒有內建 Shell 主控台，若要對正式站的 Postgres 寫入測試資料，需在本機把 `DATABASE_URL` 換成正式站連線字串後執行（僅建議在確認清楚影響範圍時才操作）。一般情況下正式站資料異動應透過管理後台介面操作，不直接跑腳本。
