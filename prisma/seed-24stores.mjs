// 產生 24 所都有資料的測試案件，方便驗證「各所統計」在 24 所情況下的
// 版面與圖表可讀性（原規格「全部24個據點」的實際據點代碼）。
// 安全可重複執行：先清掉先前產生的（orderNo 開頭 D24TEST）再重建。
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

const STORES = [
  "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08",
  "D10", "D11", "D12", "D13", "D14",
  "D16", "D17", "D18", "D19", "D20",
  "D21", "D22", "D24", "D25", "D28", "D30",
];

function ym(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const month = ym();

async function main() {
  const old = await prisma.case.findMany({ where: { orderNo: { startsWith: "D24TEST" } } });
  const oldIds = old.map((c) => c.id);
  if (oldIds.length) {
    await prisma.approvalLog.deleteMany({ where: { caseId: { in: oldIds } } });
    await prisma.case.deleteMany({ where: { id: { in: oldIds } } });
  }
  console.log(`已清除 ${oldIds.length} 筆先前的 24 所測試案件`);

  const categories = await prisma.caseCategory.findMany({ where: { active: true } });
  const cars = await prisma.carModel.findMany({ where: { active: true } });
  const boss = await prisma.user.findUnique({ where: { username: "boss" } });
  if (!boss) throw new Error("找不到 boss 帳號，請先執行 node prisma/seed.mjs");
  if (categories.length === 0 || cars.length === 0) {
    throw new Error("尚無特案類別或車種主檔");
  }

  let seq = 1;
  let created = 0;

  for (let i = 0; i < STORES.length; i++) {
    const store = STORES[i];
    // 每所產生 1~3 筆已核准案件，金額隨機有落差，方便觀察圖表
    const caseCount = 1 + (i % 3);
    for (let n = 0; n < caseCount; n++) {
      const amount = 1000 + ((i * 37 + n * 911) % 15000);
      const orderNo = `D24TEST${String(seq).padStart(5, "0")}`;
      await prisma.case.create({
        data: {
          month,
          storeCode: store,
          deptCode: String(1 + (n % 2)),
          plateName: `${store}測試`,
          orderNo,
          categoryId: categories[(i + n) % categories.length].id,
          categoryNo: `測試${seq}`,
          carModel: cars[(i + n) % cars.length].name,
          description: "24所測試資料自動產生",
          subsidyDeptCourse: Math.round(amount * 0.3),
          goldMedal: Math.round(amount * 0.2),
          silverMedal: Math.round(amount * 0.1),
          discountTotal: Math.round(amount * 0.4),
          specialSubsidy: amount,
          status: "APPROVED",
          submittedById: boss.id,
          logs: {
            create: { step: "SUBMIT", action: "SUBMIT", reviewerId: boss.id },
          },
        },
      });
      seq++;
      created++;
    }
  }

  console.log(`已建立 ${created} 筆測試案件，涵蓋 ${STORES.length} 個所別（${month}）`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
