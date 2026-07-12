import { prisma } from "@/lib/prisma";
import { createCar, toggleCar, syncStandardCarModels } from "@/lib/admin-actions";
import SimpleAddForm from "@/components/admin/SimpleAddForm";
import DeleteCarButton from "@/components/admin/DeleteCarButton";

export default async function AdminCarsPage() {
  const items = await prisma.carModel.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">同步標準車型清單</h2>
        <p className="text-xs text-slate-500 mb-3">
          一鍵把車種清單同步成目前 TOYOTA 標準車型（清單內的啟用並排序，清單外的既有車種直接刪除）。
        </p>
        <form action={syncStandardCarModels}>
          <button className="text-xs rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-blue-700 hover:bg-blue-100">
            同步為標準車型清單
          </button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">新增車種</h2>
        <SimpleAddForm
          submitAction={createCar}
          fieldName="name"
          placeholder="車種名稱"
        />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">車種清單</h2>
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5">
              <span
                className={`text-sm ${c.active ? "text-slate-800" : "text-slate-400 line-through"}`}
              >
                {c.name}
              </span>
              <div className="flex items-center gap-3">
                <form action={toggleCar}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50">
                    {c.active ? "停用" : "啟用"}
                  </button>
                </form>
                <DeleteCarButton id={c.id} name={c.name} />
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
