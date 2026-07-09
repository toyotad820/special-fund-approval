"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions";

type Option = { id: string; name: string };

export type CaseInitial = {
  plateName?: string;
  orderNo?: string;
  categoryId?: string;
  categoryNo?: string;
  carModel?: string;
  description?: string;
  subsidyDeptCourse?: number;
  goldMedal?: number;
  silverMedal?: number;
  discountTotal?: number;
  specialSubsidy?: number;
};

const AMOUNTS: { name: keyof CaseInitial; label: string; hint?: string }[] = [
  { name: "subsidyDeptCourse", label: "所課支援金" },
  { name: "goldMedal", label: "金牌" },
  { name: "silverMedal", label: "銀牌" },
  { name: "discountTotal", label: "折讓總額" },
  { name: "specialSubsidy", label: "特案支援金額", hint: "可為 0" },
];

export default function CaseForm({
  submitAction,
  categories,
  cars,
  month,
  storeCode,
  deptCode,
  initial,
  caseId,
  submitLabel = "送出",
}: {
  submitAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Option[];
  cars: Option[];
  month: string;
  storeCode: string;
  deptCode: string;
  initial?: CaseInitial;
  caseId?: string;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const fe = state.fieldErrors ?? {};

  const err = (n: string) =>
    fe[n] ? <p className="text-xs text-rose-600 mt-1">{fe[n]}</p> : null;

  const inputCls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form action={formAction} className="space-y-5">
      {caseId && <input type="hidden" name="caseId" value={caseId} />}

      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      {/* 自動帶入資訊 */}
      <div className="grid grid-cols-3 gap-3 text-sm bg-slate-50 rounded-lg p-3">
        <div>
          <div className="text-slate-400 text-xs">月份</div>
          <div className="font-medium">{month}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">所別</div>
          <div className="font-medium">{storeCode}</div>
        </div>
        <div>
          <div className="text-slate-400 text-xs">課別</div>
          <div className="font-medium">{deptCode || "-"}</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            領牌名稱 <span className="text-rose-500">*</span>
          </label>
          <input name="plateName" defaultValue={initial?.plateName} className={inputCls} />
          {err("plateName")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            訂單編號 <span className="text-rose-500">*</span>
          </label>
          <input
            name="orderNo"
            defaultValue={initial?.orderNo}
            placeholder="D + 12 碼，共 13 碼"
            maxLength={13}
            className={`${inputCls} font-mono uppercase`}
          />
          {err("orderNo")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            特案類別 <span className="text-rose-500">*</span>
          </label>
          <select
            name="categoryId"
            defaultValue={initial?.categoryId ?? ""}
            className={inputCls}
          >
            <option value="">請選擇</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {err("categoryId")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            類別編號 <span className="text-rose-500">*</span>
          </label>
          <input
            name="categoryNo"
            defaultValue={initial?.categoryNo}
            placeholder="D單位代號-課別-編號2碼"
            className={inputCls}
          />
          {err("categoryNo")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            車名 <span className="text-rose-500">*</span>
          </label>
          <select
            name="carModel"
            defaultValue={initial?.carModel ?? ""}
            className={inputCls}
          >
            <option value="">請選擇</option>
            {cars.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          {err("carModel")}
        </div>
      </div>

      {/* 金額 */}
      <div>
        <div className="text-sm font-medium text-slate-600 mb-2">
          金額（整數）
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {AMOUNTS.map((a) => (
            <div key={a.name}>
              <label className="block text-sm text-slate-600 mb-1">
                {a.label}
                {a.hint && (
                  <span className="text-xs text-slate-400 ml-1">（{a.hint}）</span>
                )}
              </label>
              <input
                name={a.name}
                type="number"
                min={0}
                step={1}
                defaultValue={initial?.[a.name] as number | undefined}
                className={inputCls}
              />
              {err(a.name)}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          特案內容說明 <span className="text-rose-500">*</span>
        </label>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          className={inputCls}
        />
        {err("description")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full sm:w-auto rounded-lg bg-blue-600 text-white px-6 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition"
      >
        {pending ? "處理中…" : submitLabel}
      </button>
    </form>
  );
}
