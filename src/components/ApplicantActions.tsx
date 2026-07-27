"use client";

import Link from "next/link";
import { withdrawAccessory } from "@/lib/accessory-actions";

export default function ApplicantActions({
  requestId,
  canWithdraw,
  canResubmit,
}: {
  requestId: string;
  canWithdraw: boolean;
  canResubmit: boolean;
}) {
  if (!canWithdraw && !canResubmit) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap gap-3">
      {canResubmit && (
        <Link
          href={`/accessory/${requestId}/edit`}
          className="flex-1 min-w-[140px] text-center rounded-lg bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 transition-colors"
        >
          編輯後重送
        </Link>
      )}
      {canWithdraw && (
        <form
          className="flex-1 min-w-[140px]"
          onSubmit={(e) => {
            if (!confirm("確定撤回此申請？撤回後可再編輯重送。")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={requestId} />
          <button
            type="submit"
            formAction={withdrawAccessory}
            className="w-full rounded-lg border border-rose-300 text-rose-600 py-2.5 font-medium hover:bg-rose-50 transition-colors"
          >
            撤回申請
          </button>
        </form>
      )}
    </div>
  );
}
