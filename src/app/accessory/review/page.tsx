import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import { type SortCol, type SortRow } from "@/components/SortableTable";
import AccessoryReviewTable from "@/components/AccessoryReviewTable";

const COLUMNS: SortCol[] = [
  { key: "storeCode", label: "所別" },
  { key: "salesName", label: "員編/姓名" },
  { key: "customerName", label: "客戶", kind: "link", width: "6rem" },
  { key: "carModel", label: "車名" },
  { key: "changeDescription", label: "更換說明", width: "320px" },
  { key: "warningText", label: "系統警示", kind: "warn", grow: true },
];

export default async function AccessoryReviewPage() {
  const user = await requireUser();
  // 只有部長可以審核
  if (user.role !== ROLE.BUZHUGUAN) notFound();

  const requests = await prisma.accessoryRequest.findMany({
    where: { status: ACC_STATUS.PENDING_REVIEW },
    include: { submittedBy: { select: { name: true } } },
    orderBy: { submittedAt: "desc" },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">待審核案件</h1>
        <Link href="/accessory" className="text-sm text-blue-600 hover:underline">
          回申請首頁
        </Link>
      </div>

      <AccessoryReviewTable
        columns={COLUMNS}
        rows={requests.map(
          (r): SortRow => ({
            id: r.id,
            href: `/accessory/review/${r.id}`,
            dataNo: r.dataNo,
            storeCode: r.storeCode,
            salesName: r.salesName,
            customerName: r.customerName,
            carModel: r.carModel,
            changeDescription: r.changeDescription,
            warningText: r.warningText,
            submittedBy: r.submittedBy.name,
            submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          })
        )}
      />
    </div>
  );
}
