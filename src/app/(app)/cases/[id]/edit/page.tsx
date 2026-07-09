import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canResubmit } from "@/lib/dal";
import { updateCase } from "@/lib/actions";
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

  const [categories, cars] = await Promise.all([
    prisma.caseCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.carModel.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-lg font-bold text-slate-800 mb-4">修改後重送</h1>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <CaseForm
          submitAction={updateCase}
          categories={categories}
          cars={cars}
          month={c!.month}
          storeCode={c!.storeCode}
          deptCode={c!.deptCode}
          caseId={c!.id}
          initial={{
            plateName: c!.plateName,
            orderNo: c!.orderNo,
            categoryId: c!.categoryId,
            categoryNo: c!.categoryNo,
            carModel: c!.carModel,
            description: c!.description,
            subsidyDeptCourse: c!.subsidyDeptCourse,
            goldMedal: c!.goldMedal,
            silverMedal: c!.silverMedal,
            discountTotal: c!.discountTotal,
            specialSubsidy: c!.specialSubsidy,
          }}
          submitLabel="修改後重送"
        />
      </div>
    </div>
  );
}
