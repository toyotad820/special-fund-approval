"use client";

import { useActionState, useRef, useState } from "react";
import { importUnitTargets } from "@/lib/admin-actions";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function TargetImportForm() {
  const [state, formAction, pending] = useActionState(importUnitTargets, {});
  const [fileName, setFileName] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-slate-500">
        表頭：<code>storeCode,deptCode,weight,targetCount</code>
        （<code>deptCode</code> 所層級填 <code>0</code>、課別填 1/2/3…，各佔一列，
        所目標是獨立數值、不會用課加總算出來；<strong>整批覆蓋</strong>
        ——上傳成功後，該月舊資料會整批清掉、以這份檔案為準重建）
        {" "}
        <a href="/unit-target-template.csv" className="text-blue-600 hover:underline">
          下載範本
        </a>
      </p>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        月份
        <input
          type="month"
          name="month"
          defaultValue={currentMonth()}
          required
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>

      <label
        htmlFor="target-csv-file"
        className="flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors text-center"
      >
        <input
          id="target-csv-file"
          ref={inputRef}
          type="file"
          name="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
        <svg
          className="w-8 h-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 7.5 7.5 12M12 7.5V21"
          />
        </svg>
        {fileName ? (
          <span className="text-sm font-medium text-slate-700">{fileName}</span>
        ) : (
          <span className="text-sm text-slate-500">
            點擊選擇 CSV 檔（或拖曳至此）
          </span>
        )}
        <span className="text-xs text-blue-600 font-medium">選擇檔案</span>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !fileName}
          className="btn btn-primary disabled:opacity-50"
        >
          {pending ? "匯入中…" : "開始匯入"}
        </button>
        {fileName && (
          <button
            type="button"
            onClick={() => {
              setFileName("");
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            清除
          </button>
        )}
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
