import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import { canSubmitAccessory } from "@/lib/dal";
import AccStatusBadge from "@/components/AccStatusBadge";
import type { Prisma } from "@prisma/client";

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

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={TH}>資料編號</th>
                <th className={TH}>所別</th>
                <th className={TH}>業務姓名</th>
                <th className={TH}>客戶</th>
                <th className={TH}>車名</th>
                <th className={`${TH} w-full`}>更換說明</th>
                <th className={TH}>狀態</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className={TD}>
                    <Link
                      href={`/accessory/${r.id}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {r.dataNo}
                    </Link>
                  </td>
                  <td className={TD}>{r.storeCode}</td>
                  <td className={TD}>{r.salesName}</td>
                  <td className={TD}>{r.customerName}</td>
                  <td className={TD}>{r.carModel}</td>
                  <td className={`px-3 py-2 text-sm text-slate-800 w-full`}>{r.changeDescription}</td>
                  <td className={TD}>
                    <AccStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                    目前沒有申請案件
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const TH = "text-left text-xs font-semibold text-slate-500 px-3 py-2 whitespace-nowrap";
const TD = "px-3 py-2 text-sm text-slate-800 whitespace-nowrap";
