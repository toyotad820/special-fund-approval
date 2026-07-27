"use client";

import { useRef } from "react";
import { rejectAccessory } from "@/lib/accessory-actions";

export default function RejectForm({ requestId }: { requestId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex-1 rounded-lg bg-rose-600 text-white py-2.5 font-medium hover:bg-rose-700 transition-colors"
      >
        ✕ 駁回
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-2xl border border-slate-200 p-5 w-full max-w-2xl backdrop:bg-black/50"
      >
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">駁回案件</h3>
          <form
            action={rejectAccessory}
            className="space-y-3"
            onSubmit={() => dialogRef.current?.close()}
          >
            <input type="hidden" name="id" value={requestId} />
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                駁回原因 <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="reason"
                placeholder="請說明駁回原因"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
                required
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-lg border border-slate-300 text-slate-600 px-4 py-2 font-medium hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="rounded-lg bg-rose-600 text-white px-4 py-2 font-medium hover:bg-rose-700"
              >
                確認駁回
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
