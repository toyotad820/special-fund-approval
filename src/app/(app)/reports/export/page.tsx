import { prisma } from "@/lib/prisma";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportExportPage() {
  const month = currentMonth();

  const storeRows = await prisma.user.findMany({
    where: { storeCode: { not: "HQ" } },
    select: { storeCode: true },
    distinct: ["storeCode"],
  });
  const stores = storeRows.map((r) => r.storeCode).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">案件明細下載</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          選擇月份區間與所別，下載該範圍的案件明細 CSV（不含草稿）
        </p>
      </div>

      <form
        action="/api/reports/export"
        method="GET"
        className="card p-5 space-y-5"
      >
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

        <div>
          <div className="label mb-2">所別（預設全選＝全部所；取消勾選即為部分所）</div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {stores.map((s) => (
              <label
                key={s}
                className="flex items-center gap-1.5 text-sm text-slate-700 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="storeCodes"
                  value={s}
                  defaultChecked
                  className="rounded"
                />
                {s}
              </label>
            ))}
          </div>
          {stores.length === 0 && (
            <p className="text-sm text-slate-400">尚無所別資料</p>
          )}
        </div>

        <button type="submit" className="btn btn-primary">
          下載 CSV
        </button>
      </form>
    </div>
  );
}
