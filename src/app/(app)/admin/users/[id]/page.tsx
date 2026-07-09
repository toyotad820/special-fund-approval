import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateUser } from "@/lib/admin-actions";
import UserForm from "@/components/admin/UserForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/users" className="text-sm text-blue-600 hover:underline">
        ← 返回人員清單
      </Link>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          編輯人員：{user.name}
        </h2>
        <UserForm
          submitAction={updateUser}
          isEdit
          initial={{
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            storeCode: user.storeCode,
            deptCode: user.deptCode,
            active: user.active,
          }}
        />
      </div>
    </div>
  );
}
