import Link from "next/link";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";
import { isOverdue } from "@/lib/dal";
import { money, dt } from "@/lib/format";

export type CaseRow = {
  id: string;
  orderNo: string;
  carModel: string;
  plateName: string;
  status: string;
  stepEnteredAt: Date;
  submittedAt: Date;
  specialSubsidy: number;
  storeCode: string;
  deptCode: string;
  category: { name: string };
  submittedBy: { name: string };
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function CaseList({ cases }: { cases: CaseRow[] }) {
  if (cases.length === 0) {
    return (
      <p className="text-sm text-slate-400 py-6 text-center">目前沒有案件</p>
    );
  }

  return (
    <ul className="space-y-2">
      {cases.map((c) => {
        const overdue = isOverdue(c);
        return (
          <li key={c.id}>
            <Link
              href={`/cases/${c.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-sm font-medium text-slate-800 truncate">
                    {c.orderNo}
                  </span>
                  {overdue && (
                    <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-rose-100 text-rose-700 whitespace-nowrap">
                      逾期
                    </span>
                  )}
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-sm text-slate-500">
                <span className="truncate">
                  {c.storeCode} · {c.category.name} · {c.carModel}
                </span>
                <span className="whitespace-nowrap font-medium text-slate-700">
                  特案 {money(c.specialSubsidy)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="truncate">送單：{c.submittedBy.name}</span>
                <span className="whitespace-nowrap">{dt(c.submittedAt)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
