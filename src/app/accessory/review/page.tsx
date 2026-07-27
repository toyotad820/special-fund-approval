import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS } from "@/lib/constants";
import { dt } from "@/lib/format";
import AccStatusBadge from "@/components/AccStatusBadge";

export default async function AccessoryReviewPage() {
  const user = await requireUser();
  // 只有部長可以審核
  if (user.role !== ROLE.BUZHUGUAN) notFound();

  const requests = await prisma.accessoryRequest.findMany({
    where: { status: ACC_STATUS.PENDING_REVIEW },
    include: { submittedBy: true },
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

      {requests.length === 0 ? (
        <p className="text-sm text-slate-400">目前沒有待審核案件。</p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">資料編號</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">所別</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">客戶名稱</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">車名</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">送出人</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">送出時間</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/accessory/review/${r.id}`}
                      className="font-mono font-semibold text-blue-600 hover:underline"
                    >
                      {r.dataNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.storeCode}</td>
                  <td className="px-4 py-3 text-slate-600">{r.customerName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.carModel}</td>
                  <td className="px-4 py-3 text-slate-600">{r.submittedBy.name}</td>
                  <td className="px-4 py-3 text-slate-600">{dt(r.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
