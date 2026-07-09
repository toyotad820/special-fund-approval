"use client";

import { useActionState } from "react";
import { importUsers } from "@/lib/admin-actions";

export default function CsvImportForm() {
  const [state, formAction, pending] = useActionState(importUsers, {});

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-slate-500">
        CSV 表頭：<code>username,name,role,storeCode,deptCode,password</code>
        （角色可用代碼或中文；已存在的帳號會更新，密碼留空則預設 1234 / 更新時不變）
        {" "}
        <a
          href="/user-import-template.csv"
          className="text-blue-600 hover:underline"
        >
          下載範本
        </a>
      </p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-700 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
        >
          {pending ? "匯入中…" : "匯入"}
        </button>
      </div>
      {state.message && (
        <p
          className={`text-sm rounded-lg px-3 py-2 ${
            state.ok
              ? "text-emerald-700 bg-emerald-50"
              : "text-amber-700 bg-amber-50"
          }`}
        >
          {state.message}
        </p>
      )}
      {state.error && !state.message && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
