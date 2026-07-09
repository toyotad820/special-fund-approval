import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  reviewQueueWhere,
  visibilityWhere,
  canSubmit,
} from "@/lib/dal";
import { ROLE, ROLE_LABEL } from "@/lib/constants";
import CaseList from "@/components/CaseList";

const caseInclude = {
  category: { select: { name: true } },
  submittedBy: { select: { name: true } },
} as const;

function scopeLabel(role: string): string {
  if (role === ROLE.KEZHANG) return "本課案件";
  if (role === ROLE.SUOZHANG) return "本所案件";
  return "全部案件";
}

export default async function DashboardPage() {
  const user = await requireUser();

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
