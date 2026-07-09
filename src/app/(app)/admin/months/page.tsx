import { prisma } from "@/lib/prisma";
import { createMonth, toggleMonth } from "@/lib/admin-actions";
import SimpleAddForm from "@/components/admin/SimpleAddForm";

export default async function AdminMonthsPage() {
  const items = await prisma.monthWindow.findMany({
    orderBy: { month: "desc" },
  });

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">新增月份</h2>
        <SimpleAddForm
          submitAction={createMonth}
          fieldName="month"
          placeholder="YYYY-MM"
        />
        <p className="text-xs text-slate-400 mt-2">
          「關閉」的月份，送單人將無法送出該月案件。
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">月份清單</h2>
        <ul className="divide-y divide-slate-100">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-slate-800 font-mono">{m.month}</span>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${
                    m.isOpen
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {m.isOpen ? "開放中" : "已關閉"}
                </span>
                <form action={toggleMonth}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-xs rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50">
                    {m.isOpen ? "關閉" : "開放"}
                  </button>
                </form>
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-4 text-sm text-slate-400">尚無資料</li>
          )}
        </ul>
      </section>
    </div>
  );
}
