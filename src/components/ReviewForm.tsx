"use client";

import { approveAccessory, rejectAccessory } from "@/lib/accessory-actions";
import { useRef } from "react";

export default function ReviewForm({ requestId }: { requestId: string }) {
  const remarkRef = useRef<HTMLTextAreaElement>(null);

  const handleApprove = async () => {
    const fd = new FormData();
    fd.set("id", requestId);
    fd.set("remark", remarkRef.current?.value ?? "");
    await approveAccessory({} as any, fd);
  };

  const handleReject = async () => {
    const fd = new FormData();
    fd.set("id", requestId);
    fd.set("remark", remarkRef.current?.value ?? "");
    await rejectAccessory({} as any, fd);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          批示結果 <span className="text-slate-400">（選填）</span>
        </label>
        <textarea
          ref={remarkRef}
          placeholder="核准或駁回時可填寫批示結果"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          className="flex-1 rounded-lg bg-green-600 text-white py-2.5 font-medium hover:bg-green-700 transition-colors"
        >
          ✓ 核准
        </button>
        <button
          onClick={handleReject}
          className="flex-1 rounded-lg bg-rose-600 text-white py-2.5 font-medium hover:bg-rose-700 transition-colors"
        >
          ✕ 駁回
        </button>
      </div>
    </div>
  );
}
