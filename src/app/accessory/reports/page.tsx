import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AccessoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; level?: string }>;
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
  const level: "store" | "dept" = sp.level === "dept" ? "dept" : "store";

  // 統計不含草稿／已退件／已撤回（皆非實際生效案件）
  const reportWhere = {
    month,
    status: {
      notIn: [ACC_STATUS.DRAFT, ACC_STATUS.REJECTED, ACC_STATUS.WITHDRAWN],
    },
  };

  const [requests, byCar, storeTargets] = await Promise.all([
    // 配件申請單本身無課別欄位，課別由送單人（副所長）帶出；所長送單視為所層級（deptCode="0"）
    prisma.accessoryRequest.findMany({
      where: reportWhere,
      select: { storeCode: true, submittedBy: { select: { deptCode: true } } },
    }),
    prisma.accessoryRequest.groupBy({
      by: ["carModel"],
      where: reportWhere,
      _count: { _all: true },
      orderBy: { _count: { carModel: "desc" } },
    }),
    // 所層級目標 deptCode="0"；課層級目標為實際課別；跟特案系統共用同一份目標
    prisma.unitTarget.findMany({
      where: level === "dept" ? { month, deptCode: { not: "0" } } : { month, deptCode: "0" },
    }),
  ]);

  const total = requests.length;

  const targetByKey = new Map(
    storeTargets.map((t) => [level === "dept" ? `${t.storeCode}-${t.deptCode}` : t.storeCode, t])
  );

  const countByKey = new Map<string, number>();
  const labelByKey = new Map<string, string>();
  for (const r of requests) {
    const dept = r.submittedBy.deptCode || "0";
    const key = level === "dept" ? `${r.storeCode}-${dept}` : r.storeCode;
    const label = level === "dept" ? `${r.storeCode} ${dept === "0" ? "（所）" : `${dept}課`}` : r.storeCode;
    countByKey.set(key, (countByKey.get(key) ?? 0) + 1);
    labelByKey.set(key, label);
  }

  const unitStats = [...countByKey.entries()]
    .map(([key, count]) => {
      const t = targetByKey.get(key);
      return {
        key,
        label: labelByKey.get(key) ?? key,
        count,
        targetCount: t?.targetCount ?? null,
        rate: t?.targetCount ? (count / t.targetCount) * 100 : null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const totalTarget = unitStats.reduce((s, r) => s + (r.targetCount ?? 0), 0);
  const totalRate = totalTarget > 0 ? (total / totalTarget) * 100 : null;

  const th = "text-center text-xs font-semibold text-slate-500 px-3 py-2";
  const td = "px-3 py-2 text-sm text-slate-800";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-slate-800">配件變更報表 · {month}</h1>
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
      </div>
      <p className="text-xs text-slate-400">
        需要下載明細？前往「
        <Link href="/accessory/reports/export" className="text-blue-600 hover:underline">
          申請明細下載
        </Link>
        」頁，可選月份區間與所別。
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">總申請件數</div>
          <div className="text-2xl font-bold text-slate-800">{total}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-400">整體申請比率（件數/目標）</div>
          <div className="text-2xl font-bold text-slate-800">
            {totalRate !== null ? `${Math.round(totalRate)}%` : "-"}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between flex-wrap gap-2 px-4 pt-4">
          <h2 className="text-sm font-semibold text-slate-700">依所課別統計</h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <Link
              href={`/accessory/reports?level=store&month=${month}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                level === "store"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              依所別
            </Link>
            <Link
              href={`/accessory/reports?level=dept&month=${month}`}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                level === "dept"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              依課別
            </Link>
          </div>
        </div>
        <p className="text-xs text-slate-400 px-4 pt-1">
          申請比率 = 申請件數 / 目標台數（尚未上傳目標的單位以「-」表示；課別統計依送單人課別歸屬，所長送單歸為「所」層級）
        </p>
        <table className="w-full mt-2">
          <thead className="bg-slate-50">
            <tr>
              <th className={`${th} text-left`}>{level === "store" ? "所別" : "所／課別"}</th>
              <th className={th}>目標</th>
              <th className={th}>申請件數</th>
              <th className={th}>申請比率</th>
            </tr>
          </thead>
          <tbody>
            {unitStats.map((r) => (
              <tr key={r.key} className="border-t border-slate-100">
                <td className={td}>{r.label}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.targetCount ?? "-"}
                </td>
                <td className={`${td} text-right tabular-nums`}>{r.count}</td>
                <td className={`${td} text-right tabular-nums`}>
                  {r.rate !== null ? `${Math.round(r.rate)}%` : "-"}
                </td>
              </tr>
            ))}
            {unitStats.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-slate-400" colSpan={4}>
                  本月無資料
                </td>
              </tr>
            )}
          </tbody>
          {unitStats.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50/70">
                <td className={td}>總計</td>
                <td className={`${td} text-right tabular-nums`}>
                  {totalTarget || "-"}
                </td>
                <td className={`${td} text-right tabular-nums`}>{total}</td>
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
                <td className={`${td} text-right tabular-nums`}>{total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </div>
  );
}
