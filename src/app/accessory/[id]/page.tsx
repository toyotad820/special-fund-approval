import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  canViewAccessory,
  canWithdrawAccessory,
  canResubmitAccessory,
  canDeleteAccessory,
} from "@/lib/dal";
import { ACTION_LABEL } from "@/lib/constants";
import { dt } from "@/lib/format";
import AccStatusBadge from "@/components/AccStatusBadge";
import ImageLightbox from "@/components/ImageLightbox";
import ApplicantActions from "@/components/ApplicantActions";

function Row({
  label,
  children,
  align = "right",
}: {
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-400 shrink-0">{label}</span>
      <span
        className={`text-sm text-slate-800 whitespace-pre-wrap ${align === "left" ? "text-left" : "text-right"}`}
      >
        {children}
      </span>
    </div>
  );
}

export default async function AccessoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const r = await prisma.accessoryRequest.findUnique({
    where: { id },
    include: {
      submittedBy: true,
      images: { orderBy: { sortOrder: "asc" } },
      logs: {
        include: { reviewer: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!r || !canViewAccessory(user, r)) notFound();

  const canWithdraw = canWithdrawAccessory(user, r);
  const canResubmit = canResubmitAccessory(user, r);
  const canDelete = canDeleteAccessory(user, r);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link href="/accessory" className="text-sm text-blue-600 hover:underline">
        ← 回案件明細
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="font-mono font-semibold text-slate-800">{r.dataNo}</span>
          <AccStatusBadge status={r.status} />
        </div>
        <Row label="所別">{r.storeCode}</Row>
        <Row label="業務姓名">{r.salesName}</Row>
        <Row label="客戶名稱">{r.customerName}</Row>
        <Row label="車名">{r.carModel}</Row>
        <Row label="配件名稱／數量">{r.accessoryNameQty}</Row>
        <Row label="變更前配件">{r.accessoryBefore}</Row>
        <Row label="變更後配件">{r.accessoryAfter}</Row>
        <Row label="更換說明" align="left">{r.changeDescription}</Row>
        <Row label="送單人">{r.submittedBy.name}</Row>
        <Row label="送出時間">{dt(r.submittedAt)}</Row>
      </div>

      {r.images.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">工單圖片</h2>
          <ImageLightbox
            images={r.images
              .map((img) => {
                const src = img.imageData
                  ? `data:${img.mimeType};base64,${img.imageData}`
                  : null;
                return src ? { src, alt: "工單圖片" } : null;
              })
              .filter(Boolean) as Array<{ src: string; alt: string }>}
          />
          {r.images.some((img) => !img.imageData) && (
            <div className="mt-3 flex flex-wrap gap-3">
              {r.images
                .filter((img) => !img.imageData)
                .map((img) => (
                  <div
                    key={img.id}
                    className="w-40 h-52 grid place-items-center rounded-lg border border-slate-200 text-xs text-slate-400 text-center px-2"
                  >
                    已歸檔至 Google Drive
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">處理紀錄</h2>
        <ol className="space-y-3">
          {r.logs.map((log) => (
            <li key={log.id} className="flex gap-3">
              <div className="w-1.5 rounded-full bg-slate-200 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm">
                  <span className="font-medium text-slate-800">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                  <span className="text-slate-400"> · {log.reviewer.name}</span>
                </div>
                <div className="text-xs text-slate-400">{dt(log.createdAt)}</div>
                {log.comment && (
                  <div className="text-sm text-slate-600 mt-1 bg-slate-50 rounded-lg px-3 py-2">
                    {log.comment}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <ApplicantActions
        requestId={r.id}
        canWithdraw={canWithdraw}
        canResubmit={canResubmit}
        canDelete={canDelete}
      />
    </div>
  );
}
