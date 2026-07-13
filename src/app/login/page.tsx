"use client";

import { useActionState } from "react";
import { login, type ActionState } from "@/lib/actions";
import { APP_VERSION } from "@/lib/version";
import BrandMark from "@/components/BrandMark";

const initial: ActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initial);

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <BrandMark size="lg" showTitle={false} />
          <h1 className="text-xl font-bold text-slate-800 mt-3">
            特案支援金報備系統
          </h1>
          <p className="text-sm text-slate-500 mt-1">請登入以繼續</p>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 mt-2">
            v{APP_VERSION}
          </span>
        </div>

        <div className="card p-7 border-t-2 border-t-[#EB0A1E]/70">
          <form action={formAction} className="space-y-4">
            <div>
              <label className="label">帳號</label>
              <input name="username" autoComplete="username" className="input" />
            </div>
            <div>
              <label className="label">密碼</label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                className="input"
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
              className="btn btn-primary w-full py-3"
            >
              {pending ? "登入中…" : "登入"}
            </button>
          </form>
        </div>

        <p className="text-xs text-slate-400 mt-5 text-center leading-relaxed">
          雛型測試帳號（密碼皆 1234）<br />
          boss（部長）· s01（所長）· k01a（課長）
        </p>
      </div>
    </div>
  );
}
