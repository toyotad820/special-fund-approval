import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  reviewQueueWhere,
  visibilityWhere,
  canSubmit,
} from "@/lib/dal";
import { ROLE, ROLE_LABEL, STATUS } from "@/lib/constants";
import CaseList from "@/components/CaseList";
import SortableCaseTable, {
  type CaseRowData,
} from "@/components/SortableCaseTable";

const caseInclude = {
  category: { select: { name: true } },
  submittedBy: { select: { name: true } },
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
  category: { name: string };
  submittedBy: { name: string };
};

function toRow(c: CaseWithRels): CaseRowData {
  return {
    id: c.id,
    orderNo: c.orderNo,
    month: c.month,
    plateName: c.plateName,
    categoryName: c.category.name,
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
  };
}

function scopeLabel(role: string): string {
  if (role === ROLE.KEZHANG) return "本課案件";
  if (role === ROLE.SUOZHANG) return "本所案件";
  return "全部案件";
}

export default async function DashboardPage() {
  const user = await requireUser();

  // 課長／所長／部主管：兩區塊模式（未結案件 + 單位本月明細）
  if (
    user.role === ROLE.KEZHANG ||
    user.role === ROLE.SUOZHANG ||
    user.role === ROLE.BUZHUGUAN
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
      where: visibilityWhere(user),
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
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            待我審核{" "}
            <span className="text-blue-600">({queue.length})</span>
          </h2>
          <CaseList cases={queue} />
        </section>
      )}

      {canSubmit(user) && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            我送出的案件
          </h2>
          <CaseList cases={mine} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">
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
    role: string;
    name: string;
    storeCode: string;
    deptCode: string | null;
  };
}) {
  const month = currentMonth();

  // 依角色決定範圍、名稱、是否顯示「單位所有案件」區塊
  let scopeWhere: { storeCode?: string; deptCode?: string };
  let scopeName: string;
  let subtitle: string;
  let showMonthly: boolean;

  if (user.role === ROLE.KEZHANG) {
    scopeWhere = { storeCode: user.storeCode, deptCode: user.deptCode ?? "" };
    scopeName = "本課";
    subtitle = `課長 · ${user.storeCode}${user.deptCode ? ` ${user.deptCode} 課` : ""}`;
    showMonthly = true;
  } else if (user.role === ROLE.SUOZHANG) {
    scopeWhere = { storeCode: user.storeCode };
    scopeName = "本所";
    subtitle = `所長 · ${user.storeCode}`;
    showMonthly = true;
  } else {
    // 部主管：全部據點，不顯示「所有案件」區塊
    scopeWhere = {};
    scopeName = "全部";
    subtitle = "部主管";
    showMonthly = false;
  }

  const [unresolved, monthly] = await Promise.all([
    prisma.case.findMany({
      where: { ...scopeWhere, status: { not: STATUS.APPROVED } },
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
    }),
    showMonthly
      ? prisma.case.findMany({
          where: { ...scopeWhere, month },
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

      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">
          未結案件 <span className="text-blue-600">({unresolved.length})</span>
          <span className="text-xs text-slate-400 font-normal ml-2">
            {scopeName}．待審核／已駁回／已撤回
          </span>
        </h2>
        <SortableCaseTable rows={unresolved.map(toRow)} emptyText="沒有未結案件" />
      </section>

      {showMonthly && (
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
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
