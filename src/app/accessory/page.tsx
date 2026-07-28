import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import { canSubmitAccessory } from "@/lib/dal";
import SortableTable, { type SortCol, type SortRow } from "@/components/SortableTable";
import type { Prisma } from "@prisma/client";

const COLUMNS: SortCol[] = [
  { key: "status", label: "狀態", kind: "status" },
  { key: "storeCode", label: "所別" },
  { key: "salesName", label: "業務姓名" },
  { key: "customerName", label: "客戶", kind: "link", width: "6rem" },
  { key: "carModel", label: "車名" },
  { key: "changeDescription", label: "更換說明", grow: true },
];

export default async function AccessoryHome() {
  const user = await requireUser();

  // 可見範圍：本人一律可見；申請方另可見本所非草稿；部長/配件中心/Staff 可見全部非草稿
  let where: Prisma.AccessoryRequestWhereInput;
  if (user.role === ROLE.SUOZHANG || user.role === ROLE.KEZHANG) {
    where = {
      OR: [
        { submittedById: user.id },
        { storeCode: user.storeCode, status: { not: ACC_STATUS.DRAFT } },
      ],
    };
  } else {
    where = {
      OR: [{ submittedById: user.id }, { status: { not: ACC_STATUS.DRAFT } }],
    };
  }

  const rows = await prisma.accessoryRequest.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-800">配件變更申請</h1>
        {canSubmitAccessory(user) && (
          <Link
            href="/accessory/new"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            新增申請
          </Link>
        )}
      </div>

      <SortableTable
        columns={COLUMNS}
        rows={rows.map(
          (r): SortRow => ({
            href: `/accessory/${r.id}`,
            dataNo: r.dataNo,
            storeCode: r.storeCode,
            salesName: r.salesName,
            customerName: r.customerName,
            carModel: r.carModel,
            changeDescription: r.changeDescription,
            status: r.status,
          })
        )}
        emptyText="目前沒有申請案件"
      />
    </div>
  );
}
