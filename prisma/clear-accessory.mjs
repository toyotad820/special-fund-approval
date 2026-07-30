// 清空所有配件變更申請案件（含已確認）— 依外鍵順序刪除：log → image → request。
// 一次性維運腳本，不可逆。執行前請確認 DATABASE_URL 指向正確的資料庫。
//   本機 SQLite：  node prisma/clear-accessory.mjs
//   正式 Postgres：DATABASE_URL="<prod-url>" node prisma/clear-accessory.mjs
import pkg from "@prisma/client";
import fs from "fs";

const { PrismaClient } = pkg;

// 若目前 DATABASE_URL 不是 postgres，嘗試從 .env.vercel / .env.production 讀取，
// 免去手動貼上連線字串（也避免密碼被截圖）。
function loadPgUrl() {
  // 檔案優先：避免 shell 殘留的 $env:DATABASE_URL 干擾（PowerShell 同 session 會保留）
  for (const f of [".env.vercel", ".env.production"]) {
    if (!fs.existsSync(f)) continue;
    const line = fs
      .readFileSync(f, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) {
      const val = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
      if (val.startsWith("postgres")) {
        process.env.DATABASE_URL = val;
        console.log(`已從 ${f} 載入正式 DATABASE_URL。`);
        return;
      }
    }
  }
}
loadPgUrl();

if (!(process.env.DATABASE_URL || "").startsWith("postgres")) {
  console.error(
    "找不到 postgres DATABASE_URL。請先執行：npx vercel env pull --environment=production .env.vercel"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const [logs, images, requests] = await prisma.$transaction([
    prisma.accessoryLog.deleteMany({}),
    prisma.accessoryImage.deleteMany({}),
    prisma.accessoryRequest.deleteMany({}),
  ]);
  console.log(
    `已刪除：申請單 ${requests.count} 筆、圖片 ${images.count} 筆、紀錄 ${logs.count} 筆。`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
