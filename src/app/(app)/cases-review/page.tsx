import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
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

export default async function CasesReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryIds?: string | string[] }>;
}) {
  const user = await requireUser();
  if (user.role !== ROLE.KEZHANG && user.role !== ROLE.SUOZHANG) redirect("/");

  const month = currentMonth();
  const sp = await searchParams;
  const selectedCategoryIds =
    sp.categoryIds === undefined
      ? null
      : Array.isArray(sp.categoryIds)
        ? sp.categoryIds
        : [sp.categoryIds];

  // 草稿為私人資料，其他人不可見；此條件排除「他人的草稿」
  const notOthersDraft: Prisma.CaseWhereInput = {
    OR: [{ status: { not: STATUS.DRAFT } }, { submittedById: user.id }],
  };

  let unresolvedWhere: Prisma.CaseWhereInput;
  let unresolvedHint: string;
  let subtitle: string;
  let scopeName: string;
  let monthlyWhere: Prisma.CaseWhereInput;

  if (user.role === ROLE.KEZHANG) {
    const dept = { storeCode: user.storeCode, deptCode: user.deptCode ?? "" };
    unresolvedWhere = { ...dept, status: { not: STATUS.APPROVED }, ...notOthersDraft };
    unresolvedHint = "本課．待審核／已駁回／已撤回／草稿";
    subtitle = `課長 · ${user.storeCode}${user.deptCode ? ` ${user.deptCode} 課` : ""}`;
    scopeName = "本課";
    monthlyWhere = { ...dept, month, ...notOthersDraft };
  } else {
    // 本所：待所長審核／已駁回，以及「本人」撤回或草稿的案件（不含課長撤案）
    // 已通過所長審核、進入待部長審核的案件不算「未結」——已經不是所長要處理的了
    unresolvedWhere = {
      storeCode: user.storeCode,
      OR: [
        { status: STATUS.PENDING_SUOZHANG },
        { status: STATUS.REJECTED },
        { status: STATUS.WITHDRAWN, submittedById: user.id },
        { status: STATUS.DRAFT, submittedById: user.id },
      ],
    };
    unresolvedHint = "本所．所長待審核／已駁回／本人撤回或草稿";
    subtitle = `所長 · ${user.storeCode}`;
    scopeName = "本所";
    monthlyWhere = { storeCode: user.storeCode, month, ...notOthersDraft };
  }

  // 本月申請明細可另外用特案類型篩選（跟部長待審案件頁一致的下拉複選）
  if (selectedCategoryIds) {
    monthlyWhere = { ...monthlyWhere, categoryId: { in: selectedCategoryIds } };
  }

  const [unresolved, monthly, categories] = await Promise.all([
    prisma.case.findMany({
      where: unresolvedWhere,
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
    }),
    prisma.case.findMany({
      where: monthlyWhere,
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
    }),
    prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">案件審核</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <Link
          href="/cases/new"
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
        >
          + 新增申請
        </Link>
      </div>

      <section>
        <h2 className="section-title">
          未結案件 <span className="text-blue-600">({unresolved.length})</span>
          <span className="text-xs text-slate-400 font-normal ml-2">{unresolvedHint}</span>
        </h2>
        <SortableCaseTable rows={unresolved.map(toRow)} emptyText="沒有案件" />
      </section>

      <section className="space-y-3">
        <h2 className="section-title">
          {scopeName}本月申請明細 · {month}{" "}
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
