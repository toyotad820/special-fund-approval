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

type CatStat = { sum: number; count: number };
type UnitRow = {
  key: string;
  label: string;
  byCategory: Map<string, CatStat>;
  totalSum: number;
  totalCount: number;
};

export async function GET(request: Request) {
  const user = await requireUser();
  if (!canViewReports(user)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || currentMonth();
  const level: "store" | "dept" = searchParams.get("level") === "dept" ? "dept" : "store";

  const categories = await prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } });

  const units = new Map<string, UnitRow>();
  function ensureUnit(key: string, label: string): UnitRow {
    let u = units.get(key);
    if (!u) {
      u = { key, label, byCategory: new Map(), totalSum: 0, totalCount: 0 };
      units.set(key, u);
    }
    return u;
  }

  if (level === "dept") {
    const grouped = await prisma.case.groupBy({
      by: ["storeCode", "deptCode", "categoryId"],
      where: { month, status: STATUS.APPROVED },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (!g.categoryId) continue;
      const key = `${g.storeCode}-${g.deptCode}`;
      const u = ensureUnit(key, key);
      const sum = g._sum.specialSubsidy ?? 0;
      const count = g._count._all;
      u.byCategory.set(g.categoryId, { sum, count });
      u.totalSum += sum;
      u.totalCount += count;
    }
  } else {
    const grouped = await prisma.case.groupBy({
      by: ["storeCode", "categoryId"],
      where: { month, status: STATUS.APPROVED },
      _sum: { specialSubsidy: true },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (!g.categoryId) continue;
      const u = ensureUnit(g.storeCode, g.storeCode);
      const sum = g._sum.specialSubsidy ?? 0;
      const count = g._count._all;
      u.byCategory.set(g.categoryId, { sum, count });
      u.totalSum += sum;
      u.totalCount += count;
    }
  }

  const unitList = [...units.values()].sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const header = [
    `單位（${level === "store" ? "所" : "課"}）`,
    ...categories.flatMap((c) => [`${c.name}_金額`, `${c.name}_件數`, `${c.name}_平均`]),
    "合計_金額",
    "合計_件數",
    "合計_平均",
  ];

  const rows = unitList.map((u) => {
    const cells: (string | number)[] = [u.label];
    for (const c of categories) {
      const stat = u.byCategory.get(c.id);
      const sum = stat?.sum ?? 0;
      const count = stat?.count ?? 0;
      const avg = count > 0 ? Math.round(sum / count) : 0;
      cells.push(sum, count, avg);
    }
    const totalAvg = u.totalCount > 0 ? Math.round(u.totalSum / u.totalCount) : 0;
    cells.push(u.totalSum, u.totalCount, totalAvg);
    return cells.map(csvCell).join(",");
  });

  const csv = "﻿" + [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="category-usage-${month}-${level}.csv"`,
    },
  });
}
