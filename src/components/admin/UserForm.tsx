"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/admin-actions";
import { ROLE_LABEL } from "@/lib/constants";

type Initial = {
  id?: string;
  username?: string;
  name?: string;
  role?: string;
  storeCode?: string;
  deptCode?: string | null;
  active?: boolean;
};

const ROLES = ["KEZHANG", "SUOZHANG", "BUZHUGUAN", "STAFF"];

export default function UserForm({
  submitAction,
  initial,
  isEdit = false,
}: {
  submitAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: Initial;
  isEdit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const fe = state.fieldErrors ?? {};
  const err = (n: string) =>
    fe[n] ? <p className="text-xs text-rose-600 mt-1">{fe[n]}</p> : null;
  const cls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form action={formAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={initial?.id} />}
      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            帳號 <span className="text-rose-500">*</span>
          </label>
          {isEdit ? (
            <input
              value={initial?.username}
              disabled
              className={`${cls} bg-slate-100 text-slate-500`}
            />
          ) : (
            <input name="username" className={cls} />
          )}
          {err("username")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            姓名 <span className="text-rose-500">*</span>
          </label>
          <input name="name" defaultValue={initial?.name} className={cls} />
          {err("name")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            角色 <span className="text-rose-500">*</span>
          </label>
          <select name="role" defaultValue={initial?.role ?? ""} className={cls}>
            <option value="">請選擇</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {err("role")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            所別 <span className="text-rose-500">*</span>
          </label>
          <input
            name="storeCode"
            defaultValue={initial?.storeCode}
            placeholder="如 D01 / HQ"
            className={cls}
          />
          {err("storeCode")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            課別
          </label>
          <input
            name="deptCode"
            defaultValue={initial?.deptCode ?? ""}
            placeholder="課長需填，如 01"
            className={cls}
          />
          {err("deptCode")}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            {isEdit ? "重設密碼（留空不變）" : "密碼（留空預設 1234）"}
          </label>
          <input name="password" type="text" className={cls} />
        </div>
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial?.active}
            className="rounded"
          />
          啟用中（取消勾選＝停用，無法登入）
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 text-white px-6 py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "儲存中…" : isEdit ? "儲存變更" : "新增人員"}
      </button>
    </form>
  );
}
