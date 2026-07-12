import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/dal";
import { STATUS_LABEL, STATUS } from "@/lib/constants";
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
  if (!canViewReports(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const storeCodes = searchParams.getAll("storeCodes").filter(Boolean);

  // 月份：優先用 from/to 區間（YYYY-MM 字串可直接字典序比較）；
  // 否則沿用舊版單一 month 參數（向下相容），皆無則預設當月
  const monthFilter: Prisma.CaseWhereInput =
    from || to
      ? { month: { gte: from || undefined, lte: to || undefined } }
      : { month: month || currentMonth() };

  const where: Prisma.CaseWhereInput = {
    ...monthFilter,
    status: { not: STATUS.DRAFT },
    ...(storeCodes.length > 0 ? { storeCode: { in: storeCodes } } : {}),
  };

  const cases = await prisma.case.findMany({
    where,
    include: { category: true, submittedBy: true },
    orderBy: [{ month: "asc" }, { submittedAt: "asc" }],
  });

  const header = [
    "訂單編號",
    "月份",
    "所別",
    "課別",
    "領牌名稱",
    "特案類別",
    "類別編號",
    "車名",
    "所課支援金",
    "金牌金額",
    "銀牌金額",
    "折讓總額",
    "特案支援金額",
    "狀態",
    "送單人",
    "送出時間",
    "備註",
  ];

  const rows = cases.map((c) =>
    [
      c.orderNo,
      c.month,
      c.storeCode,
      c.deptCode,
      c.plateName,
      c.category?.name ?? "",
      c.categoryNo,
      c.carModel,
      c.subsidyDeptCourse,
      c.goldMedal,
      c.silverMedal,
      c.discountTotal,
      c.specialSubsidy,
      STATUS_LABEL[c.status] ?? c.status,
      c.submittedBy.name,
      dt(c.submittedAt),
      c.description ?? "",
    ]
      .map(csvCell)
      .join(",")
  );

  // BOM 讓 Excel 正確辨識 UTF-8 中文
  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  // Content-Disposition 標頭僅能為 ASCII，檔名一律用英數字組成
  const rangeLabel =
    from || to
      ? `${from || "start"}_to_${to || "end"}`
      : month || currentMonth();
  const storeLabel = storeCodes.length > 0 ? `_${storeCodes.join("-")}` : "";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cases-${rangeLabel}${storeLabel}.csv"`,
    },
  });
}
