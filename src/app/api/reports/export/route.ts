import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/dal";
import { STATUS_LABEL } from "@/lib/constants";
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
  const month = searchParams.get("month") || currentMonth();

  const cases = await prisma.case.findMany({
    where: { month },
    include: { category: true, submittedBy: true },
    orderBy: { submittedAt: "asc" },
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
    "金牌",
    "銀牌",
    "折讓總額",
    "特案支援金額",
    "狀態",
    "送單人",
    "送出時間",
  ];

  const rows = cases.map((c) =>
    [
      c.orderNo,
      c.month,
      c.storeCode,
      c.deptCode,
      c.plateName,
      c.category.name,
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
    ]
      .map(csvCell)
      .join(",")
  );

  // BOM 讓 Excel 正確辨識 UTF-8 中文
  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cases-${month}.csv"`,
    },
  });
}
