import { prisma } from "@/lib/prisma";
import TargetImportForm from "@/components/admin/TargetImportForm";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = sp.month || currentMonth();

  const targets = await prisma.unitTarget.findMany({
    where: { month },
    orderBy: [{ storeCode: "asc" }, { deptCode: "asc" }],
  });

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">上傳目標台數</h2>
        <TargetImportForm />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            已上傳資料 · {month}
          </h2>
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

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="py-1.5 font-medium text-left">所別</th>
              <th className="py-1.5 font-medium text-left">課別</th>
              <th className="py-1.5 font-medium text-center">比重</th>
              <th className="py-1.5 font-medium text-center">目標台數</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((t) => {
              const isStoreLevel = t.deptCode === "0";
              return (
                <tr
                  key={t.id}
                  className={`border-t border-slate-100 ${isStoreLevel ? "bg-slate-50/70 font-semibold" : ""}`}
                >
                  <td className="py-1.5 text-left text-slate-700">{t.storeCode}</td>
                  <td className="py-1.5 text-left text-slate-700">
                    {isStoreLevel ? "（所）" : `${t.deptCode}課`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {t.weight}%
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-600">
                    {t.targetCount}
                  </td>
                </tr>
              );
            })}
            {targets.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-slate-400 py-4">
                  本月尚無資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
