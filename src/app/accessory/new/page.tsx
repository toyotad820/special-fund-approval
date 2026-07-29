import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canSubmitAccessory } from "@/lib/dal";
import AccessoryForm from "@/components/AccessoryForm";

export default async function NewAccessoryPage() {
  const user = await requireUser();
  if (!canSubmitAccessory(user)) redirect("/accessory");

  // 課長自動帶出課別；所長需下拉選
  const isKezhang = user.role === "KEZHANG";
  const deptOptions = !isKezhang
    ? (
        await prisma.unitTarget.findMany({
          where: { deptCode: { not: "0" } },
          select: { deptCode: true },
          distinct: ["deptCode"],
        })
      )
        .map((t) => ({ code: t.deptCode, label: `${t.deptCode}課` }))
        .sort((a, b) => a.code.localeCompare(b.code))
    : [];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href="/accessory" className="text-sm text-blue-600 hover:underline">
        ← 回申請首頁
      </Link>
      <h1 className="text-lg font-bold text-slate-800">新增配件變更申請</h1>
      <p className="text-sm text-slate-500">
        上傳 OPT 委託安裝工單圖片，按「辨識圖片」自動填入欄位，核對後送出。
      </p>
      <AccessoryForm
        initial={{
          id: "",
          fields: {
            dataNo: "",
            storeCode: "",
            salesName: "",
            customerName: "",
            carModel: "",
            deptCode: isKezhang ? user.deptCode || "" : "",
            accessoryBefore: "",
            accessoryAfter: "",
            changeDescription: "",
          },
          images: [],
          userRole: user.role,
          userDeptCode: user.deptCode,
          deptOptions,
        }}
      />
    </div>
  );
}
