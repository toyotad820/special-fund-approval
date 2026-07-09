import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  canViewCase,
  canReview,
  canWithdraw,
  canResubmit,
  isOverdue,
} from "@/lib/dal";
import { withdrawCase } from "@/lib/actions";
import { ACTION_LABEL } from "@/lib/constants";
import { money, dt } from "@/lib/format";
import { StatusBadge } from "@/components/CaseList";
import ReviewPanel from "@/components/ReviewPanel";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 text-right">{children}</span>
    </div>
  );
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const c = await prisma.case.findUnique({
    where: { id },
    include: {
      category: true,
      submittedBy: true,
      logs: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!c || !canViewCase(user, c)) notFound();

  const overdue = isOverdue(c);
  const amounts = [
    ["所課支援金", c.subsidyDeptCourse],
    ["金牌", c.goldMedal],
    ["銀牌", c.silverMedal],
    ["折讓總額", c.discountTotal],
    ["特案支援金額", c.specialSubsidy],
  ] as const;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← 返回
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-slate-800">
              {c.orderNo}
            </span>
            {overdue && (
              <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-rose-100 text-rose-700">
                逾期
              </span>
            )}
          </div>
          <StatusBadge status={c.status} />
        </div>

        <Row label="月份">{c.month}</Row>
        <Row label="所別 / 課別">
          {c.storeCode} / {c.deptCode || "-"}
        </Row>
        <Row label="領牌名稱">{c.plateName}</Row>
        <Row label="特案類別">{c.category.name}</Row>
        <Row label="類別編號">{c.categoryNo}</Row>
        <Row label="車名">{c.carModel}</Row>
        {amounts.map(([label, val]) => (
          <Row key={label} label={label}>
            {money(val)}
          </Row>
        ))}
        <Row label="送單人">{c.submittedBy.name}</Row>
        <Row label="送出時間">{dt(c.submittedAt)}</Row>
        <div className="pt-3">
          <div className="text-sm text-slate-400 mb-1">特案內容說明</div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">
            {c.description}
          </p>
        </div>
      </div>

      {/* 審核區 */}
      {canReview(user, c) && <ReviewPanel caseId={c.id} />}

      {/* 撤回 */}
      {canWithdraw(user, c) && (
        <form action={withdrawCase} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">尚未審核，可撤回此單</span>
          <input type="hidden" name="caseId" value={c.id} />
          <button className="rounded-lg border border-slate-300 text-slate-600 px-4 py-2 text-sm hover:bg-slate-50">
            撤回
          </button>
        </form>
      )}

      {/* 駁回後重送 */}
      {canResubmit(user, c) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
          <span className="text-sm text-rose-600">已被駁回，可修改後重送</span>
          <Link
            href={`/cases/${c.id}/edit`}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            修改後重送
          </Link>
        </div>
      )}

      {/* 審核紀錄 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">審核紀錄</h2>
        <ol className="space-y-3">
          {c.logs.map((log) => (
            <li key={log.id} className="flex gap-3">
              <div className="w-1.5 rounded-full bg-slate-200 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-slate-800">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  <span className="text-slate-400"> · {log.reviewer.name}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {dt(log.createdAt)}
                </div>
                {log.comment && (
                  <div className="text-sm text-slate-600 mt-1 bg-slate-50 rounded-lg px-3 py-2">
                    {log.comment}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
