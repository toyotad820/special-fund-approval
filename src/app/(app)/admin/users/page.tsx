import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/admin-actions";
import { ROLE_LABEL } from "@/lib/constants";
import UserForm from "@/components/admin/UserForm";
import CsvImportForm from "@/components/admin/CsvImportForm";
import DeleteUserButton from "@/components/admin/DeleteUserButton";

const ERR_MSG: Record<string, string> = {
  self: "不可刪除目前登入的帳號。",
  inuse: "此人員已有案件或審核紀錄，無法刪除，請改為「停用」（進入編輯取消勾選啟用）。",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { err } = await searchParams;
  const users = await prisma.user.findMany({
    orderBy: [{ storeCode: "asc" }, { role: "asc" }, { username: "asc" }],
  });

  const th = "text-left text-xs font-semibold text-slate-500 px-3 py-2";
  const td = "px-3 py-2 text-sm text-slate-800";

  return (
    <div className="space-y-6">
      {err && ERR_MSG[err] && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {ERR_MSG[err]}
        </p>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">CSV 匯入人員</h2>
        <CsvImportForm />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">新增人員</h2>
        <UserForm submitAction={createUser} />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-slate-700 px-4 pt-4">
          人員清單（{users.length}）
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full mt-2 min-w-[600px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>帳號</th>
                <th className={th}>姓名</th>
                <th className={th}>角色</th>
                <th className={th}>所別/課別</th>
                <th className={th}>狀態</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className={`${td} font-mono`}>{u.username}</td>
                  <td className={td}>{u.name}</td>
                  <td className={td}>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td className={td}>
                    {u.storeCode}
                    {u.deptCode ? ` / ${u.deptCode}` : ""}
                  </td>
                  <td className={td}>
                    {u.active ? (
                      <span className="text-emerald-600">啟用</span>
                    ) : (
                      <span className="text-slate-400">停用</span>
                    )}
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        編輯
                      </Link>
                      <DeleteUserButton id={u.id} name={u.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
