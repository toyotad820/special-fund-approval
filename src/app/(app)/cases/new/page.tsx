import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canSubmit, getDeptCodesForStore } from "@/lib/dal";
import { createCase } from "@/lib/actions";
import CaseForm from "@/components/CaseForm";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function NewCasePage() {
  const user = await requireUser();
  if (!canSubmit(user)) redirect("/");

  const month = currentMonth();
  const deptEditable = !user.deptCode;
  const [categories, cars, window, deptOptions] = await Promise.all([
    prisma.caseCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.carModel.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.monthWindow.findUnique({ where: { month } }),
    deptEditable ? getDeptCodesForStore(user.storeCode) : Promise.resolve([]),
  ]);

  const closed = window ? !window.isOpen : false;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-slate-800 mb-4">新增特案申請</h1>

      {closed && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3 mb-4">
          本月（{month}）已關閉，暫不開放正式送出；您仍可先儲存草稿，待開放後再送出。
        </p>
      )}

      <div className="card p-5">
        <CaseForm
          submitAction={createCase}
          categories={categories}
          cars={cars}
          month={month}
          storeCode={user.storeCode}
          deptCode={user.deptCode ?? ""}
          deptEditable={deptEditable}
          deptOptions={deptOptions}
          allowDraft
          submitLabel="送出申請"
        />
      </div>
    </div>
  );
}
