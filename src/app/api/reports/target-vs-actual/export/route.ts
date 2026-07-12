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

  const [grouped, targets] = await Promise.all([
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
  ]);

  const targetByKey = new Map(
    targets.map((t) => [level === "dept" ? `${t.storeCode}-${t.deptCode}` : t.storeCode, t])
  );

  const units = grouped.map((g) => {
    const isDept = "deptCode" in g;
    const key = isDept ? `${g.storeCode}-${(g as { deptCode: string }).deptCode}` : g.storeCode;
    const label = isDept ? `${g.storeCode} ${(g as { deptCode: string }).deptCode}課` : g.storeCode;
    const t = targetByKey.get(key);
    const count = g._count._all;
    const sum = g._sum.specialSubsidy ?? 0;
    return {
      label,
      count,
      sum,
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
    };
  });
  units.sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  const totalAmount = units.reduce((s, u) => s + u.sum, 0);

  const header = ["單位", "目標台數", "申請台數", "申請比率(%)", "金額總和", "金額比率(%)", "平均"];
  const rows = units.map((u) => {
    const rate = u.targetCount ? Math.round((u.count / u.targetCount) * 1000) / 10 : "";
    const sharePct = totalAmount > 0 ? Math.round((u.sum / totalAmount) * 1000) / 10 : 0;
    const avg = u.count > 0 ? Math.round(u.sum / u.count) : 0;
    return [u.label, u.targetCount ?? "", u.count, rate, u.sum, sharePct, avg]
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
