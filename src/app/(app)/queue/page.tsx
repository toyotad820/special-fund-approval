import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, STATUS } from "@/lib/constants";
import SortableCaseTable from "@/components/SortableCaseTable";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";
import { caseInclude, toRow } from "../page";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toArray(v: string | string[] | undefined): string[] | null {
  if (v === undefined) return null;
  return Array.isArray(v) ? v : [v];
}

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ storeCodes?: string | string[]; categoryIds?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role !== ROLE.BUZHUGUAN) redirect("/");

  const sp = await searchParams;
  const month = currentMonth();

  const [cases, storeRows, categories] = await Promise.all([
    prisma.case.findMany({
      where: { status: STATUS.PENDING_BUZHUGUAN },
      include: caseInclude,
      orderBy: { submittedAt: "asc" },
    }),
    prisma.user.findMany({
      where: { storeCode: { not: "HQ" } },
      select: { storeCode: true },
      distinct: ["storeCode"],
    }),
    prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const stores = storeRows.map((r) => r.storeCode).sort((a, b) => a.localeCompare(b));

  // 沒有帶篩選參數（第一次進頁）視為不限制；有帶就依選取的值篩選
  const selectedStores = toArray(sp.storeCodes);
  const selectedCategoryIds = toArray(sp.categoryIds);

  const monthlyCases = await prisma.case.findMany({
    where: {
      month,
      status: { not: STATUS.DRAFT },
      ...(selectedStores ? { storeCode: { in: selectedStores } } : {}),
      ...(selectedCategoryIds ? { categoryId: { in: selectedCategoryIds } } : {}),
    },
    include: caseInclude,
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-800">
        待審案件 <span className="text-blue-600">({cases.length})</span>
      </h1>
      <SortableCaseTable rows={cases.map(toRow)} emptyText="沒有案件" />

      <section className="space-y-3">
        <h2 className="section-title">
          申請案件明細 · {month}{" "}
          <span className="text-blue-600">({monthlyCases.length})</span>
        </h2>
        <form className="flex flex-wrap items-center gap-2">
          <MultiSelectDropdown
            label="所別"
            name="storeCodes"
            groupName="queue-filters"
            options={stores.map((s) => ({ value: s, label: s }))}
          />
          <MultiSelectDropdown
            label="特案類型"
            name="categoryIds"
            groupName="queue-filters"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <button type="submit" className="btn btn-primary">
            查詢
          </button>
        </form>
        <SortableCaseTable rows={monthlyCases.map(toRow)} emptyText="沒有案件" showTotals />
      </section>
    </div>
  );
}
