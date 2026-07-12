import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { money } from "@/lib/format";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type UnitStat = {
  key: string;
  label: string;
  count: number;
  sum: number;
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

  const [grouped, targets] = await Promise.all([
    level === "dept"
      ? prisma.case.groupBy({
          by: ["storeCode", "deptCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: { specialSubsidy: true },
        })
      : prisma.case.groupBy({
          by: ["storeCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: { specialSubsidy: true },
        }),
    // 所層級 target deptCode="0"；課層級 target 是實際課別（不含 "0"）
    prisma.unitTarget.findMany({
      where: level === "dept" ? { month, deptCode: { not: "0" } } : { month, deptCode: "0" },
    }),
  ]);

  const targetByKey = new Map(
    targets.map((t) => [level === "dept" ? `${t.storeCode}-${t.deptCode}` : t.storeCode, t])
  );

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
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
    };
  });
  units.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const totalCount = units.reduce((s, u) => s + u.count, 0);
  const totalAmount = units.reduce((s, u) => s + u.sum, 0);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            目標達成統計表 · {month}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            申請比率
            <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
              最高 {N} 名
            </span>
            <span className="inline-block mx-1 px-1.5 rounded bg-emerald-100 text-emerald-700">
              最低 {N} 名
            </span>
            ；金額比率
            <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
              高於比重
            </span>
            的單位標紅（尚未上傳目標以「-」表示）
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
          <table className="min-w-max text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 px-3 py-2 sticky left-0 bg-slate-50 whitespace-nowrap">
                  單位（{level === "store" ? "所" : "課"}）
                </th>
                <th className={th}>目標台數</th>
                <th className={th}>申請台數</th>
                <th className={th}>申請比率</th>
                <th className={th}>金額總和</th>
                <th className={th}>金額比率</th>
                <th className={th}>平均</th>
              </tr>
            </thead>
            <tbody>
              {withRate.map((u) => (
                <tr key={u.key} className="border-t border-slate-100 even:bg-slate-50/40">
                  <td className="px-3 py-2 font-medium text-slate-800 sticky left-0 bg-inherit whitespace-nowrap">
                    {u.label}
                  </td>
                  <td className={td}>{u.targetCount ?? "-"}</td>
                  <td className={td}>{u.count}</td>
                  <td className={rateCellCls(u.key)}>
                    {u.rate !== null ? `${Math.round(u.rate)}%` : "-"}
                  </td>
                  <td className={td}>{money(u.sum)}</td>
                  <td className={shareCellCls(u)}>{Math.round(u.sharePct)}%</td>
                  <td className={td}>{money(Math.round(u.count ? u.sum / u.count : 0))}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">合計</td>
                <td className={td}>{totalTarget || "-"}</td>
                <td className={td}>{totalCount}</td>
                <td className={td}>{totalRate !== null ? `${Math.round(totalRate)}%` : "-"}</td>
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
