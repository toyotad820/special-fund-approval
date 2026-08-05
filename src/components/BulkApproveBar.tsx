"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkApproveCases } from "@/lib/actions";

export default function BulkApproveBar({
  selectedIds,
  onDone,
}: {
  selectedIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(bulkApproveCases, {});
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      onDone();
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // 送出後才關閉確認視窗；不能在 submit 按鈕的 onClick 裡關閉，
  // 否則 modal／form 會在瀏覽器觸發原生 submit 前就被卸載，導致送出失效
  useEffect(() => {
    if (pending) setConfirmOpen(false);
  }, [pending]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2.5">
      <span className="text-sm font-medium text-blue-800">已選 {selectedIds.length} 筆</span>

      {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
      {state.ok && state.message && <span className="text-xs text-emerald-700">{state.message}</span>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-slate-300 text-slate-600 px-3 py-1.5 text-sm hover:bg-white"
        >
          清除選取
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
        >
          整批核准
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmOpen(false)}
        >
          <form
            action={formAction}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4"
          >
            {selectedIds.map((id) => (
              <input key={id} type="hidden" name="caseIds" value={id} />
            ))}
            <p className="text-slate-800 font-medium">
              確定要核准這 {selectedIds.length} 筆案件嗎？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-slate-300 text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg text-white px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700"
              >
                確定
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
