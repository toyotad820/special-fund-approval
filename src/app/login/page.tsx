"use client";

import { useActionState } from "react";
import { login, type ActionState } from "@/lib/actions";

const initial: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-7">
        <h1 className="text-xl font-bold text-slate-800">特案支援金報備系統</h1>
        <p className="text-sm text-slate-500 mt-1 mb-6">請登入</p>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              帳號
            </label>
            <input
              name="username"
              autoComplete="username"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              密碼
            </label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {state.error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition"
          >
            {pending ? "登入中…" : "登入"}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-6 leading-relaxed">
          雛型測試帳號（密碼皆 1234）：<br />
          boss（部主管）、s01（所長）、k01a（課長）
        </p>
      </div>
    </div>
  );
}
