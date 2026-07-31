"use client";

import { useActionState, useRef, useState } from "react";
import { reviewCase } from "@/lib/actions";

// 常用審核意見片語，之後要調整內容直接改這個陣列就好
const QUICK_PHRASES: string[] = [];

export default function ReviewPanel({ caseId }: { caseId: string }) {
  const [state, formAction, pending] = useActionState(reviewCase, {});
  const commentErr = state.fieldErrors?.comment;
  const formRef = useRef<HTMLFormElement>(null);
  const decisionRef = useRef<HTMLInputElement>(null);
  const [confirmDecision, setConfirmDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [comment, setComment] = useState("");

  const insertPhrase = (phrase: string) => {
    setComment((prev) => (prev ? `${prev}\n${phrase}` : phrase));
  };

  const doConfirm = () => {
    if (decisionRef.current) decisionRef.current.value = confirmDecision ?? "";
    setConfirmDecision(null);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
      >
        <input type="hidden" name="caseId" value={caseId} />
        <input ref={decisionRef} type="hidden" name="decision" />
        <h2 className="text-sm font-semibold text-slate-700">審核</h2>

        {state.error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div>
          <label className="block text-sm text-slate-600 mb-1">
            審核意見 / 駁回原因
          </label>
          {QUICK_PHRASES.length > 0 && (
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
          )}
          <textarea
            name="comment"
            rows={3}
            placeholder="駁回時必填"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {commentErr && (
            <p className="text-xs text-rose-600 mt-1">{commentErr}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmDecision("APPROVE")}
            disabled={pending}
            className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            核准
          </button>
          <button
            type="button"
            onClick={() => setConfirmDecision("REJECT")}
            disabled={pending}
            className="flex-1 rounded-lg bg-rose-600 text-white py-2.5 font-medium hover:bg-rose-700 disabled:opacity-60"
          >
            駁回
          </button>
        </div>
      </form>

      {confirmDecision && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDecision(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-slate-800 font-medium">
              確定要{confirmDecision === "REJECT" ? "駁回" : "核准"}這筆案件嗎？
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDecision(null)}
                className="rounded-lg border border-slate-300 text-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={doConfirm}
                className={`rounded-lg text-white px-4 py-2 text-sm font-medium ${
                  confirmDecision === "REJECT"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
