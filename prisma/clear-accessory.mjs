// 清空所有配件變更申請案件（含已確認）— 依外鍵順序刪除：log → image → request。
// 一次性維運腳本，不可逆。執行前請確認 DATABASE_URL 指向正確的資料庫。
//   本機 SQLite：  node prisma/clear-accessory.mjs
//   正式 Postgres：DATABASE_URL="<prod-url>" node prisma/clear-accessory.mjs
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
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
