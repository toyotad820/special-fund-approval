import Link from "next/link";
import bcrypt from "bcryptjs";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateUser } from "@/lib/admin-actions";
import { listStoreCodes } from "@/lib/dal";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import UserForm from "@/components/admin/UserForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();
  const storeList = await listStoreCodes();
  // 只比對雜湊是否等於系統預設密碼，不存明碼、也不顯示密碼本身，
  // 純粹用來提醒管理員「這個人可能還沒換過預設密碼」
  const isDefaultPassword = await bcrypt.compare(DEFAULT_PASSWORD, user.passwordHash);

  return (
    <div className="space-y-4">
      <Link href="/users" className="text-sm text-blue-600 hover:underline">
        ← 返回人員清單
      </Link>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          編輯人員：{user.name}
        </h2>
        <UserForm
          submitAction={updateUser}
          isEdit
          isDefaultPassword={isDefaultPassword}
          storeList={storeList}
          initial={{
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            storeCode: user.storeCode,
            deptCode: user.deptCode,
            active: user.active,
            systems: user.systems,
            assignedStores: user.assignedStores,
          }}
        />
      </div>
    </div>
  );
}
