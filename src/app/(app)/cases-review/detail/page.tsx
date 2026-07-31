import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ROLE, STATUS } from "@/lib/constants";
import SortableCaseTable from "@/components/SortableCaseTable";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { caseInclude, toRow } from "../../page";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CasesReviewDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryIds?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role !== ROLE.SUOZHANG) redirect("/");

  const month = currentMonth();
  const sp = await searchParams;
  const selectedCategoryIds =
    sp.categoryIds === undefined
      ? null
      : Array.isArray(sp.categoryIds)
        ? sp.categoryIds
        : [sp.categoryIds];

  let monthlyWhere: Prisma.CaseWhereInput = {
    storeCode: user.storeCode,
    month,
    OR: [{ status: { not: STATUS.DRAFT } }, { submittedById: user.id }],
  };
  if (selectedCategoryIds) {
    monthlyWhere = { ...monthlyWhere, categoryId: { in: selectedCategoryIds } };
  }

  const [monthly, categories] = await Promise.all([
    prisma.case.findMany({
      where: monthlyWhere,
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
    }),
    prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800">案件明細</h1>
        <p className="text-sm text-slate-500">所長 · {user.storeCode}</p>
      </div>

      <section className="space-y-3">
        <h2 className="section-title">
          本所本月申請明細 · {month}{" "}
          <span className="text-blue-600">({monthly.length})</span>
        </h2>
        <form className="flex flex-wrap items-center gap-2">
          <MultiSelectDropdown
            label="特案類型"
            name="categoryIds"
            groupName="dashboard-filters"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <button type="submit" className="btn btn-primary">
            查詢
          </button>
        </form>
        <SortableCaseTable rows={monthly.map(toRow)} emptyText="本月尚無申請" showTotals />
      </section>
    </div>
  );
}
