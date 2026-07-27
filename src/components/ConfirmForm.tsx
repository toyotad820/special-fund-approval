"use client";

import { confirmAccessory, returnAccessory } from "@/lib/accessory-actions";

export default function ConfirmForm({ requestId }: { requestId: string }) {
  return (
    <form className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <input type="hidden" name="id" value={requestId} />
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          確認備註 <span className="text-slate-400">（選填）</span>
        </label>
        <textarea
          name="remark"
          placeholder="確認或退回重審時可填寫備註"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          formAction={confirmAccessory}
          className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 transition-colors"
        >
          ✓ 確認結案
        </button>
        <button
          type="submit"
          formAction={returnAccessory}
          className="flex-1 rounded-lg bg-amber-600 text-white py-2.5 font-medium hover:bg-amber-700 transition-colors"
        >
          ↩ 退回重審
        </button>
      </div>
    </form>
  );
}
