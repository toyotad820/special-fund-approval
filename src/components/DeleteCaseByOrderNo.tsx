"use client";

import { useState } from "react";
import { useActionState } from "react";
import { lookupCaseForDelete, deleteCaseAnytime, type CaseLookupState } from "@/lib/actions";
import { STATUS_LABEL } from "@/lib/constants";
import { money } from "@/lib/format";

const initialState: CaseLookupState = {};

export default function DeleteCaseByOrderNo() {
  const [state, lookupAction, pending] = useActionState(lookupCaseForDelete, initialState);
  const c = state.case;
  // 「關閉」只收起這次查詢的結果；每次送出新查詢（即使查同一張單）都要重新顯示，
  // 所以用 state 物件參照本身判斷是否為新一次查詢，而不是用案件 id（同一張單再查一次 id 不會變）
  const [seenState, setSeenState] = useState(state);
  const [closed, setClosed] = useState(false);
  if (state !== seenState) {
    setSeenState(state);
    setClosed(false);
  }
  const showResult = c && !closed;

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">刪除案件</h2>
      <p className="text-xs text-slate-400 mb-3">
        輸入自己送出、且案件月份仍在本月的訂單編號即可刪除，不限審核狀態。
      </p>

      <form action={lookupAction} className="flex gap-2">
        <input
          name="orderNo"
          placeholder="訂單編號（13 碼）"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-300 text-slate-600 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          查詢
        </button>
      </form>

      {state.error && (
        <p className="text-sm text-rose-600 mt-3">{state.error}</p>
      )}

      {showResult && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm text-slate-800">{c.orderNo}</span>
            <span className="text-xs text-slate-500">{STATUS_LABEL[c.status] ?? c.status}</span>
          </div>
          <div className="text-sm text-slate-600">
            {c.month} · {c.plateName} · {c.carModel}
          </div>
          <div className="text-sm text-slate-600">特案支援金額：{money(c.specialSubsidy)}</div>

          <form
            className="flex gap-2 pt-2"
            onSubmit={(e) => {
              if (!confirm(`確定刪除案件 ${c.orderNo}？刪除後無法復原。`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="caseId" value={c.id} />
            <button
              type="button"
              onClick={() => setClosed(true)}
              className="flex-1 rounded-lg border border-slate-300 text-slate-600 py-2 text-sm hover:bg-slate-50"
            >
              關閉
            </button>
            <button
              type="submit"
              formAction={deleteCaseAnytime}
              className="flex-1 rounded-lg border border-rose-300 text-rose-600 py-2 text-sm hover:bg-rose-50"
            >
              刪除
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
