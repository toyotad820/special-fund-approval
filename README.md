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

## 雲端部署（Render，供網頁版測試）

程式碼：https://github.com/toyotad820/special-fund-approval

1. 登入 [Render](https://render.com/)（若無帳號，可直接用 GitHub 帳號註冊）
2. 「New +」→「Blueprint」→ 選擇並授權連接此 GitHub repo
3. Render 會自動讀取根目錄的 `render.yaml`，一次建立：
   - Web Service（免費方案，Next.js 應用程式）
   - PostgreSQL 資料庫（免費方案），並自動把連線字串注入 `DATABASE_URL`
   - 自動產生 `SESSION_SECRET`
4. 等待建置完成（首次約 3–5 分鐘），Render 會給一個 `https://xxx.onrender.com` 網址，即可用手機／電腦測試

**部署專用的 schema**：`prisma/schema.production.prisma`（PostgreSQL）。本機開發仍用 `prisma/schema.prisma`（SQLite），**修改資料模型時兩份要同步更新**。

**免費方案限制（重要）**：
- 免費 Web Service 閒置一段時間會休眠，喚醒時第一次連線較慢（十幾秒）
- 免費 PostgreSQL **僅保留 30 天**，到期前需升級付費方案或改接其他資料庫，否則資料會被清除
- 免費方案沒有永久硬碟，所以雲端一律用 PostgreSQL（不可用本機的 SQLite 檔案）

**安全性提醒**：部署後的網址是公開可連線的（雖然網址本身不會被搜尋引擎收錄），而測試帳號密碼統一是 `1234`。這個階段僅供功能測試，**正式匯入真實員工資料前，請先更換測試帳號密碼、並評估是否需要加上存取限制**（例如公司網路白名單），避免真實員工帳號暴露在公開網址上。

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

**雲端（Render）**：到 Render dashboard → 該 Web Service → **Shell** 分頁，執行：
```bash
node prisma/seed-testcases.mjs
```
（會直接對雲端的 PostgreSQL 寫入，不影響已匯入的真實人員資料）
