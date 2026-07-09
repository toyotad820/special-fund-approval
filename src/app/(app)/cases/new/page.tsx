import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canSubmit } from "@/lib/dal";
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
  const [categories, cars, window] = await Promise.all([
    prisma.caseCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.carModel.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.monthWindow.findUnique({ where: { month } }),
  ]);

  const closed = window ? !window.isOpen : false;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-slate-800 mb-4">新增特案申請</h1>

      {closed ? (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          本月（{month}）已關閉，暫不開放送單。
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <CaseForm
            submitAction={createCase}
            categories={categories}
            cars={cars}
            month={month}
            storeCode={user.storeCode}
            deptCode={user.deptCode ?? ""}
            submitLabel="送出申請"
          />
        </div>
      )}
    </div>
  );
}
