// 測試期間專用：Case 資料表覆蓋匯入邏輯，供 run.mjs（本機手動）與 ci-import.mjs（GitHub Actions 排程）共用。
// 正式站上線、不再靠 Excel 匯入申請資料後，這支檔案連同整個 testing-import 目錄可以刪除。

export const KEEP_CATEGORY = "企業大口";
export const IMPORT_CATEGORIES = ["一般車", "員工車", "營業車", "租賃車"];

export async function importToDb(records, databaseUrlOverride) {
  if (databaseUrlOverride) process.env.DATABASE_URL = databaseUrlOverride;
  const { PrismaClient } = (await import("@prisma/client")).default;
  const prisma = new PrismaClient();
  try {
    const categories = await prisma.caseCategory.findMany();
    const catMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
    for (const name of IMPORT_CATEGORIES) {
      if (!catMap[name]) throw new Error(`缺少特案類別: ${name}`);
    }
    const importCatIds = IMPORT_CATEGORIES.map((n) => catMap[n]);

    const kezhangs = await prisma.user.findMany({ where: { role: "KEZHANG" } });
    const userMap = new Map(kezhangs.map((u) => [`${u.storeCode}-${u.deptCode}`, u.id]));

    const missing = new Set();
    const usableRaw = records.filter((r) => {
      const has = userMap.has(`${r.storeCode}-${r.deptCode}`);
      if (!has) missing.add(`${r.storeCode}-${r.deptCode}`);
      return has;
    });
    if (missing.size) {
      console.warn("找不到課長帳號，以下所別/課別的案件會被跳過:", [...missing].join(", "));
    }

    // orderNo 全域唯一；同一批裡打重時以後面那筆為準
    const byOrderNo = new Map(usableRaw.map((r) => [r.orderNo, r]));
    const usable = [...byOrderNo.values()];

    // 只刪這次匯入的資料涵蓋到的月份，不是全部一起刪——Excel 來源目前可能只放當月資料，
    // 若每次都整批刪光只留這次匯入的，Excel 沒放到的月份（如已結案的舊月份）會被沖掉、
    // 且無法復原。改成「以匯入內容涵蓋的月份為準做覆蓋」，其餘月份維持資料庫現況不動。
    // 但 orderNo 是全域唯一鍵，同一張單的 month 可能在兩次匯入之間改變（重新歸類到別月），
    // 若只靠月份範圍刪除，舊月份那筆不會被清掉，之後 insert 同 orderNo 會撞唯一索引導致整批失敗，
    // 所以刪除範圍要再聯集「這次匯入清單裡每個 orderNo 目前在資料庫的既有紀錄」，不論它現在在哪個月。
    const monthsInImport = [...new Set(records.map((r) => r.month))];
    const importOrderNos = usable.map((r) => r.orderNo);
    const toDelete = await prisma.case.findMany({
      where: {
        OR: [
          { categoryId: { in: importCatIds }, month: { in: monthsInImport } },
          { orderNo: { in: importOrderNos } },
        ],
      },
      select: { id: true },
    });
    const deleteIds = toDelete.map((c) => c.id);

    const result = await prisma.$transaction(async (tx) => {
      const logDel = await tx.approvalLog.deleteMany({ where: { caseId: { in: deleteIds } } });
      const caseDel = await tx.case.deleteMany({ where: { id: { in: deleteIds } } });
      const data = usable.map((r) => ({
        month: r.month,
        storeCode: r.storeCode,
        deptCode: r.deptCode,
        plateName: r.plateName,
        orderNo: r.orderNo,
        categoryId: catMap[r.category],
        categoryNo: r.categoryNo,
        carModel: r.carModel,
        description: r.description,
        subsidyDeptCourse: r.subsidyDeptCourse,
        goldMedal: r.goldMedal,
        silverMedal: r.silverMedal,
        discountTotal: r.discountTotal,
        specialSubsidy: r.specialSubsidy,
        status: r.status,
        submittedById: userMap.get(`${r.storeCode}-${r.deptCode}`),
        submittedAt: new Date(r.submittedAt),
        stepEnteredAt: new Date(r.submittedAt),
      }));
      const created = await tx.case.createMany({ data });
      return { logDel, caseDel, created };
    }, { timeout: 60000 });

    const kept = await prisma.case.count({ where: { categoryId: catMap[KEEP_CATEGORY] } });
    console.log(`刪除舊 ApprovalLog: ${result.logDel.count}`);
    console.log(`刪除舊 Case: ${result.caseDel.count}`);
    console.log(`新增 Case: ${result.created.count}`);
    console.log(`保留的「${KEEP_CATEGORY}」案件數: ${kept}`);
  } finally {
    await prisma.$disconnect();
  }
}
