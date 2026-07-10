// 產生測試案件資料，方便在（本機或雲端）瀏覽 UI／報表時有東西可看。
// 安全可重複執行：每次先清掉先前產生的測試案件（orderNo 開頭為 DTEST），再重新建立一批。
// 用法：node prisma/seed-testcases.mjs
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

function ym(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const thisMonth = ym();
const lastMonth = ym(new Date(new Date().setMonth(new Date().getMonth() - 1)));

function testOrderNo(seq) {
  // D + TEST + 8位序號，共13碼
  return `DTEST${String(seq).padStart(8, "0")}`;
}

async function main() {
  // 1) 清除先前產生的測試案件
  const old = await prisma.case.findMany({ where: { orderNo: { startsWith: "DTEST" } } });
  const oldIds = old.map((c) => c.id);
  if (oldIds.length) {
    await prisma.approvalLog.deleteMany({ where: { caseId: { in: oldIds } } });
    await prisma.case.deleteMany({ where: { id: { in: oldIds } } });
  }
  console.log(`已清除 ${oldIds.length} 筆先前的測試案件`);

  const categories = await prisma.caseCategory.findMany({ where: { active: true } });
  const cars = await prisma.carModel.findMany({ where: { active: true } });
  if (categories.length === 0 || cars.length === 0) {
    throw new Error("尚無特案類別或車種主檔，請先確認後台設定或執行 seed.mjs");
  }
  const cat = (i) => categories[i % categories.length];
  const car = (i) => cars[i % cars.length].name;

  const users = Object.fromEntries(
    (
      await prisma.user.findMany({
        where: { username: { in: ["k01a", "k01b", "s01", "k02a", "s02", "boss"] } },
      })
    ).map((u) => [u.username, u])
  );
  const need = ["k01a", "k01b", "s01", "k02a", "s02", "boss"];
  for (const u of need) {
    if (!users[u]) throw new Error(`找不到測試帳號 ${u}，請先執行 node prisma/seed.mjs`);
  }

  let seq = 1;
  const created = [];

  async function makeCase({
    submitter,
    storeCode,
    deptCode,
    catIdx,
    carIdx,
    amount,
    status,
    month = thisMonth,
    plateName,
    description,
  }) {
    const c = await prisma.case.create({
      data: {
        month,
        storeCode,
        deptCode,
        plateName,
        orderNo: testOrderNo(seq++),
        categoryId: cat(catIdx).id,
        categoryNo: `${storeCode}-${deptCode}-${String(catIdx + 1).padStart(2, "0")}`,
        carModel: car(carIdx),
        description,
        subsidyDeptCourse: Math.round(amount * 0.3),
        goldMedal: Math.round(amount * 0.2),
        silverMedal: Math.round(amount * 0.1),
        discountTotal: Math.round(amount * 0.4),
        specialSubsidy: amount,
        status,
        submittedById: users[submitter].id,
        stepEnteredAt: new Date(),
        logs: {
          create: { step: "SUBMIT", action: "SUBMIT", reviewerId: users[submitter].id },
        },
      },
    });
    created.push(c);
    return c;
  }

  // ── 已核准（供報表統計）── 涵蓋多個所/課、多個類別、金額有落差
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 0, carIdx: 0, amount: 3000, status: "APPROVED", plateName: "測試領牌A1", description: "測試資料：一般營業車特案" });
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 1, carIdx: 1, amount: 8000, status: "APPROVED", plateName: "測試領牌A2", description: "測試資料：租賃車特案" });
  await makeCase({ submitter: "k01b", storeCode: "D01", deptCode: "2", catIdx: 2, carIdx: 2, amount: 15000, status: "APPROVED", plateName: "測試領牌A3", description: "測試資料：企業大口特案，金額較高" });
  await makeCase({ submitter: "k01b", storeCode: "D01", deptCode: "2", catIdx: 0, carIdx: 3, amount: 2000, status: "APPROVED", plateName: "測試領牌A4", description: "測試資料：一般營業車特案" });
  await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 3, carIdx: 0, amount: 5000, status: "APPROVED", plateName: "測試領牌B1", description: "測試資料：員工車特案" });
  await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 4, carIdx: 4, amount: 500, status: "APPROVED", plateName: "測試領牌B2", description: "測試資料：一般車特案，金額低" });
  await makeCase({ submitter: "s01", storeCode: "D01", deptCode: "1", catIdx: 1, carIdx: 5, amount: 9500, status: "APPROVED", plateName: "測試領牌A5", description: "測試資料：所長代送租賃車特案" });
  await makeCase({ submitter: "s02", storeCode: "D02", deptCode: "1", catIdx: 2, carIdx: 1, amount: 12000, status: "APPROVED", plateName: "測試領牌B3", description: "測試資料：所長代送企業大口特案" });

  // ── 待審核 ──
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 0, carIdx: 0, amount: 4000, status: "PENDING_SUOZHANG", plateName: "測試領牌C1", description: "測試資料：待所長審核" });
  await makeCase({ submitter: "k01b", storeCode: "D01", deptCode: "2", catIdx: 1, carIdx: 2, amount: 6000, status: "PENDING_SUOZHANG", plateName: "測試領牌C2", description: "測試資料：待所長審核" });
  await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 2, carIdx: 3, amount: 11000, status: "PENDING_BUZHUGUAN", plateName: "測試領牌C3", description: "測試資料：待部長審核" });
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 3, carIdx: 1, amount: 3000, status: "PENDING_BUZHUGUAN", plateName: "測試領牌C4", description: "測試資料：待部長審核" });

  // ── 已駁回（含駁回紀錄，測試駁回橫幅顯示）──
  const c5 = await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 0, carIdx: 0, amount: 7000, status: "REJECTED", plateName: "測試領牌D1", description: "測試資料：已被所長駁回" });
  await prisma.approvalLog.create({ data: { caseId: c5.id, step: "SUOZHANG", action: "REJECT", reviewerId: users.s01.id, comment: "金額有誤，請重新確認後再送" } });

  const c6 = await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 2, carIdx: 4, amount: 9000, status: "REJECTED", plateName: "測試領牌D2", description: "測試資料：已被部長駁回" });
  await prisma.approvalLog.create({ data: { caseId: c6.id, step: "BUZHUGUAN", action: "REJECT", reviewerId: users.boss.id, comment: "本月額度已滿，請下月再議" } });

  // ── 已撤回 ──
  await makeCase({ submitter: "k01b", storeCode: "D01", deptCode: "2", catIdx: 1, carIdx: 5, amount: 2500, status: "WITHDRAWN", plateName: "測試領牌E1", description: "測試資料：已撤回" });
  await makeCase({ submitter: "s01", storeCode: "D01", deptCode: "2", catIdx: 0, carIdx: 0, amount: 1500, status: "WITHDRAWN", plateName: "測試領牌E2", description: "測試資料：所長送單後自行撤回" });

  // ── 草稿 ──
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 3, carIdx: 2, amount: 0, status: "DRAFT", plateName: "測試領牌F1", description: "測試資料：草稿，尚未填完" });
  await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 4, carIdx: 3, amount: 800, status: "DRAFT", plateName: "測試領牌F2", description: "測試資料：草稿" });

  // ── 上個月已核准（測試報表月份切換）──
  await makeCase({ submitter: "k01a", storeCode: "D01", deptCode: "1", catIdx: 0, carIdx: 0, amount: 4500, status: "APPROVED", month: lastMonth, plateName: "測試領牌G1", description: "測試資料：上月已核准" });
  await makeCase({ submitter: "k02a", storeCode: "D02", deptCode: "1", catIdx: 2, carIdx: 1, amount: 13000, status: "APPROVED", month: lastMonth, plateName: "測試領牌G2", description: "測試資料：上月已核准" });

  console.log(`已建立 ${created.length} 筆測試案件（本月 ${thisMonth}、上月 ${lastMonth}）`);
  console.log("涵蓋狀態：已核准/待所長審核/待部長審核/已駁回(含駁回原因)/已撤回/草稿");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
