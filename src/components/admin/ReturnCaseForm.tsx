"use client";

import { useActionState, useRef, useState } from "react";
import { returnCase } from "@/lib/admin-actions";

export default function ReturnCaseForm({ orderNo }: { orderNo: string }) {
  const [state, formAction, pending] = useActionState(returnCase, {});
  const commentErr = state.fieldErrors?.comment;
  const formRef = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
      >
        <input type="hidden" name="orderNo" value={orderNo} />
        <h2 className="text-sm font-semibold text-slate-700">退回申請者</h2>

        {state.error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state.ok && state.message && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            {state.message}
          </p>
        )}

        <div>
          <label className="block text-sm text-slate-600 mb-1">退回原因</label>
          <textarea
            name="comment"
            rows={3}
            placeholder="必填，將顯示給申請者"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {commentErr && <p className="text-xs text-rose-600 mt-1">{commentErr}</p>}
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          className="w-full rounded-lg bg-rose-600 text-white py-2.5 font-medium hover:bg-rose-700 disabled:opacity-60"
        >
          退回此案件
        </button>
      </form>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-800 font-medium">
              確定要將訂單 {orderNo} 強制退回申請者嗎？此動作會將案件狀態改為已駁回，需由申請者修改後重送。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-slate-300 text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  formRef.current?.requestSubmit();
                }}
                className="rounded-lg text-white px-4 py-2 text-sm font-medium bg-rose-600 hover:bg-rose-700"
              >
                確定退回
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
