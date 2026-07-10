"use client";

import { deleteUser } from "@/lib/admin-actions";

export default function DeleteUserButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <form
      action={deleteUser}
      onSubmit={(e) => {
        if (!confirm(`確定刪除人員「${name}」？此動作無法復原。`)) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-rose-600 hover:underline">刪除</button>
    </form>
  );
}
