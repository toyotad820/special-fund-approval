"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/lib/actions";

const initial: ChangePasswordState = {};

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label">目前密碼</label>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          className="input"
        />
      </div>
      <div>
        <label className="label">新密碼</label>
        <input name="next" type="password" autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label">確認新密碼</label>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          className="input"
        />
      </div>

      {state.error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full py-3">
        {pending ? "更新中…" : "更新密碼"}
      </button>
    </form>
  );
}
