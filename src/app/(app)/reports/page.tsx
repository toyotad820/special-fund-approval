import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/dal";
import { money } from "@/lib/format";
import { STATUS } from "@/lib/constants";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  if (!canViewReports(user)) redirect("/");

  const sp = await searchParams;
  const month = sp.month || currentMonth();

  // 統計不含草稿／已駁回／已撤回（皆非實際生效案件）
  const reportWhere = {
    month,
    status: { notIn: [STATUS.DRAFT, STATUS.REJECTED, STATUS.WITHDRAWN] },
  };

  const [byStore, byCategory, total, storeTargets] = await Promise.all([
    prisma.case.groupBy({
      by: ["storeCode"],
      where: reportWhere,
      _count: { _all: true },
      _sum: { specialSubsidy: true },
      orderBy: { storeCode: "asc" },
    }),
    prisma.case.groupBy({
      by: ["categoryId"],
      where: reportWhere,
      _count: { _all: true },
      _sum: { specialSubsidy: true },
    }),
    prisma.case.aggregate({
      where: reportWhere,
      _count: { _all: true },
      _sum: { specialSubsidy: true },
    }),
    // 所層級目標（deptCode="0"）：跟課層級各自獨立維護，見 UnitTarget
    prisma.unitTarget.findMany({ where: { month, deptCode: "0" } }),
  ]);

  const categories = await prisma.caseCategory.findMany();
  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "（未分類）";

  const th = "text-center text-xs font-semibold text-slate-500 px-3 py-2";
  const thLabel = "text-center text-xs font-semibold text-slate-500 px-3 py-2";
  const td = "px-3 py-2 text-sm text-slate-800";

  // 各所目標對照：申請比率（申請台數/目標台數）前3高標紅、後3低標綠；
  // 金額比率（該所金額佔全體比例）高於比重的所別標紅
  const targetByStore = new Map(storeTargets.map((t) => [t.storeCode, t]));
  const totalAmount = total._sum.specialSubsidy ?? 0;
  const storeStats = byStore.map((r) => {
    const t = targetByStore.get(r.storeCode);
    const count = r._count._all;
    const sum = r._sum.specialSubsidy ?? 0;
    return {
      storeCode: r.storeCode,
      count,
      sum,
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
      rate: t?.targetCount ? (count / t.targetCount) * 100 : null,
      sharePct: totalAmount > 0 ? (sum / totalAmount) * 100 : 0,
      avg: count > 0 ? sum / count : 0,
    };
  });

  const N = 3;
  const qualifying = storeStats.filter((r) => r.rate !== null);
  const sortedByRateDesc = [...qualifying].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  const rateRedKeys = new Set(sortedByRateDesc.slice(0, N).map((r) => r.storeCode));
  const rateGreenKeys = new Set(sortedByRateDesc.slice(-N).map((r) => r.storeCode));
  for (const k of [...rateRedKeys]) {
    if (rateGreenKeys.has(k)) {
      rateRedKeys.delete(k);
      rateGreenKeys.delete(k);
    }
  }
  const rateCellCls = (storeCode: string) =>
    rateRedKeys.has(storeCode)
      ? "px-3 py-2 text-sm text-right tabular-nums bg-rose-100 text-rose-800 font-bold"
      : rateGreenKeys.has(storeCode)
        ? "px-3 py-2 text-sm text-right tabular-nums bg-emerald-100 text-emerald-800 font-bold"
        : `${td} text-right tabular-nums`;
  const shareCellCls = (r: (typeof storeStats)[number]) =>
    r.weight !== null && r.sharePct > r.weight
      ? "px-3 py-2 text-sm text-right tabular-nums bg-rose-100 text-rose-800 font-bold"
      : `${td} text-right tabular-nums`;

  // 平均金額前3高標紅、後3低標綠（跟首頁各所統計、特案類型統計表的標色邏輯一致）
  const avgQualifying = storeStats.filter((r) => r.count > 0);
  const sortedByAvgDesc = [...avgQualifying].sort((a, b) => b.avg - a.avg);
  const avgRedKeys = new Set(sortedByAvgDesc.slice(0, N).map((r) => r.storeCode));
  const avgGreenKeys = new Set(sortedByAvgDesc.slice(-N).map((r) => r.storeCode));
  for (const k of [...avgRedKeys]) {
    if (avgGreenKeys.has(k)) {
      avgRedKeys.delete(k);
      avgGreenKeys.delete(k);
    }
  }
  const avgCellCls = (storeCode: string) =>
    avgRedKeys.has(storeCode)
      ? "px-3 py-2 text-sm text-right tabular-nums bg-rose-100 text-rose-800 font-bold"
      : avgGreenKeys.has(storeCode)
        ? "px-3 py-2 text-sm text-right tabular-nums bg-emerald-100 text-emerald-800 font-bold"
        : `${td} text-right tabular-nums font-bold`;

  const totalTarget = storeStats.reduce((s, r) => s + (r.targetCount ?? 0), 0);
  const totalRate = totalTarget > 0 ? (total._count._all / totalTarget) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-800">報表 · {month}</h1>
        <form className="flex items-center gap-2">
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
      </div>
      <p className="text-xs text-slate-400">
        需要下載明細？前往「
        <Link href="/reports/export" className="text-blue-600 hover:underline">
          案件明細下載
        </Link>
        」頁，可選月份區間與所別。
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">總件數</div>
          <div className="text-2xl font-bold text-slate-800">
            {total._count._all}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">特案支援金額總和</div>
          <div className="text-2xl font-bold text-slate-800">
            {money(total._sum.specialSubsidy ?? 0)}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">平均特案支援金額</div>
          <div className="text-2xl font-bold text-slate-800">
            {money(
              total._count._all
                ? Math.round((total._sum.specialSubsidy ?? 0) / total._count._all)
                : 0
            )}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4">
          依據點統計
        </h2>
        <p className="text-xs text-slate-400 px-4 pt-1">
          <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
            偏高／超標
          </span>
          <span className="inline-block mx-1 px-1.5 rounded bg-emerald-100 text-emerald-700">
            偏低
          </span>
          （尚未上傳目標的所別以「-」表示）
        </p>
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={thLabel}>據點</th>
              <th className={th}>目標</th>
              <th className={th}>件數</th>
              <th className={th}>申請比率</th>
              <th className={th}>特案金額總和</th>
              <th className={th}>金額比率</th>
              <th className={th}>平均</th>
            </tr>
          </thead>
          <tbody>
            {storeStats.map((r) => (
              <tr key={r.storeCode} className="border-t border-slate-100">
                <td className={td}>{r.storeCode}</td>
                <td className={`${td} text-right tabular-nums`}>{r.targetCount ?? "-"}</td>
                <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                <td className={rateCellCls(r.storeCode)}>
                  {r.rate !== null ? `${Math.round(r.rate)}%` : "-"}
                </td>
                <td className={`${td} text-right tabular-nums font-bold`}>{money(r.sum)}</td>
                <td className={shareCellCls(r)}>{Math.round(r.sharePct)}%</td>
                <td className={avgCellCls(r.storeCode)}>{money(Math.round(r.avg))}</td>
              </tr>
            ))}
            {byStore.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={7}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {byStore.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={`${td} text-right tabular-nums`}>{totalTarget || "-"}</td>
                <td className={`${td} text-right tabular-nums`}>{total._count._all}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {totalRate !== null ? `${Math.round(totalRate)}%` : "-"}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {money(total._sum.specialSubsidy ?? 0)}
                </td>
                <td className={`${td} text-right tabular-nums`}>100%</td>
                <td className={`${td} text-right tabular-nums`}>
                  {money(
                    total._count._all
                      ? Math.round(
                          (total._sum.specialSubsidy ?? 0) / total._count._all
                        )
                      : 0
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4">
          依特案類別統計
        </h2>
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={thLabel}>類別</th>
              <th className={th}>件數</th>
              <th className={th}>特案金額總和</th>
              <th className={th}>平均</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((r) => (
              <tr key={r.categoryId} className="border-t border-slate-100">
                <td className={td}>{catName(r.categoryId)}</td>
                <td className={`${td} text-right tabular-nums`}>{r._count._all}</td>
                <td className={`${td} text-right tabular-nums font-bold`}>{money(r._sum.specialSubsidy ?? 0)}</td>
                <td className={`${td} text-right tabular-nums font-bold`}>
                  {money(
                    Math.round((r._sum.specialSubsidy ?? 0) / r._count._all)
                  )}
                </td>
              </tr>
            ))}
            {byCategory.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {byCategory.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={`${td} text-right tabular-nums`}>{total._count._all}</td>
                <td className={`${td} text-right tabular-nums`}>{money(total._sum.specialSubsidy ?? 0)}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {money(
                    total._count._all
                      ? Math.round(
                          (total._sum.specialSubsidy ?? 0) / total._count._all
                        )
                      : 0
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </div>
  );
}
