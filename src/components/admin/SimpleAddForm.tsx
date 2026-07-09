"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/admin-actions";

export default function SimpleAddForm({
  submitAction,
  fieldName,
  placeholder,
  buttonLabel = "新增",
}: {
  submitAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fieldName: string;
  placeholder: string;
  buttonLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const fieldErr = state.fieldErrors?.[fieldName];

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div>
        <input
          name={fieldName}
          placeholder={placeholder}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {fieldErr && <p className="text-xs text-rose-600 mt-1">{fieldErr}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "…" : buttonLabel}
      </button>
    </form>
  );
}
