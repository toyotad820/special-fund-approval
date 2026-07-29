import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import StoreCheckboxGroup from "@/components/StoreCheckboxGroup";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AccessoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  // 部長／配件中心／Staff 可看
  if (
    user.role !== ROLE.BUZHUGUAN &&
    user.role !== ROLE.PEIJIAN &&
    user.role !== ROLE.STAFF
  ) {
    notFound();
  }

  const sp = await searchParams;
  const month = sp.month || currentMonth();

  // 統計不含草稿／已退件／已撤回（皆非實際生效案件）
  const reportWhere = {
    month,
    status: {
      notIn: [ACC_STATUS.DRAFT, ACC_STATUS.REJECTED, ACC_STATUS.WITHDRAWN],
    },
  };

  const [byStore, byCar, total, storeTargets, storeRows] = await Promise.all([
    prisma.accessoryRequest.groupBy({
      by: ["storeCode"],
      where: reportWhere,
      _count: { _all: true },
      orderBy: { storeCode: "asc" },
    }),
    prisma.accessoryRequest.groupBy({
      by: ["carModel"],
      where: reportWhere,
      _count: { _all: true },
      orderBy: { _count: { carModel: "desc" } },
    }),
    prisma.accessoryRequest.aggregate({
      where: reportWhere,
      _count: { _all: true },
    }),
    // 所層級目標（deptCode="0"）：跟特案共用同一份目標
    prisma.unitTarget.findMany({ where: { month, deptCode: "0" } }),
    prisma.user.findMany({
      where: { storeCode: { not: "HQ" } },
      select: { storeCode: true },
      distinct: ["storeCode"],
    }),
  ]);

  const stores = storeRows
    .map((r) => r.storeCode)
    .sort((a, b) => a.localeCompare(b));

  const targetByStore = new Map(storeTargets.map((t) => [t.storeCode, t]));
  const storeStats = byStore.map((r) => {
    const t = targetByStore.get(r.storeCode);
    const count = r._count._all;
    return {
      storeCode: r.storeCode,
      count,
      targetCount: t?.targetCount ?? null,
      rate: t?.targetCount ? (count / t.targetCount) * 100 : null,
    };
  });

  const totalTarget = storeStats.reduce((s, r) => s + (r.targetCount ?? 0), 0);
  const totalRate =
    totalTarget > 0 ? (total._count._all / totalTarget) * 100 : null;

  const th = "text-center text-xs font-semibold text-slate-500 px-3 py-2";
  const td = "px-3 py-2 text-sm text-slate-800";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-800">配件變更報表 · {month}</h1>
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

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">總申請件數</div>
          <div className="text-2xl font-bold text-slate-800">
            {total._count._all}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">整體申請比率（件數/目標）</div>
          <div className="text-2xl font-bold text-slate-800">
            {totalRate !== null ? `${Math.round(totalRate)}%` : "-"}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4">
          依所別統計
        </h2>
        <p className="text-xs text-slate-400 px-4 pt-1">
          申請比率 = 申請件數 / 目標台數（尚未上傳目標的所別以「-」表示）
        </p>
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>所別</th>
              <th className={th}>目標</th>
              <th className={th}>申請件數</th>
              <th className={th}>申請比率</th>
            </tr>
          </thead>
          <tbody>
            {storeStats.map((r) => (
              <tr key={r.storeCode} className="border-t border-slate-100">
                <td className={td}>{r.storeCode}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.targetCount ?? "-"}
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.rate !== null ? `${Math.round(r.rate)}%` : "-"}
                </td>
              </tr>
            ))}
            {storeStats.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {storeStats.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={`${td} text-right tabular-nums`}>
                  {totalTarget || "-"}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {total._count._all}
                </td>
                <td className={`${td} text-right tabular-nums`}>
                  {totalRate !== null ? `${Math.round(totalRate)}%` : "-"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4">
          依車種統計
        </h2>
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} text-left`}>車名</th>
              <th className={th}>申請件數</th>
            </tr>
          </thead>
          <tbody>
            {byCar.map((r) => (
              <tr key={r.carModel} className="border-t border-slate-100">
                <td className={td}>{r.carModel || "（未填）"}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r._count._all}
                </td>
              </tr>
            ))}
            {byCar.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={2}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {byCar.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={`${td} text-right tabular-nums`}>
                  {total._count._all}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">申請明細下載</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            選擇月份區間與所別，下載申請明細 CSV（含更換說明，不含草稿）
          </p>
        </div>
        <form action="/api/accessory/reports/export" method="GET" className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4 max-w-md">
            <div>
              <label className="label">起始月份</label>
              <input
                type="month"
                name="from"
                defaultValue={month}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label">結束月份</label>
              <input
                type="month"
                name="to"
                defaultValue={month}
                required
                className="input"
              />
            </div>
          </div>
          <StoreCheckboxGroup stores={stores} />
          <button type="submit" className="btn btn-primary">
            下載 CSV
          </button>
        </form>
      </section>
    </div>
  );
}
