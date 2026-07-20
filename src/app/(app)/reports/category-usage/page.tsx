import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { money } from "@/lib/format";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type CatStat = { sum: number; count: number };

type UnitRow = {
  key: string;
  label: string;
  byCategory: Map<string, CatStat>;
  totalSum: number;
  totalCount: number;
  avg: number;
};

export default async function CategoryUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; level?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const level: "store" | "dept" = sp.level === "dept" ? "dept" : "store";

  const categories = await prisma.caseCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const units = new Map<string, UnitRow>();

  function ensureUnit(key: string, label: string): UnitRow {
    let u = units.get(key);
    if (!u) {
      u = { key, label, byCategory: new Map(), totalSum: 0, totalCount: 0, avg: 0 };
      units.set(key, u);
    }
    return u;
  }

  if (level === "dept") {
    const grouped = await prisma.case.groupBy({
      by: ["storeCode", "deptCode", "categoryId"],
      where: { month, status: STATUS.APPROVED },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (!g.categoryId) continue;
      const key = `${g.storeCode}-${g.deptCode}`;
      const u = ensureUnit(key, key);
      const sum = g._sum.specialSubsidy ?? 0;
      const count = g._count._all;
      u.byCategory.set(g.categoryId, { sum, count });
      u.totalSum += sum;
      u.totalCount += count;
    }
  } else {
    const grouped = await prisma.case.groupBy({
      by: ["storeCode", "categoryId"],
      where: { month, status: STATUS.APPROVED },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (!g.categoryId) continue;
      const u = ensureUnit(g.storeCode, g.storeCode);
      const sum = g._sum.specialSubsidy ?? 0;
      const count = g._count._all;
      u.byCategory.set(g.categoryId, { sum, count });
      u.totalSum += sum;
      u.totalCount += count;
    }
  }

  for (const u of units.values()) {
    u.avg = u.totalCount > 0 ? Math.round(u.totalSum / u.totalCount) : 0;
  }

  const unitList = [...units.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "zh-Hant")
  );

  // 平均金額最高/最低標色：所別前3後3、課別前5後5
  const N = level === "store" ? 3 : 5;
  const qualifying = unitList.filter((u) => u.totalCount > 0);
  const sortedByAvgDesc = [...qualifying].sort((a, b) => b.avg - a.avg);
  const redKeys = new Set(sortedByAvgDesc.slice(0, N).map((u) => u.key));
  const greenKeys = new Set(sortedByAvgDesc.slice(-N).map((u) => u.key));
  // 資料太少導致紅綠重疊時，重疊部分不標色
  for (const k of [...redKeys]) {
    if (greenKeys.has(k)) {
      redKeys.delete(k);
      greenKeys.delete(k);
    }
  }

  const th =
    "text-center text-xs font-semibold text-slate-500 px-2.5 py-2 whitespace-nowrap border-l border-slate-200 first:border-l-0";
  const td =
    "text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-100 first:border-l-0 tabular-nums";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            特案類型統計表 · {month}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            僅統計已核准案件；平均金額
            <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
              偏高
            </span>
            <span className="inline-block mx-1 px-1.5 rounded bg-emerald-100 text-emerald-700">
              偏低
            </span>
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
            href={`/api/reports/category-usage/export?level=${level}&month=${month}`}
            className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 whitespace-nowrap"
          >
            下載本表 CSV
          </a>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <a
          href={`/reports/category-usage?level=store&month=${month}`}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            level === "store"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          依所別
        </a>
        <a
          href={`/reports/category-usage?level=dept&month=${month}`}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            level === "dept"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          依課別
        </a>
      </div>

      {unitList.length === 0 ? (
        <p className="text-sm text-slate-400 bg-white rounded-2xl border border-slate-200 py-10 text-center">
          本月尚無已核准案件
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="min-w-max text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th
                  rowSpan={2}
                  className="text-center text-xs font-semibold text-slate-500 px-3 py-2 sticky left-0 bg-slate-50 whitespace-nowrap"
                >
                  單位（{level === "store" ? "所" : "課"}）
                </th>
                {categories.map((c) => (
                  <th key={c.id} colSpan={3} className={th}>
                    {c.name}
                  </th>
                ))}
                <th colSpan={3} className={`${th} bg-slate-100`}>
                  合計
                </th>
              </tr>
              <tr>
                {categories.map((c) => (
                  <Fragment key={c.id}>
                    <th className={th}>金額</th>
                    <th className={th}>件數</th>
                    <th className={th}>平均</th>
                  </Fragment>
                ))}
                <th className={`${th} bg-slate-100`}>金額</th>
                <th className={`${th} bg-slate-100`}>件數</th>
                <th className={`${th} bg-slate-100`}>平均</th>
              </tr>
            </thead>
            <tbody>
              {unitList.map((u) => {
                const isRed = redKeys.has(u.key);
                const isGreen = greenKeys.has(u.key);
                return (
                  <tr key={u.key} className="border-t border-slate-100 bg-white even:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-inherit whitespace-nowrap">
                      {u.label}
                    </td>
                    {categories.map((c) => {
                      const stat = u.byCategory.get(c.id);
                      const sum = stat?.sum ?? 0;
                      const count = stat?.count ?? 0;
                      const avg = count > 0 ? Math.round(sum / count) : 0;
                      return (
                        <Fragment key={c.id}>
                          <td className={td}>{count > 0 ? money(sum) : "-"}</td>
                          <td className={td}>{count > 0 ? count : "-"}</td>
                          <td className={td}>{count > 0 ? money(avg) : "-"}</td>
                        </Fragment>
                      );
                    })}
                    <td className="text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-200 tabular-nums font-semibold bg-slate-50/70">
                      {money(u.totalSum)}
                    </td>
                    <td className="text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-100 tabular-nums font-semibold bg-slate-50/70">
                      {u.totalCount}
                    </td>
                    <td
                      className={`text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-100 tabular-nums font-bold ${
                        isRed
                          ? "bg-rose-100 text-rose-800"
                          : isGreen
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-50/70"
                      }`}
                    >
                      {money(u.avg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
