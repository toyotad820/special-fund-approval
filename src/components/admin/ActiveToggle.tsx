"use client";

import { useState, useTransition } from "react";
import { toggleUserActive } from "@/lib/admin-actions";

export default function ActiveToggle({
  userId,
  initialActive,
}: {
  userId: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  const onToggle = () => {
    const next = !active;
    setActive(next); // 樂觀更新
    startTransition(async () => {
      try {
        await toggleUserActive(userId, next);
      } catch {
        setActive(!next); // 失敗還原
      }
    });
  };

  return (
    <input
      type="checkbox"
      checked={active}
      disabled={pending}
      onChange={onToggle}
      className="w-4 h-4 rounded accent-emerald-600 disabled:opacity-50 cursor-pointer"
    />
  );
}
