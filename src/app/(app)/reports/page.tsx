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

  // 統計不含草稿（草稿尚未正式送出）
  const reportWhere = { month, status: { not: STATUS.DRAFT } };

  const [byStore, byCategory, total] = await Promise.all([
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
  ]);

  const categories = await prisma.caseCategory.findMany();
  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "（未分類）";

  const th = "text-left text-xs font-semibold text-slate-500 px-3 py-2";
  const td = "px-3 py-2 text-sm text-slate-800";

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
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>據點</th>
              <th className={th}>件數</th>
              <th className={th}>特案金額總和</th>
              <th className={th}>平均</th>
            </tr>
          </thead>
          <tbody>
            {byStore.map((r) => (
              <tr key={r.storeCode} className="border-t border-slate-100">
                <td className={td}>{r.storeCode}</td>
                <td className={td}>{r._count._all}</td>
                <td className={td}>{money(r._sum.specialSubsidy ?? 0)}</td>
                <td className={td}>
                  {money(
                    Math.round((r._sum.specialSubsidy ?? 0) / r._count._all)
                  )}
                </td>
              </tr>
            ))}
            {byStore.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {byStore.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={td}>{total._count._all}</td>
                <td className={td}>{money(total._sum.specialSubsidy ?? 0)}</td>
                <td className={td}>
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
              <th className={th}>類別</th>
              <th className={th}>件數</th>
              <th className={th}>特案金額總和</th>
              <th className={th}>平均</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((r) => (
              <tr key={r.categoryId} className="border-t border-slate-100">
                <td className={td}>{catName(r.categoryId)}</td>
                <td className={td}>{r._count._all}</td>
                <td className={td}>{money(r._sum.specialSubsidy ?? 0)}</td>
                <td className={td}>
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
                <td className={td}>{total._count._all}</td>
                <td className={td}>{money(total._sum.specialSubsidy ?? 0)}</td>
                <td className={td}>
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
