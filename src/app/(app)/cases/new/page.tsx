import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canSubmit, getDeptCodesForStore, getActiveMonth } from "@/lib/dal";
import { createCase } from "@/lib/actions";
import CaseForm from "@/components/CaseForm";
import DeleteCaseByOrderNo from "@/components/DeleteCaseByOrderNo";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const user = await requireUser();
  if (!canSubmit(user)) redirect("/");

  const month = await getActiveMonth();
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

      {deleted === "1" && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3 mb-4">
          已刪除該案件。
        </p>
      )}

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

        <div className="mt-6 pt-6 border-t border-slate-200">
          <DeleteCaseByOrderNo />
        </div>
      </div>
    </div>
  );
}
