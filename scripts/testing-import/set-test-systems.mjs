// 一次性用途：把測試帳號的 systems 欄位改成可以看到全部系統，方便在正式站測試 portal 選單。
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const prisma = new PrismaClient();
const usernames = ["s01", "k01a", "staff1"];

async function main() {
  const r = await prisma.user.updateMany({
    where: { username: { in: usernames } },
    data: { systems: "fund,car-spec-change" },
  });
  console.log(`已更新 ${r.count} 筆帳號：${usernames.join(", ")}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
