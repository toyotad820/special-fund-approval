import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ROLE, ACC_STATUS, ACC_STATUS_LABEL } from "@/lib/constants";
import { dt } from "@/lib/format";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (
    user.role !== ROLE.BUZHUGUAN &&
    user.role !== ROLE.PEIJIAN &&
    user.role !== ROLE.STAFF
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const storeCodes = searchParams.getAll("storeCodes").filter(Boolean);

  const monthFilter: Prisma.AccessoryRequestWhereInput =
    from || to
      ? { month: { gte: from || undefined, lte: to || undefined } }
      : { month: currentMonth() };

  const where: Prisma.AccessoryRequestWhereInput = {
    ...monthFilter,
    status: { not: ACC_STATUS.DRAFT },
    ...(storeCodes.length > 0 ? { storeCode: { in: storeCodes } } : {}),
  };

  const requests = await prisma.accessoryRequest.findMany({
    where,
    include: { submittedBy: true },
    orderBy: [{ month: "asc" }, { submittedAt: "asc" }],
  });

  const header = [
    "資料編號",
    "月份",
    "所別",
    "業務姓名",
    "客戶名稱",
    "車名",
    "配件名稱/數量",
    "變更前配件",
    "變更後配件",
    "更換說明",
    "狀態",
    "送單人",
    "送出時間",
  ];

  const rows = requests.map((r) =>
    [
      r.dataNo,
      r.month,
      r.storeCode,
      r.salesName,
      r.customerName,
      r.carModel,
      r.accessoryNameQty,
      r.accessoryBefore,
      r.accessoryAfter,
      r.changeDescription,
      ACC_STATUS_LABEL[r.status] ?? r.status,
      r.submittedBy.name,
      dt(r.submittedAt),
    ]
      .map(csvCell)
      .join(",")
  );

  // BOM 讓 Excel 正確辨識 UTF-8 中文
  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  const rangeLabel =
    from || to ? `${from || "start"}_to_${to || "end"}` : currentMonth();
  const storeLabel = storeCodes.length > 0 ? `_${storeCodes.join("-")}` : "";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accessory-${rangeLabel}${storeLabel}.csv"`,
    },
  });
}
