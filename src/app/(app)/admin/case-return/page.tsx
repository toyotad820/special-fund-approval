import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUS, STATUS_LABEL } from "@/lib/constants";
import { money, dt } from "@/lib/format";
import { StatusBadge } from "@/components/CaseList";
import ReturnCaseForm from "@/components/admin/ReturnCaseForm";

export default async function AdminCaseReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNo?: string }>;
}) {
  const { orderNo: rawOrderNo } = await searchParams;
  const orderNo = (rawOrderNo ?? "").trim().toUpperCase();

  const c = orderNo
    ? await prisma.case.findUnique({
        where: { orderNo },
        include: { submittedBy: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">查詢案件</h2>
        <p className="text-xs text-slate-500 mb-3">
          用途：部長核准後因故須強制取消時，將案件退回申請者修改重送。僅能對「已核准」案件操作。
        </p>
        <form className="flex gap-2" action="/admin/case-return">
          <input
            name="orderNo"
            defaultValue={orderNo}
            placeholder="輸入訂單編號查詢"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700">
            查詢
          </button>
        </form>
      </section>

      {orderNo && !c && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          查無訂單編號「{orderNo}」的案件。
        </p>
      )}

      {c && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-semibold text-slate-800">{c.orderNo}</span>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-sm text-slate-600">領牌名稱：{c.plateName}</div>
          <div className="text-sm text-slate-600">車名：{c.carModel}</div>
          <div className="text-sm text-slate-600">
            所別 / 課別：{c.storeCode} / {c.deptCode || "-"}
          </div>
          <div className="text-sm text-slate-600">送單人：{c.submittedBy.name}</div>
          <div className="text-sm text-slate-600">
            特案支援金額：{money(c.specialSubsidy)}
          </div>
          <div className="text-sm text-slate-600">送出時間：{dt(c.submittedAt)}</div>
          <Link
            href={`/cases/${c.id}`}
            className="text-sm text-blue-600 hover:underline inline-block pt-1"
          >
            查看完整案件內容 →
          </Link>
        </section>
      )}

      {c && c.status === STATUS.APPROVED && <ReturnCaseForm orderNo={c.orderNo} />}

      {c && c.status !== STATUS.APPROVED && (
        <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
          此案件目前狀態為「{STATUS_LABEL[c.status] ?? c.status}」，非「已核准」，無法使用此功能退回。
        </p>
      )}
    </div>
  );
}
