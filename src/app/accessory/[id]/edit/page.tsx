import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canResubmitAccessory, getDeptCodesForStore } from "@/lib/dal";
import AccessoryForm, { type AccessoryInitial } from "@/components/AccessoryForm";

export default async function EditAccessoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const r = await prisma.accessoryRequest.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!r || !canResubmitAccessory(user, r)) notFound();

  // 課長自動帶出課別；所長需下拉選（只列本所的課別，不是全系統）
  const isKezhang = user.role === "KEZHANG";
  const deptOptions = isKezhang
    ? []
    : (await getDeptCodesForStore(user.storeCode)).map((code) => ({
        code,
        label: `${code}課`,
      }));

  const initial: AccessoryInitial = {
    id: r.id,
    fields: {
      dataNo: r.dataNo,
      storeCode: r.storeCode,
      salesName: r.salesName,
      customerName: r.customerName,
      carModel: r.carModel,
      deptCode: r.deptCode || "",
      accessoryNameQty: r.accessoryNameQty,
      accessoryBefore: r.accessoryBefore,
      accessoryAfter: r.accessoryAfter,
      changeDescription: r.changeDescription,
    },
    images: r.images
      .filter((img) => img.imageData)
      .map((img, i) => ({
        data: img.imageData as string,
        mimeType: img.mimeType,
        ocrRaw: img.ocrRaw ?? undefined,
        name: `工單圖片 ${i + 1}`,
      })),
    userRole: user.role,
    userDeptCode: user.deptCode,
    deptOptions,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link href={`/accessory/${id}`} className="text-sm text-blue-600 hover:underline">
        ← 回案件明細
      </Link>
      <h1 className="text-lg font-bold text-slate-800">編輯後重送</h1>
      <p className="text-sm text-slate-500">
        修改欄位或工單圖片後按「重新送出」，案件將重新送交部長審核。
      </p>
      <AccessoryForm initial={initial} />
    </div>
  );
}
