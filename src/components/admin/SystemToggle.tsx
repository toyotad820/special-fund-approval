"use client";

import { useState, useTransition } from "react";
import { toggleUserSystem } from "@/lib/admin-actions";

export default function SystemToggle({
  userId,
  system,
  initialChecked,
}: {
  userId: string;
  system: string;
  initialChecked: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    const next = !checked;
    setChecked(next); // 樂觀更新
    startTransition(async () => {
      try {
        await toggleUserSystem(userId, system, next);
      } catch {
        setChecked(!next); // 失敗還原
      }
    });
  };

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      onChange={onToggle}
      className="w-4 h-4 rounded accent-blue-600 disabled:opacity-50 cursor-pointer"
    />
  );
}
