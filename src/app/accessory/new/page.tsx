import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canSubmitAccessory } from "@/lib/dal";
import AccessoryForm from "@/components/AccessoryForm";

export default async function NewAccessoryPage() {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) redirect("/accessory");

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/accessory" className="text-sm text-blue-600 hover:underline">
        ← 回申請首頁
      </Link>
      <h1 className="text-lg font-bold text-slate-800">新增配件變更申請</h1>
      <p className="text-sm text-slate-500">
        上傳 OPT 委託安裝工單圖片，按「辨識圖片」自動填入欄位，核對後送出。
      </p>
      <AccessoryForm />
    </div>
  );
}
