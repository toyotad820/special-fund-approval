import Link from "next/link";
import { requireUser } from "@/lib/session";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  await requireUser();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-bold text-slate-800 mb-4">變更密碼</h1>

        <div className="card p-7">
          <ChangePasswordForm />
        </div>

        <Link
          href="/portal"
          className="block text-center text-sm text-blue-600 hover:underline mt-4"
        >
          ← 回系統選單
        </Link>
      </div>
    </div>
  );
}
