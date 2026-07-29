import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";

const COLUMNS: SortCol[] = [
  { key: "storeCode", label: "所別" },
  { key: "salesName", label: "業務姓名" },
  { key: "customerName", label: "客戶", kind: "link", width: "6rem" },
  { key: "carModel", label: "車名" },
  { key: "changeDescription", label: "更換說明", grow: true },
  { key: "submittedAt", label: "核准時間", kind: "date" },
];

export default async function AccessoryConfirmPage() {
  const user = await requireUser();
  // 只有配件中心可以確認
  if (user.role !== ROLE.PEIJIAN) notFound();

  // 負責所別過濾（空=全部）
  const stores = (user.assignedStores ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const requests = await prisma.accessoryRequest.findMany({
    where: {
      status: ACC_STATUS.APPROVED,
      ...(stores.length > 0 ? { storeCode: { in: stores } } : {}),
    },
    include: { submittedBy: true },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">待確認案件</h1>
        <Link href="/accessory" className="text-sm text-blue-600 hover:underline">
          回申請首頁
        </Link>
      </div>

      <SortableTable
        columns={COLUMNS}
        rows={requests.map(
          (r): SortRow => ({
            href: `/accessory/confirm/${r.id}`,
            dataNo: r.dataNo,
            storeCode: r.storeCode,
            salesName: r.salesName,
            customerName: r.customerName,
            carModel: r.carModel,
            changeDescription: r.changeDescription,
            submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          })
        )}
        emptyText="目前沒有待確認案件"
        minWidth={720}
      />
    </div>
  );
}
