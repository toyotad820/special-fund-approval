import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canResubmit, getDeptCodesForStore } from "@/lib/dal";
import { updateCase } from "@/lib/actions";
import { STATUS } from "@/lib/constants";
import { normalizeDeptCode } from "@/lib/format";
import CaseForm from "@/components/CaseForm";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const c = await prisma.case.findUnique({ where: { id } });
  if (!c || !canResubmit(user, c)) redirect(`/cases/${id}`);

  const deptEditable = !user.deptCode;
  const [categories, cars, deptCodesRaw] = await Promise.all([
    prisma.caseCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.carModel.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    deptEditable ? getDeptCodesForStore(c!.storeCode) : Promise.resolve([]),
  ]);

  // 若此案原本選的課別已不在目前有效清單（例如該課長已停用），仍將其併入選項，
  // 避免下拉選單找不到目前值而顯示空白。
  const currentDept = normalizeDeptCode(c!.deptCode);
  const deptOptions =
    currentDept && !deptCodesRaw.includes(currentDept)
      ? [...deptCodesRaw, currentDept].sort((a, b) => Number(a) - Number(b))
      : deptCodesRaw;

  const isDraft = c!.status === STATUS.DRAFT;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-slate-800 mb-4">
        {isDraft ? "編輯草稿" : "修改後重送"}
      </h1>
      <div className="card p-5">
        <CaseForm
          submitAction={updateCase}
          categories={categories}
          cars={cars}
          month={c!.month}
          storeCode={c!.storeCode}
          deptCode={c!.deptCode}
          deptEditable={deptEditable}
          deptOptions={deptOptions}
          allowDraft={isDraft}
          caseId={c!.id}
          initial={{
            plateName: c!.plateName,
            orderNo: c!.orderNo.startsWith("DRAFT-") ? "" : c!.orderNo,
            categoryId: c!.categoryId ?? "",
            categoryNo: c!.categoryNo,
            carModel: c!.carModel,
            description: c!.description,
            deptCode: c!.deptCode,
            subsidyDeptCourse: c!.subsidyDeptCourse,
            goldMedal: c!.goldMedal,
            silverMedal: c!.silverMedal,
            discountTotal: c!.discountTotal,
            specialSubsidy: c!.specialSubsidy,
          }}
          submitLabel={isDraft ? "送出申請" : "修改後重送"}
        />
      </div>
    </div>
  );
}
