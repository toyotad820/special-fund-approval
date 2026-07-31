import { prisma } from "@/lib/prisma";
import { STATUS, STATUS_LABEL } from "@/lib/constants";
import { money, dt } from "@/lib/format";
import { StatusBadge } from "@/components/CaseList";
import ReturnCaseForm from "@/components/admin/ReturnCaseForm";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-slate-800 text-left flex-1">{children}</span>
    </div>
  );
}

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
        include: { submittedBy: { select: { name: true } }, category: true },
      })
    : null;

  const amounts = c
    ? ([
        ["所課支援金", c.subsidyDeptCourse],
        ["金牌金額", c.goldMedal],
        ["銀牌金額", c.silverMedal],
        ["折讓總額", c.discountTotal],
        ["特案支援金額", c.specialSubsidy],
      ] as const)
    : [];

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
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-mono font-semibold text-slate-800">{c.orderNo}</span>
            <StatusBadge status={c.status} />
          </div>
          <Row label="月份">{c.month}</Row>
          <Row label="所別 / 課別">
            {c.storeCode} / {c.deptCode || "-"}
          </Row>
          <Row label="領牌名稱">{c.plateName}</Row>
          <Row label="特案類別">{c.category?.name ?? "（尚未選擇）"}</Row>
          <Row label="類別編號">{c.categoryNo}</Row>
          <Row label="車名">{c.carModel}</Row>
          {amounts.map(([label, val]) => (
            <Row key={label} label={label}>
              {money(val)}
            </Row>
          ))}
          <Row label="送單人">{c.submittedBy.name}</Row>
          <Row label="送出時間">{dt(c.submittedAt)}</Row>
          <div className="pt-3">
            <div className="text-sm text-slate-400 mb-1">特案內容說明</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">
              {c.description}
            </p>
          </div>
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
