import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { money } from "@/lib/format";
import { CATEGORICAL, CATEGORY_COLOR_BY_NAME } from "@/lib/chartColors";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type UnitStat = {
  key: string;
  label: string;
  count: number;
  sum: number;
  fundTotal: number; // 所基金合計 = 所課支援金 + 金牌金額 + 銀牌金額
  targetCount: number | null;
  weight: number | null;
};

export default async function TargetVsActualPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; level?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const level: "store" | "dept" = sp.level === "dept" ? "dept" : "store";

  // 統計不含草稿／已駁回／已撤回（跟首頁、報表總覽的口徑一致）
  const caseWhere = {
    month,
    status: { notIn: [STATUS.DRAFT, STATUS.REJECTED, STATUS.WITHDRAWN] as string[] },
  };

  const [grouped, targets, byCategoryOverall, byUnitCategory, categories] = await Promise.all([
    level === "dept"
      ? prisma.case.groupBy({
          by: ["storeCode", "deptCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: {
            specialSubsidy: true,
            subsidyDeptCourse: true,
            goldMedal: true,
            silverMedal: true,
          },
        })
      : prisma.case.groupBy({
          by: ["storeCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: {
            specialSubsidy: true,
            subsidyDeptCourse: true,
            goldMedal: true,
            silverMedal: true,
          },
        }),
    // 所層級 target deptCode="0"；課層級 target 是實際課別（不含 "0"）
    prisma.unitTarget.findMany({
      where: level === "dept" ? { month, deptCode: { not: "0" } } : { month, deptCode: "0" },
    }),
    // 決定類別欄位順序（依金額總和排序，跟首頁一致）
    prisma.case.groupBy({
      by: ["categoryId"],
      where: caseWhere,
      _sum: { specialSubsidy: true },
    }),
    level === "dept"
      ? prisma.case.groupBy({
          by: ["storeCode", "deptCode", "categoryId"],
          where: caseWhere,
          _count: { _all: true },
        })
      : prisma.case.groupBy({
          by: ["storeCode", "categoryId"],
          where: caseWhere,
          _count: { _all: true },
        }),
    prisma.caseCategory.findMany(),
  ]);

  const targetByKey = new Map(
    targets.map((t) => [level === "dept" ? `${t.storeCode}-${t.deptCode}` : t.storeCode, t])
  );

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "（未分類）";
  // 類別欄位涵蓋所有現行類別（不只本月有申請的），本月無資料的欄位顯示 0
  const sumByCategoryId = new Map(byCategoryOverall.map((r) => [r.categoryId, r._sum.specialSubsidy ?? 0]));
  const categoryOrder = categories
    .map((c) => ({ id: c.id as string | null, name: c.name, sum: sumByCategoryId.get(c.id) ?? 0 }))
    .sort((a, b) => b.sum - a.sum);
  const categoryColor = (id: string | null) => {
    const name = catName(id);
    const idx = categories.findIndex((c) => c.id === id);
    return (
      CATEGORY_COLOR_BY_NAME[name] ??
      CATEGORICAL[(idx < 0 ? categories.length : idx) % CATEGORICAL.length]
    );
  };

  const countByUnitCategory = new Map<string, Map<string | null, number>>();
  for (const r of byUnitCategory) {
    const isDept = "deptCode" in r;
    const key = isDept
      ? `${r.storeCode}-${(r as { deptCode: string }).deptCode}`
      : r.storeCode;
    if (!countByUnitCategory.has(key)) countByUnitCategory.set(key, new Map());
    countByUnitCategory.get(key)!.set(r.categoryId, r._count._all);
  }

  const units: UnitStat[] = grouped.map((g) => {
    const isDept = "deptCode" in g;
    const key = isDept ? `${g.storeCode}-${(g as { deptCode: string }).deptCode}` : g.storeCode;
    const label = isDept ? `${g.storeCode} ${(g as { deptCode: string }).deptCode}課` : g.storeCode;
    const t = targetByKey.get(key);
    return {
      key,
      label,
      count: g._count._all,
      sum: g._sum.specialSubsidy ?? 0,
      fundTotal:
        (g._sum.subsidyDeptCourse ?? 0) + (g._sum.goldMedal ?? 0) + (g._sum.silverMedal ?? 0),
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
    };
  });
  units.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const totalCount = units.reduce((s, u) => s + u.count, 0);
  const totalAmount = units.reduce((s, u) => s + u.sum, 0);
  const totalFundTotal = units.reduce((s, u) => s + u.fundTotal, 0);
  const totalTarget = units.reduce((s, u) => s + (u.targetCount ?? 0), 0);
  const totalRate = totalTarget > 0 ? (totalCount / totalTarget) * 100 : null;

  const withRate = units.map((u) => ({
    ...u,
    rate: u.targetCount ? (u.count / u.targetCount) * 100 : null,
    sharePct: totalAmount > 0 ? (u.sum / totalAmount) * 100 : 0,
  }));

  // 平均金額前3高標紅、後3低標綠：所別前3後3、課別前5後5
  const N = level === "store" ? 3 : 5;
  const rateQualifying = withRate.filter((u) => u.rate !== null);
  const sortedByRateDesc = [...rateQualifying].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const rateRedKeys = new Set(sortedByRateDesc.slice(0, N).map((u) => u.key));
  const rateGreenKeys = new Set(sortedByRateDesc.slice(-N).map((u) => u.key));
  for (const k of [...rateRedKeys]) {
    if (rateGreenKeys.has(k)) {
      rateRedKeys.delete(k);
      rateGreenKeys.delete(k);
    }
  }

  // 平均金額前3高標紅、後3低標綠：所別前3後3、課別前5後5
  const withAvg = withRate.map((u) => ({ ...u, avg: u.count > 0 ? u.sum / u.count : 0 }));
  const avgQualifying = withAvg.filter((u) => u.count > 0);
  const sortedByAvgDesc = [...avgQualifying].sort((a, b) => b.avg - a.avg);
  const avgRedKeys = new Set(sortedByAvgDesc.slice(0, N).map((u) => u.key));
  const avgGreenKeys = new Set(sortedByAvgDesc.slice(-N).map((u) => u.key));
  for (const k of [...avgRedKeys]) {
    if (avgGreenKeys.has(k)) {
      avgRedKeys.delete(k);
      avgGreenKeys.delete(k);
    }
  }

  const th =
    "text-center text-xs font-semibold text-slate-500 px-2.5 py-2 whitespace-nowrap border-l border-slate-200 first:border-l-0";
  const td =
    "text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-100 first:border-l-0 tabular-nums";

  const rateCellCls = (key: string) =>
    rateRedKeys.has(key)
      ? `${td} bg-rose-100 text-rose-800 font-bold`
      : rateGreenKeys.has(key)
        ? `${td} bg-emerald-100 text-emerald-800 font-bold`
        : td;
  const shareCellCls = (u: (typeof withRate)[number]) =>
    u.weight !== null && u.sharePct > u.weight ? `${td} bg-rose-100 text-rose-800 font-bold` : td;
  const avgCellCls = (key: string) =>
    avgRedKeys.has(key)
      ? `${td} bg-rose-100 text-rose-800 font-bold`
      : avgGreenKeys.has(key)
        ? `${td} bg-emerald-100 text-emerald-800 font-bold`
        : td;
  // 所基金合計 > 特案總和時標綠
  const fundTotalCellCls = (u: (typeof withRate)[number]) =>
    u.fundTotal > u.sum ? `${td} bg-emerald-100 text-emerald-800 font-bold` : td;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            所課特案申請統計表 · {month}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
              偏高／超標
            </span>
            <span className="inline-block mx-1 px-1.5 rounded bg-emerald-100 text-emerald-700">
              偏低
            </span>
            （尚未上傳目標以「-」表示）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <form className="flex items-center gap-2">
            <input type="hidden" name="level" value={level} />
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button className="rounded-lg bg-slate-700 text-white px-3 py-1.5 text-sm">
              查詢
            </button>
          </form>
          <a
            href={`/api/reports/target-vs-actual/export?level=${level}&month=${month}`}
            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 whitespace-nowrap"
          >
            下載本表 CSV
          </a>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <a
          href={`/reports/target-vs-actual?level=store&month=${month}`}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            level === "store"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          依所別
        </a>
        <a
          href={`/reports/target-vs-actual?level=dept&month=${month}`}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            level === "dept"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          依課別
        </a>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 py-10 text-center">
          本月尚無申請資料
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-center text-xs font-semibold text-slate-500 px-3 py-2 sticky left-0 bg-slate-50 whitespace-nowrap">
                  單位（{level === "store" ? "所" : "課"}）
                </th>
                <th className={th}>目標台數</th>
                {categoryOrder.map((c) => (
                  <th key={c.id ?? "none"} className={th}>
                    <span className="inline-flex items-center gap-1">
                      <span
                        className="w-1.5 h-1.5 rounded-sm shrink-0"
                        style={{ background: categoryColor(c.id) }}
                      />
                      {c.name}
                    </span>
                  </th>
                ))}
                <th className={th}>申請台數</th>
                <th className={th}>申請比率</th>
                <th className={th}>所基金合計</th>
                <th className={th}>特案總和</th>
                <th className={th}>金額比率</th>
                <th className={th}>平均金額</th>
              </tr>
            </thead>
            <tbody>
              {withAvg.map((u) => (
                <tr key={u.key} className="border-t border-slate-100 bg-white even:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-inherit whitespace-nowrap">
                    {u.label}
                  </td>
                  <td className={td}>{u.targetCount ?? "-"}</td>
                  {categoryOrder.map((c) => (
                    <td key={c.id ?? "none"} className={td}>
                      {countByUnitCategory.get(u.key)?.get(c.id) ?? 0}
                    </td>
                  ))}
                  <td className={td}>{u.count}</td>
                  <td className={rateCellCls(u.key)}>
                    {u.rate !== null ? `${Math.round(u.rate)}%` : "-"}
                  </td>
                  <td className={fundTotalCellCls(u)}>{money(u.fundTotal)}</td>
                  <td className={td}>{money(u.sum)}</td>
                  <td className={shareCellCls(u)}>{Math.round(u.sharePct)}%</td>
                  <td className={avgCellCls(u.key)}>{money(Math.round(u.avg))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50">
                <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">合計</td>
                <td className={td}>{totalTarget || "-"}</td>
                {categoryOrder.map((c) => (
                  <td key={c.id ?? "none"} className={td}>
                    {units.reduce((s, u) => s + (countByUnitCategory.get(u.key)?.get(c.id) ?? 0), 0)}
                  </td>
                ))}
                <td className={td}>{totalCount}</td>
                <td className={td}>{totalRate !== null ? `${Math.round(totalRate)}%` : "-"}</td>
                <td className={td}>{money(totalFundTotal)}</td>
                <td className={td}>{money(totalAmount)}</td>
                <td className={td}>100%</td>
                <td className={td}>
                  {money(Math.round(totalCount ? totalAmount / totalCount : 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
