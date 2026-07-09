import { prisma } from "@/lib/prisma";
import { createCategory, toggleCategory } from "@/lib/admin-actions";
import SimpleAddForm from "@/components/admin/SimpleAddForm";

export default async function AdminCategoriesPage() {
  const items = await prisma.caseCategory.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">新增特案類別</h2>
        <SimpleAddForm
          submitAction={createCategory}
          fieldName="name"
          placeholder="類別名稱"
        />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">類別清單</h2>
        <ul className="divide-y divide-slate-100">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5">
              <span
                className={`text-sm ${c.active ? "text-slate-800" : "text-slate-400 line-through"}`}
              >
                {c.name}
              </span>
              <form action={toggleCategory}>
                <input type="hidden" name="id" value={c.id} />
                <button className="text-xs rounded-lg border border-slate-300 px-3 py-1 text-slate-600 hover:bg-slate-50">
                  {c.active ? "停用" : "啟用"}
                </button>
              </form>
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
