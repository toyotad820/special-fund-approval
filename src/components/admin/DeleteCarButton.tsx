"use client";

import { deleteCar } from "@/lib/admin-actions";

export default function DeleteCarButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCar}
      onSubmit={(e) => {
        if (!confirm(`確定刪除車種「${name}」？此動作無法復原。`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-rose-600 hover:underline">刪除</button>
    </form>
  );
}
