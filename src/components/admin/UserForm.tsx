"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/admin-actions";
import { ROLE_LABEL, SYSTEM, SYSTEM_LABEL } from "@/lib/constants";

type Initial = {
  id?: string;
  username?: string;
  name?: string;
  role?: string;
  storeCode?: string;
  deptCode?: string | null;
  systems?: string;
  assignedStores?: string;
  active?: boolean;
};

const ROLES = ["KEZHANG", "SUOZHANG", "BUZHUGUAN", "STAFF", "PEIJIAN"];

export default function UserForm({
  submitAction,
  initial,
  isEdit = false,
  storeList = [],
}: {
  submitAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: Initial;
  isEdit?: boolean;
  storeList?: string[];
}) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [systems, setSystems] = useState<string[]>(
    initial?.systems ? initial.systems.split(",").filter(Boolean) : ["fund"]
  );
  const [role, setRole] = useState<string>(initial?.role ?? "");
  const [assignedStores, setAssignedStores] = useState<string[]>(
    initial?.assignedStores
      ? initial.assignedStores.split(",").map((s) => s.trim()).filter(Boolean)
      : []
  );
  const fe = state.fieldErrors ?? {};
  const err = (n: string) =>
    fe[n] ? <p className="text-xs text-rose-600 mt-1">{fe[n]}</p> : null;
  const cls =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500";

  const handleFormAction = (fd: FormData) => {
    fd.set("systems", systems.join(","));
    fd.set("assignedStores", assignedStores.join(","));
    return formAction(fd);
  };

  return (
    <form action={handleFormAction} className="space-y-4">
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
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={cls}
          >
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
            {isEdit ? "重設密碼（留空恢復預設 1234）" : "密碼（留空預設 1234）"}
          </label>
          <input name="password" type="password" autoComplete="new-password" className={cls} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-600">
          可使用系統 <span className="text-rose-500">*</span>
        </legend>
        <div className="space-y-2">
          {[SYSTEM.FUND, SYSTEM.CAR_SPEC_CHANGE].map((sys) => (
            <label key={sys} className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={systems.includes(sys)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSystems([...systems, sys]);
                  } else {
                    setSystems(systems.filter((s) => s !== sys));
                  }
                }}
                className="rounded"
              />
              {SYSTEM_LABEL[sys] ?? sys}
            </label>
          ))}
        </div>
      </fieldset>

      {role === "PEIJIAN" && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-600">
            負責所別（配件中心）
          </legend>
          <p className="text-xs text-slate-400">
            不勾選＝負責全部所別；勾選後只看到/確認所選所別的案件。
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {storeList.map((sc) => (
              <label
                key={sc}
                className="flex items-center gap-1.5 text-sm text-slate-600"
              >
                <input
                  type="checkbox"
                  checked={assignedStores.includes(sc)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setAssignedStores([...assignedStores, sc]);
                    } else {
                      setAssignedStores(assignedStores.filter((s) => s !== sc));
                    }
                  }}
                  className="rounded"
                />
                {sc}
              </label>
            ))}
          </div>
        </fieldset>
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
