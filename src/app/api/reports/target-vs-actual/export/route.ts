import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewReports } from "@/lib/dal";
import { STATUS } from "@/lib/constants";

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
  const level: "store" | "dept" = searchParams.get("level") === "dept" ? "dept" : "store";

  const caseWhere = {
    month,
    status: { notIn: [STATUS.DRAFT, STATUS.REJECTED, STATUS.WITHDRAWN] as string[] },
  };

  const [grouped, targets, byCategoryOverall, byUnitCategory, categories] = await Promise.all([
    level === "dept"
      ? prisma.case.groupBy({
          by: ["storeCode", "deptCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: { specialSubsidy: true },
        })
      : prisma.case.groupBy({
          by: ["storeCode"],
          where: caseWhere,
          _count: { _all: true },
          _sum: { specialSubsidy: true },
        }),
    prisma.unitTarget.findMany({
      where: level === "dept" ? { month, deptCode: { not: "0" } } : { month, deptCode: "0" },
    }),
    // 決定類別欄位順序（依金額總和排序，跟首頁/報表頁一致）
    prisma.case.groupBy({
      by: ["categoryId"],
      where: caseWhere,
      _sum: { specialSubsidy: true },
    }),
    level === "dept"
      ? prisma.case.groupBy({
          by: ["storeCode", "deptCode", "categoryId"],
          where: caseWhere,
          _count: { _all: true },
        })
      : prisma.case.groupBy({
          by: ["storeCode", "categoryId"],
          where: caseWhere,
          _count: { _all: true },
        }),
    prisma.caseCategory.findMany(),
  ]);

  const targetByKey = new Map(
    targets.map((t) => [level === "dept" ? `${t.storeCode}-${t.deptCode}` : t.storeCode, t])
  );

  // 類別欄位涵蓋所有現行類別（不只本月有申請的），本月無資料的欄位顯示 0
  const sumByCategoryId = new Map(byCategoryOverall.map((r) => [r.categoryId, r._sum.specialSubsidy ?? 0]));
  const categoryOrder = categories
    .map((c) => ({ id: c.id as string | null, name: c.name, sum: sumByCategoryId.get(c.id) ?? 0 }))
    .sort((a, b) => b.sum - a.sum);

  const countByUnitCategory = new Map<string, Map<string | null, number>>();
  for (const r of byUnitCategory) {
    const isDept = "deptCode" in r;
    const key = isDept
      ? `${r.storeCode}-${(r as { deptCode: string }).deptCode}`
      : r.storeCode;
    if (!countByUnitCategory.has(key)) countByUnitCategory.set(key, new Map());
    countByUnitCategory.get(key)!.set(r.categoryId, r._count._all);
  }

  const units = grouped.map((g) => {
    const isDept = "deptCode" in g;
    const key = isDept ? `${g.storeCode}-${(g as { deptCode: string }).deptCode}` : g.storeCode;
    const label = isDept ? `${g.storeCode} ${(g as { deptCode: string }).deptCode}課` : g.storeCode;
    const t = targetByKey.get(key);
    const count = g._count._all;
    const sum = g._sum.specialSubsidy ?? 0;
    return {
      key,
      label,
      count,
      sum,
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
    };
  });
  units.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const totalAmount = units.reduce((s, u) => s + u.sum, 0);

  const header = [
    "單位",
    "目標台數",
    ...categoryOrder.map((c) => c.name),
    "申請台數",
    "申請比率(%)",
    "金額總和",
    "金額比率(%)",
    "平均金額",
  ];
  const rows = units.map((u) => {
    const rate = u.targetCount ? Math.round((u.count / u.targetCount) * 1000) / 10 : "";
    const sharePct = totalAmount > 0 ? Math.round((u.sum / totalAmount) * 1000) / 10 : 0;
    const avg = u.count > 0 ? Math.round(u.sum / u.count) : 0;
    const catCounts = categoryOrder.map((c) => countByUnitCategory.get(u.key)?.get(c.id) ?? 0);
    return [u.label, u.targetCount ?? "", ...catCounts, u.count, rate, u.sum, sharePct, avg]
      .map(csvCell)
      .join(",");
  });

  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="target-vs-actual-${month}-${level}.csv"`,
    },
  });
}
