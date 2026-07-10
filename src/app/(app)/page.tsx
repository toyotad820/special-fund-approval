import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  reviewQueueWhere,
  visibilityWhere,
  canSubmit,
} from "@/lib/dal";
import { ROLE, ROLE_LABEL, STATUS } from "@/lib/constants";
import { money } from "@/lib/format";
import CaseList from "@/components/CaseList";
import SortableCaseTable, {
  type CaseRowData,
} from "@/components/SortableCaseTable";
import SimpleDonutChart from "@/components/SimpleDonutChart";
import SimpleComboChart from "@/components/SimpleComboChart";

const caseInclude = {
  category: { select: { name: true } },
  submittedBy: { select: { name: true } },
  logs: {
    where: { action: "REJECT" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { step: true, reviewer: { select: { name: true } } },
  },
} as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type CaseWithRels = {
  id: string;
  orderNo: string;
  month: string;
  plateName: string;
  categoryNo: string;
  carModel: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
  description: string;
  submittedAt: Date;
  status: string;
  category: { name: string } | null;
  submittedBy: { name: string };
  logs: { step: string; reviewer: { name: string } }[];
};

function toRow(c: CaseWithRels): CaseRowData {
  const rej = c.status === STATUS.REJECTED ? c.logs[0] : undefined;
  return {
    id: c.id,
    orderNo: c.orderNo,
    month: c.month,
    plateName: c.plateName,
    categoryName: c.category?.name ?? "（尚未選擇）",
    categoryNo: c.categoryNo,
    carModel: c.carModel,
    subsidyDeptCourse: c.subsidyDeptCourse,
    goldMedal: c.goldMedal,
    silverMedal: c.silverMedal,
    discountTotal: c.discountTotal,
    specialSubsidy: c.specialSubsidy,
    description: c.description,
    submitterName: c.submittedBy.name,
    submittedAt: c.submittedAt.toISOString(),
    status: c.status,
    rejectedByRole: rej ? ROLE_LABEL[rej.step] ?? "" : null,
  };
}

function scopeLabel(role: string): string {
  if (role === ROLE.KEZHANG) return "本課案件";
  if (role === ROLE.SUOZHANG) return "本所案件";
  return "全部案件";
}

type StatRow = { label: string; count: number; sum: number; avg: number };

// 統計區：各特案類別統計 + 各所統計（不含草稿），供部長/Staff 首頁使用
async function DashboardStats({ month }: { month: string }) {
  const statusFilter = { not: STATUS.DRAFT } as const;

  const [byCategory, byStore, categories] = await Promise.all([
    prisma.case.groupBy({
      by: ["categoryId"],
      where: { month, status: statusFilter },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    }),
    prisma.case.groupBy({
      by: ["storeCode"],
      where: { month, status: statusFilter },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    }),
    prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "（未分類）";

  const toStatRow = (label: string, sum: number | null, count: number): StatRow => ({
    label,
    count,
    sum: sum ?? 0,
    avg: count > 0 ? Math.round((sum ?? 0) / count) : 0,
  });

  const categoryRows = byCategory
    .map((r) => toStatRow(catName(r.categoryId), r._sum.specialSubsidy, r._count._all))
    .sort((a, b) => b.sum - a.sum);

  const storeRows = byStore
    .map((r) => toStatRow(r.storeCode, r._sum.specialSubsidy, r._count._all))
    .sort((a, b) => b.avg - a.avg);

  const StatTable = ({ rows, unitLabel }: { rows: StatRow[]; unitLabel: string }) => {
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const totalSum = rows.reduce((s, r) => s + r.sum, 0);
    const totalAvg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

    return (
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="text-xs text-slate-400 text-left">
            <th className="py-1 font-medium">{unitLabel}</th>
            <th className="py-1 font-medium text-right">件數</th>
            <th className="py-1 font-medium text-right">金額總和</th>
            <th className="py-1 font-medium text-right">佔比</th>
            <th className="py-1 font-medium text-right">平均</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-700">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{r.count}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-800 font-medium">
                {money(r.sum)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">
                {totalSum > 0 ? `${Math.round((r.sum / totalSum) * 100)}%` : "-"}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{money(r.avg)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-4">
                本月尚無資料
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold text-slate-800">
              <td className="py-1.5">合計</td>
              <td className="py-1.5 text-right tabular-nums">{totalCount}</td>
              <td className="py-1.5 text-right tabular-nums">{money(totalSum)}</td>
              <td className="py-1.5 text-right tabular-nums">100%</td>
              <td className="py-1.5 text-right tabular-nums">{money(totalAvg)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    );
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <section className="card p-4">
        <h2 className="section-title">各特案類別統計 · {month}</h2>
        <SimpleDonutChart data={categoryRows.map((r) => ({ label: r.label, value: r.sum }))} />
        <StatTable rows={categoryRows} unitLabel="類別" />
      </section>

      <section className="card p-4">
        <h2 className="section-title">各所統計（總額 × 平均）· {month}</h2>
        <SimpleComboChart
          barLabel="金額總和"
          lineLabel="平均金額"
          data={storeRows.map((r) => ({ label: r.label, bar: r.sum, line: r.avg }))}
        />
        <StatTable rows={storeRows} unitLabel="所別" />
      </section>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  // 課長／所長／部長／Staff：角色專屬首頁（案件區塊 + 部長/Staff 多一塊統計區）
  if (
    user.role === ROLE.KEZHANG ||
    user.role === ROLE.SUOZHANG ||
    user.role === ROLE.BUZHUGUAN ||
    user.role === ROLE.STAFF
  ) {
    return <RoleDashboard user={user} />;
  }

  const queueWhere = reviewQueueWhere(user);

  const [queue, mine, visible] = await Promise.all([
    queueWhere
      ? prisma.case.findMany({
          where: queueWhere,
          include: caseInclude,
          orderBy: { stepEnteredAt: "asc" },
        })
      : Promise.resolve([]),
    canSubmit(user)
      ? prisma.case.findMany({
          where: { submittedById: user.id },
          include: caseInclude,
          orderBy: { submittedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.case.findMany({
      // 草稿為私人資料，一般可視範圍查詢一律排除他人草稿
      where: { ...visibilityWhere(user), status: { not: STATUS.DRAFT } },
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            您好，{user.name}
          </h1>
          <p className="text-sm text-slate-500">
            {ROLE_LABEL[user.role]}
            {user.storeCode !== "HQ" ? ` · ${user.storeCode}` : ""}
          </p>
        </div>
        {canSubmit(user) && (
          <Link
            href="/cases/new"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + 新增申請
          </Link>
        )}
      </div>

      {queueWhere && (
        <section>
          <h2 className="section-title">
            待我審核{" "}
            <span className="text-blue-600">({queue.length})</span>
          </h2>
          <CaseList cases={queue} />
        </section>
      )}

      {canSubmit(user) && (
        <section>
          <h2 className="section-title">
            我送出的案件
          </h2>
          <CaseList cases={mine} />
        </section>
      )}

      <section>
        <h2 className="section-title">
          {scopeLabel(user.role)}
        </h2>
        <CaseList cases={visible} />
      </section>
    </div>
  );
}

async function RoleDashboard({
  user,
}: {
  user: {
    id: string;
    role: string;
    name: string;
    storeCode: string;
    deptCode: string | null;
  };
}) {
  const month = currentMonth();

  // Staff：首頁只有統計區，沒有案件明細
  if (user.role === ROLE.STAFF) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-slate-800">您好，{user.name}</h1>
          <p className="text-sm text-slate-500">Staff</p>
        </div>
        <DashboardStats month={month} />
      </div>
    );
  }

  let unresolvedWhere: Prisma.CaseWhereInput;
  let unresolvedTitle: string;
  let unresolvedHint: string;
  let subtitle: string;
  let scopeName = "";
  let monthlyWhere: Prisma.CaseWhereInput | null = null;

  // 草稿為私人資料，其他人不可見；此條件排除「他人的草稿」
  const notOthersDraft: Prisma.CaseWhereInput = {
    OR: [{ status: { not: STATUS.DRAFT } }, { submittedById: user.id }],
  };

  if (user.role === ROLE.KEZHANG) {
    const dept = { storeCode: user.storeCode, deptCode: user.deptCode ?? "" };
    unresolvedWhere = {
      ...dept,
      status: { not: STATUS.APPROVED },
      ...notOthersDraft,
    };
    unresolvedTitle = "未結案件";
    unresolvedHint = "本課．待審核／已駁回／已撤回／草稿";
    subtitle = `課長 · ${user.storeCode}${user.deptCode ? ` ${user.deptCode} 課` : ""}`;
    scopeName = "本課";
    monthlyWhere = { ...dept, month, ...notOthersDraft };
  } else if (user.role === ROLE.SUOZHANG) {
    // 本所：待審核／已駁回，以及「本人」撤回或草稿的案件（不含課長撤案）
    unresolvedWhere = {
      storeCode: user.storeCode,
      OR: [
        {
          status: {
            in: [
              STATUS.PENDING_SUOZHANG,
              STATUS.PENDING_BUZHUGUAN,
              STATUS.REJECTED,
            ],
          },
        },
        { status: STATUS.WITHDRAWN, submittedById: user.id },
        { status: STATUS.DRAFT, submittedById: user.id },
      ],
    };
    unresolvedTitle = "未結案件";
    unresolvedHint = "本所．待審核／已駁回／本人撤回或草稿";
    subtitle = `所長 · ${user.storeCode}`;
    scopeName = "本所";
    monthlyWhere = { storeCode: user.storeCode, month, ...notOthersDraft };
  } else {
    // 部主管：只顯示待部主管審核的案件
    unresolvedWhere = { status: STATUS.PENDING_BUZHUGUAN };
    unresolvedTitle = "待審核案件";
    unresolvedHint = "待部長審核";
    subtitle = "部長";
    monthlyWhere = null;
  }

  const [unresolved, monthly] = await Promise.all([
    prisma.case.findMany({
      where: unresolvedWhere,
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
    }),
    monthlyWhere
      ? prisma.case.findMany({
          where: monthlyWhere,
          include: caseInclude,
          orderBy: { submittedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const canAdd = user.role === ROLE.KEZHANG || user.role === ROLE.SUOZHANG;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">您好，{user.name}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {canAdd && (
          <Link
            href="/cases/new"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + 新增申請
          </Link>
        )}
      </div>

      {user.role === ROLE.BUZHUGUAN && <DashboardStats month={month} />}

      <section>
        <h2 className="section-title">
          {unresolvedTitle}{" "}
          <span className="text-blue-600">({unresolved.length})</span>
          <span className="text-xs text-slate-400 font-normal ml-2">
            {unresolvedHint}
          </span>
        </h2>
        <SortableCaseTable rows={unresolved.map(toRow)} emptyText="沒有案件" />
      </section>

      {monthlyWhere && (
        <section>
          <h2 className="section-title">
            {scopeName}本月申請明細 · {month}{" "}
            <span className="text-blue-600">({monthly.length})</span>
          </h2>
          <SortableCaseTable
            rows={monthly.map(toRow)}
            emptyText="本月尚無申請"
            showTotals
          />
        </section>
      )}
    </div>
  );
}
