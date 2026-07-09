"use client";

import { useActionState } from "react";
import { reviewCase } from "@/lib/actions";

export default function ReviewPanel({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(reviewCase, {});
  const commentErr = state.fieldErrors?.comment;

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
    >
      <input type="hidden" name="caseId" value={caseId} />
      <h2 className="text-sm font-semibold text-slate-700">審核</h2>

      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div>
        <label className="block text-sm text-slate-600 mb-1">
          審核意見 / 駁回原因
        </label>
        <textarea
          name="comment"
          rows={3}
          placeholder="駁回時必填"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {commentErr && (
          <p className="text-xs text-rose-600 mt-1">{commentErr}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          name="decision"
          value="APPROVE"
          disabled={pending}
          className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          核准
        </button>
        <button
          type="submit"
          name="decision"
          value="REJECT"
          disabled={pending}
          className="flex-1 rounded-lg bg-rose-600 text-white py-2.5 font-medium hover:bg-rose-700 disabled:opacity-60"
        >
          駁回
        </button>
      </div>
    </form>
  );
}
