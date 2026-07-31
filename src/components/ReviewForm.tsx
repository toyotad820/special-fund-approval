"use client";

import { useState } from "react";
import { approveAccessory, rejectAccessory } from "@/lib/accessory-actions";

// 常用批示片語，之後要調整內容直接改這個陣列就好
const QUICK_PHRASES = ["數量不可複數", "配件不可不裝", "套件變更比例過高", "說明不清"];

export default function ReviewForm({ requestId }: { requestId: string }) {
  const [remark, setRemark] = useState("");

  const insertPhrase = (phrase: string) => {
    setRemark((prev) => (prev ? `${prev}\n${phrase}` : phrase));
  };

  return (
    <form className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
      <input type="hidden" name="id" value={requestId} />
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          批示結果 <span className="text-slate-400">（選填）</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => insertPhrase(phrase)}
              className="text-xs rounded-full border border-slate-300 text-slate-600 px-2.5 py-1 hover:bg-slate-100 transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>
        <textarea
          name="remark"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="核准或駁回時可填寫批示結果"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          formAction={approveAccessory}
          className="flex-1 rounded-lg bg-green-600 text-white py-4 text-base font-medium hover:bg-green-700 transition-colors"
        >
          ✓ 核准
        </button>
        <button
          type="submit"
          formAction={rejectAccessory}
          className="flex-1 rounded-lg bg-rose-600 text-white py-4 text-base font-medium hover:bg-rose-700 transition-colors"
        >
          ✕ 駁回
        </button>
      </div>
    </form>
  );
}
