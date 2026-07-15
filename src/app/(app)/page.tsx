import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  reviewQueueWhere,
  visibilityWhere,
  canSubmit,
} from "@/lib/dal";
import { ROLE, ROLE_LABEL, STATUS } from "@/lib/constants";
import { CATEGORICAL, CATEGORY_COLOR_BY_NAME } from "@/lib/chartColors";
import { money } from "@/lib/format";
import CaseList from "@/components/CaseList";
import SortableCaseTable, {
  type CaseRowData,
} from "@/components/SortableCaseTable";
import SimpleDonutChart from "@/components/SimpleDonutChart";
import SimpleComboChart from "@/components/SimpleComboChart";
import MultiSelectDropdown from "@/components/MultiSelectDropdown";

export const caseInclude = {
  category: { select: { name: true } },
  submittedBy: { select: { name: true } },
  logs: {
    where: { action: "REJECT" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { step: true, reviewer: { select: { name: true } } },
  },
} as const;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type CaseWithRels = {
  id: string;
  orderNo: string;
  month: string;
  storeCode: string;
  deptCode: string;
  plateName: string;
  categoryNo: string;
  carModel: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
  description: string;
  submittedAt: Date;
  status: string;
  category: { name: string } | null;
  submittedBy: { name: string };
  logs: { step: string; reviewer: { name: string } }[];
};

export function toRow(c: CaseWithRels): CaseRowData {
  const rej = c.status === STATUS.REJECTED ? c.logs[0] : undefined;
  return {
    id: c.id,
    orderNo: c.orderNo,
    month: c.month,
    storeDept: `${c.storeCode} / ${c.deptCode}`,
    plateName: c.plateName,
    categoryName: c.category?.name ?? "（尚未選擇）",
    categoryNo: c.categoryNo,
    carModel: c.carModel,
    subsidyDeptCourse: c.subsidyDeptCourse,
    goldMedal: c.goldMedal,
    silverMedal: c.silverMedal,
    discountTotal: c.discountTotal,
    specialSubsidy: c.specialSubsidy,
    description: c.description,
    submitterName: c.submittedBy.name,
    submittedAt: c.submittedAt.toISOString(),
    status: c.status,
    rejectedByRole: rej ? ROLE_LABEL[rej.step] ?? "" : null,
  };
}

function scopeLabel(role: string): string {
  if (role === ROLE.KEZHANG) return "本課案件";
  if (role === ROLE.SUOZHANG) return "本所案件";
  return "全部案件";
}

type StatRow = { label: string; count: number; sum: number; avg: number };

type TargetRow = {
  label: string; // 所別
  count: number; // 申請台數
  amountSharePct: number; // 申請金額佔全體的百分比
  targetCount: number | null; // 目標台數（所層級，未上傳則為 null）
  weight: number | null; // 比重（所層級，未上傳則為 null）
};

type CarModelRow = {
  carModel: string;
  countByCategory: Map<string | null, number>;
  totalCount: number;
  totalSum: number;
  avg: number;
};

// 統計區：各特案類別統計 + 各所統計（不含草稿／已駁回／已撤回），供部長/Staff 首頁使用
function StatTable({ rows, unitLabel }: { rows: StatRow[]; unitLabel: string }) {
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const totalSum = rows.reduce((s, r) => s + r.sum, 0);
    const totalAvg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

    return (
      <table className="w-full mt-4 text-sm">
        <thead>
          <tr className="text-xs text-slate-400">
            <th className="py-1 font-medium text-left">{unitLabel}</th>
            <th className="py-1 font-medium text-center">件數</th>
            <th className="py-1 font-medium text-center">金額總和</th>
            <th className="py-1 font-medium text-center">佔比</th>
            <th className="py-1 font-medium text-center">平均</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-700">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{r.count}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-800 font-medium">
                {money(r.sum)}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">
                {totalSum > 0 ? `${Math.round((r.sum / totalSum) * 100)}%` : "-"}
              </td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">{money(r.avg)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-4">
                本月尚無資料
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold text-slate-800">
              <td className="py-1.5">合計</td>
              <td className="py-1.5 text-right tabular-nums">{totalCount}</td>
              <td className="py-1.5 text-right tabular-nums">{money(totalSum)}</td>
              <td className="py-1.5 text-right tabular-nums">100%</td>
              <td className="py-1.5 text-right tabular-nums">{money(totalAvg)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    );
}

  // 所別統計轉置表：所別當欄、指標（件數/所基金合計/特案總和/佔比/平均）當列，
  // 因為所別可能多達 24 個以上，欄轉列比較容易一次看完全部所別
function TransposedStatTable({
    rows,
    unitLabel,
    colWidth,
    firstColWidth,
    categoryBreakdown,
    targetRows,
    fundTotalByLabel,
  }: {
    rows: StatRow[];
    unitLabel: string;
    // 有給寬度時欄位改為固定寬，跟上方圖表的每欄／左側留白對齊
    colWidth?: number;
    firstColWidth?: number;
    // 件數依類別拆分顯示；不給的話件數只顯示單一總列
    categoryBreakdown?: { name: string; color: string; countByLabel: Map<string, number> }[];
    // 給了才會顯示「申請比率」「金額佔比」兩列
    targetRows?: TargetRow[];
    // 給了才會顯示「所基金合計」列（所課支援金＋金牌金額＋銀牌金額）
    fundTotalByLabel?: Map<string, number>;
}) {
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const totalSum = rows.reduce((s, r) => s + r.sum, 0);
    const totalAvg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
    const pct = (sum: number) => (totalSum > 0 ? `${Math.round((sum / totalSum) * 100)}%` : "-");

    // 申請比率／金額佔比（併自「所課特案申請統計表」的邏輯）：
    // 台數達成率前3高標紅、後3低標綠；金額佔比高於比重的所別標紅
    const fixed = colWidth !== undefined;
    const fontSize = fixed ? 10 : 12;

    const th = `py-1.5 pr-2 text-left font-medium text-slate-400 sticky left-0 bg-white whitespace-nowrap${fixed ? "" : " text-xs"}`;
    const td = `py-1.5 px-1 text-right tabular-nums whitespace-nowrap border-l border-slate-100 overflow-hidden${fixed ? "" : " text-sm"}`;

    const targetByLabel = new Map((targetRows ?? []).map((t) => [t.label, t]));
    const rateByLabel = new Map(
      rows.map((r) => {
        const t = targetByLabel.get(r.label);
        const rate = t?.targetCount && t.targetCount > 0 ? (r.count / t.targetCount) * 100 : null;
        return [r.label, rate];
      })
    );
    const rateN = 3;
    const qualifyingRate = rows.filter((r) => rateByLabel.get(r.label) !== null);
    const sortedByRateDesc = [...qualifyingRate].sort(
      (a, b) => (rateByLabel.get(b.label) ?? 0) - (rateByLabel.get(a.label) ?? 0)
    );
    const redRateKeys = new Set(sortedByRateDesc.slice(0, rateN).map((r) => r.label));
    const greenRateKeys = new Set(sortedByRateDesc.slice(-rateN).map((r) => r.label));
    for (const k of [...redRateKeys]) {
      if (greenRateKeys.has(k)) {
        redRateKeys.delete(k);
        greenRateKeys.delete(k);
      }
    }
    const totalTargetCount = rows.reduce((s, r) => s + (targetByLabel.get(r.label)?.targetCount ?? 0), 0);
    const totalRate = totalTargetCount > 0 ? (totalCount / totalTargetCount) * 100 : null;
    const rateCellCls = (label: string) =>
      redRateKeys.has(label)
        ? `${td} bg-rose-100 text-rose-800 font-bold`
        : greenRateKeys.has(label)
          ? `${td} bg-emerald-100 text-emerald-800 font-bold`
          : `${td} text-slate-600`;

    const shareCellCls = (label: string) => {
      const t = targetByLabel.get(label);
      return t && t.weight !== null && t.amountSharePct > t.weight
        ? `${td} bg-rose-100 text-rose-800 font-bold`
        : `${td} text-slate-600`;
    };

    if (rows.length === 0) {
      return <p className="text-sm text-slate-400 text-center py-4 mt-4">本月尚無資料</p>;
    }

    // 平均值前3高標紅、後3低標綠（樣本太少導致重疊時，重疊部分不標色）
    const N = 3;
    const qualifying = rows.filter((r) => r.count > 0);
    const sortedByAvgDesc = [...qualifying].sort((a, b) => b.avg - a.avg);
    const redKeys = new Set(sortedByAvgDesc.slice(0, N).map((r) => r.label));
    const greenKeys = new Set(sortedByAvgDesc.slice(-N).map((r) => r.label));
    for (const k of [...redKeys]) {
      if (greenKeys.has(k)) {
        redKeys.delete(k);
        greenKeys.delete(k);
      }
    }
    const avgCellCls = (label: string) =>
      redKeys.has(label)
        ? `${td} bg-rose-100 text-rose-800 font-bold`
        : greenKeys.has(label)
          ? `${td} bg-emerald-100 text-emerald-800 font-bold`
          : `${td} text-slate-600`;

    const tableWidth = fixed ? (firstColWidth ?? colWidth!) + colWidth! * (rows.length + 1) : undefined;

    return (
      <div className="mt-4">
        <table
          className={fixed ? undefined : "text-sm"}
          style={
            fixed
              ? { tableLayout: "fixed", width: tableWidth, fontSize }
              : undefined
          }
        >
          {fixed && (
            <colgroup>
              <col style={{ width: firstColWidth ?? colWidth }} />
              {rows.map((r) => (
                <col key={r.label} style={{ width: colWidth }} />
              ))}
              <col style={{ width: colWidth }} />
            </colgroup>
          )}
          <tbody>
            <tr className="border-b border-slate-200">
              <th className={th}>{unitLabel}</th>
              {rows.map((r) => (
                <td
                  key={r.label}
                  className={`${td} font-semibold text-slate-700`}
                  style={{ textAlign: "center" }}
                >
                  {r.label}
                </td>
              ))}
              <td
                className={`${td} font-semibold text-slate-700 bg-slate-50/70`}
                style={{ textAlign: "center" }}
              >
                合計
              </td>
            </tr>
            {categoryBreakdown && categoryBreakdown.length > 0 ? (
              <>
                {categoryBreakdown.map((c) => {
                  const catTotal = rows.reduce(
                    (s, r) => s + (c.countByLabel.get(r.label) ?? 0),
                    0
                  );
                  return (
                    <tr key={c.name} className="border-b border-slate-100">
                      <th className={th}>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-sm shrink-0"
                            style={{ background: c.color }}
                          />
                          {c.name}
                        </span>
                      </th>
                      {rows.map((r) => (
                        <td key={r.label} className={`${td} text-slate-600`}>
                          {c.countByLabel.get(r.label) ?? 0}
                        </td>
                      ))}
                      <td className={`${td} font-semibold text-slate-700 bg-slate-50/70`}>
                        {catTotal}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-slate-100">
                  <th className={th}>件數合計</th>
                  {rows.map((r) => (
                    <td key={r.label} className={`${td} font-bold text-slate-800`}>
                      {r.count}
                    </td>
                  ))}
                  <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>{totalCount}</td>
                </tr>
              </>
            ) : (
              <tr className="border-b border-slate-100">
                <th className={th}>件數</th>
                {rows.map((r) => (
                  <td key={r.label} className={`${td} text-slate-600`}>
                    {r.count}
                  </td>
                ))}
                <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>{totalCount}</td>
              </tr>
            )}
            {targetRows && (
              <tr className="border-b border-slate-100">
                <th className={th}>申請比率</th>
                {rows.map((r) => (
                  <td key={r.label} className={rateCellCls(r.label)}>
                    {(() => {
                      const rate = rateByLabel.get(r.label);
                      return rate !== null && rate !== undefined ? `${Math.round(rate)}%` : "-";
                    })()}
                  </td>
                ))}
                <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>
                  {totalRate !== null ? `${Math.round(totalRate)}%` : "-"}
                </td>
              </tr>
            )}
            {fundTotalByLabel && (
              <tr className="border-b border-slate-100">
                <th className={th}>所基金合計</th>
                {rows.map((r) => {
                  const fundTotal = fundTotalByLabel.get(r.label) ?? 0;
                  return (
                    <td
                      key={r.label}
                      className={
                        fundTotal > r.sum
                          ? `${td} bg-emerald-100 text-emerald-800 font-bold`
                          : `${td} text-slate-600`
                      }
                    >
                      {money(fundTotal)}
                    </td>
                  );
                })}
                <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>
                  {money(rows.reduce((s, r) => s + (fundTotalByLabel.get(r.label) ?? 0), 0))}
                </td>
              </tr>
            )}
            <tr className="border-b border-slate-100">
              <th className={th}>特案總和</th>
              {rows.map((r) => (
                <td key={r.label} className={`${td} text-slate-800 font-medium`}>
                  {money(r.sum)}
                </td>
              ))}
              <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>{money(totalSum)}</td>
            </tr>
            {targetRows && (
              <tr className="border-b border-slate-100">
                <th className={th}>金額佔比</th>
                {rows.map((r) => (
                  <td key={r.label} className={shareCellCls(r.label)}>
                    {pct(r.sum)}
                  </td>
                ))}
                <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>100%</td>
              </tr>
            )}
            <tr>
              <th className={th}>平均金額</th>
              {rows.map((r) => (
                <td key={r.label} className={avgCellCls(r.label)}>
                  {money(r.avg)}
                </td>
              ))}
              <td className={`${td} font-bold text-slate-800 bg-slate-50/70`}>{money(totalAvg)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
}

// 各車種特案統計：只列有申請的車種，欄位為各特案類型件數 + 合計 + 特案金額 + 平均金額
function CarModelStatTable({
  rows,
  categoryOrder,
  categoryColor,
}: {
  rows: CarModelRow[];
  categoryOrder: { id: string | null; name: string }[];
  categoryColor: (id: string | null) => string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">本月尚無資料</p>;
  }

  const totalCount = rows.reduce((s, r) => s + r.totalCount, 0);
  const totalSum = rows.reduce((s, r) => s + r.totalSum, 0);
  const totalAvg = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;

  const th =
    "text-center text-xs font-semibold text-slate-500 px-2.5 py-2 whitespace-nowrap border-l border-slate-200 first:border-l-0";
  const thLabel =
    "text-left text-xs font-semibold text-slate-500 px-2.5 py-2 whitespace-nowrap sticky left-0 bg-slate-50";
  const td =
    "text-right px-2.5 py-2 whitespace-nowrap border-l border-slate-100 first:border-l-0 tabular-nums text-slate-800";

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className={thLabel}>車名</th>
            {categoryOrder.map((c) => (
              <th key={c.id ?? "none"} className={th}>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-sm shrink-0"
                    style={{ background: categoryColor(c.id) }}
                  />
                  {c.name}
                </span>
              </th>
            ))}
            <th className={th}>合計</th>
            <th className={th}>特案金額</th>
            <th className={th}>佔比</th>
            <th className={th}>平均金額</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.carModel} className="border-t border-slate-100 bg-white even:bg-slate-50">
              <td className="px-2.5 py-2 font-medium text-slate-800 sticky left-0 bg-inherit whitespace-nowrap">
                {r.carModel}
              </td>
              {categoryOrder.map((c) => (
                <td key={c.id ?? "none"} className={td}>
                  {r.countByCategory.get(c.id) ?? 0}
                </td>
              ))}
              <td className={`${td} font-semibold`}>{r.totalCount}</td>
              <td className={td}>{money(r.totalSum)}</td>
              <td className={td}>{totalSum > 0 ? `${Math.round((r.totalSum / totalSum) * 100)}%` : "-"}</td>
              <td className={td}>{money(r.avg)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-50">
            <td className="px-2.5 py-2 sticky left-0 bg-inherit">總計</td>
            {categoryOrder.map((c) => (
              <td key={c.id ?? "none"} className={td}>
                {rows.reduce((s, r) => s + (r.countByCategory.get(c.id) ?? 0), 0)}
              </td>
            ))}
            <td className={td}>{totalCount}</td>
            <td className={td}>{money(totalSum)}</td>
            <td className={td}>100%</td>
            <td className={td}>{money(totalAvg)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

async function DashboardStats({ month }: { month: string }) {
  const statusFilter = {
    notIn: [STATUS.DRAFT, STATUS.REJECTED, STATUS.WITHDRAWN] as string[],
  };

  const [byCategory, byStore, byStoreCategory, byCarModelCategory, categories, storeTargets] =
    await Promise.all([
      prisma.case.groupBy({
        by: ["categoryId"],
        where: { month, status: statusFilter },
        _sum: { specialSubsidy: true },
        _count: { _all: true },
      }),
      prisma.case.groupBy({
        by: ["storeCode"],
        where: { month, status: statusFilter },
        _sum: {
          specialSubsidy: true,
          subsidyDeptCourse: true,
          goldMedal: true,
          silverMedal: true,
        },
        _count: { _all: true },
      }),
      prisma.case.groupBy({
        by: ["storeCode", "categoryId"],
        where: { month, status: statusFilter },
        _sum: { specialSubsidy: true },
        _count: { _all: true },
      }),
      // 各車種特案統計：只列有申請的車種（groupBy 天生只回傳實際出現過的組合）
      prisma.case.groupBy({
        by: ["carModel", "categoryId"],
        where: { month, status: statusFilter },
        _sum: { specialSubsidy: true },
        _count: { _all: true },
      }),
      prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      // 所層級目標（deptCode="0"）：跟課層級各自獨立維護，見 UnitTarget
      prisma.unitTarget.findMany({ where: { month, deptCode: "0" } }),
    ]);

  const targetByStore = new Map(storeTargets.map((t) => [t.storeCode, t]));

  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "（未分類）";

  // 顏色綁定類別名稱本身（見 CATEGORY_COLOR_BY_NAME 註解），不依金額排序後的名次，
  // 也不依資料庫 sortOrder，避免同一類別在本機測試資料和正式資料下顯示不同顏色
  const categoryColor = (id: string | null) => {
    const name = catName(id);
    const idx = categories.findIndex((c) => c.id === id);
    return (
      CATEGORY_COLOR_BY_NAME[name] ??
      CATEGORICAL[(idx < 0 ? categories.length : idx) % CATEGORICAL.length]
    );
  };

  const toStatRow = (label: string, sum: number | null, count: number): StatRow => ({
    label,
    count,
    sum: sum ?? 0,
    avg: count > 0 ? Math.round((sum ?? 0) / count) : 0,
  });

  const categoryRows = byCategory
    .map((r) => ({
      ...toStatRow(catName(r.categoryId), r._sum.specialSubsidy, r._count._all),
      id: r.categoryId,
    }))
    .sort((a, b) => b.sum - a.sum);

  const storeRows = byStore
    .map((r) => toStatRow(r.storeCode, r._sum.specialSubsidy, r._count._all))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant"));

  // 所基金合計 = 所課支援金 + 金牌金額 + 銀牌金額（跟特案支援金額分開統計）
  const fundTotalByStore = new Map(
    byStore.map((r) => [
      r.storeCode,
      (r._sum.subsidyDeptCourse ?? 0) + (r._sum.goldMedal ?? 0) + (r._sum.silverMedal ?? 0),
    ])
  );

  // 堆疊長條的類別順序與顏色，需與甜甜圈圖（categoryRows，依金額總和排序）一致
  const categoryOrder = byCategory
    .map((r) => ({ id: r.categoryId, name: catName(r.categoryId), sum: r._sum.specialSubsidy ?? 0 }))
    .sort((a, b) => b.sum - a.sum);

  const storeCategorySums = new Map<string, Map<string | null, number>>();
  const storeCategoryCounts = new Map<string, Map<string | null, number>>();
  for (const r of byStoreCategory) {
    if (!storeCategorySums.has(r.storeCode)) storeCategorySums.set(r.storeCode, new Map());
    if (!storeCategoryCounts.has(r.storeCode)) storeCategoryCounts.set(r.storeCode, new Map());
    storeCategorySums.get(r.storeCode)!.set(r.categoryId, r._sum.specialSubsidy ?? 0);
    storeCategoryCounts.get(r.storeCode)!.set(r.categoryId, r._count._all);
  }

  const storeStackedRows = storeRows.map((r) => ({
    label: r.label,
    segments: categoryOrder.map((c) => storeCategorySums.get(r.label)?.get(c.id) ?? 0),
    line: r.avg,
  }));


  // 所別可能多達 24 個以上，長條折線圖需要足夠寬度才不會擠成一團
  const comboWidth = Math.max(360, storeRows.length * 55 + 110);
  // 下方表格欄寬需與圖表算法一致（SimpleComboChart 的 padding/bandW），標籤才能對齊
  const comboPaddingLeft = 54;
  const comboPaddingRight = 48;
  const comboBandW =
    (comboWidth - comboPaddingLeft - comboPaddingRight) / Math.max(1, storeRows.length);

  // 各車種特案統計：依車名彙總各類別件數、總件數、總金額、平均金額，只列本月有申請的車種
  const carModelMap = new Map<string, CarModelRow>();
  for (const r of byCarModelCategory) {
    let row = carModelMap.get(r.carModel);
    if (!row) {
      row = { carModel: r.carModel, countByCategory: new Map(), totalCount: 0, totalSum: 0, avg: 0 };
      carModelMap.set(r.carModel, row);
    }
    const count = r._count._all;
    const sum = r._sum.specialSubsidy ?? 0;
    row.countByCategory.set(r.categoryId, count);
    row.totalCount += count;
    row.totalSum += sum;
  }
  const carModelRows = [...carModelMap.values()]
    .map((r) => ({ ...r, avg: r.totalCount > 0 ? Math.round(r.totalSum / r.totalCount) : 0 }))
    .sort((a, b) => a.carModel.localeCompare(b.carModel));

  const totalAmount = storeRows.reduce((s, r) => s + r.sum, 0);
  const targetRows: TargetRow[] = storeRows.map((r) => {
    const t = targetByStore.get(r.label);
    return {
      label: r.label,
      count: r.count,
      amountSharePct: totalAmount > 0 ? (r.sum / totalAmount) * 100 : 0,
      targetCount: t?.targetCount ?? null,
      weight: t?.weight ?? null,
    };
  });

  return (
    <div className="space-y-4">
      {/* 上：各特案類別統計，左圖右表 */}
      <section className="card p-4">
        <h2 className="section-title">各特案類別統計 · {month}</h2>
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <SimpleDonutChart
            data={categoryRows.map((r) => ({
              label: r.label,
              value: r.sum,
              color: categoryColor(r.id),
            }))}
          />
          <StatTable rows={categoryRows} unitLabel="類別" />
        </div>
      </section>

      {/* 下：各所統計，上圖下表（所別多達24個，圖表需可橫向捲動） */}
      <section className="card p-4">
        <h2 className="section-title">各所統計（總額 × 平均）· {month}</h2>
        <p className="text-xs text-slate-400 mb-2">
          <span className="inline-block mx-1 px-1.5 rounded bg-rose-100 text-rose-700">
            偏高／超標
          </span>
          <span className="inline-block mx-1 px-1.5 rounded bg-emerald-100 text-emerald-700">
            偏低
          </span>
          （尚未上傳目標的所別以「-」表示）
        </p>
        <div className="overflow-x-auto">
          <SimpleComboChart
            seriesNames={categoryOrder.map((c) => c.name)}
            seriesColors={categoryOrder.map((c) => categoryColor(c.id))}
            lineLabel="平均金額"
            width={comboWidth}
            data={storeStackedRows}
          />
          <TransposedStatTable
            rows={storeRows}
            unitLabel="所別"
            colWidth={comboBandW}
            firstColWidth={comboPaddingLeft}
            targetRows={targetRows}
            fundTotalByLabel={fundTotalByStore}
            categoryBreakdown={categoryOrder.map((c) => ({
              name: c.name,
              color: categoryColor(c.id),
              countByLabel: new Map(
                storeRows.map((r) => [
                  r.label,
                  storeCategoryCounts.get(r.label)?.get(c.id) ?? 0,
                ])
              ),
            }))}
          />
        </div>
      </section>

      {/* 各車種特案統計：只列本月有申請的車種 */}
      <section className="card p-4">
        <h2 className="section-title">各車種特案統計 · {month}</h2>
        <CarModelStatTable
          rows={carModelRows}
          categoryOrder={categoryOrder}
          categoryColor={categoryColor}
        />
      </section>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryIds?: string | string[] }>;
}) {
  const user = await requireUser();

  // 課長／所長／部長／Staff：角色專屬首頁（案件區塊 + 部長/Staff 多一塊統計區）
  if (
    user.role === ROLE.KEZHANG ||
    user.role === ROLE.SUOZHANG ||
    user.role === ROLE.BUZHUGUAN ||
    user.role === ROLE.STAFF
  ) {
    return <RoleDashboard user={user} searchParams={searchParams} />;
  }

  const queueWhere = reviewQueueWhere(user);

  const [queue, mine, visible] = await Promise.all([
    queueWhere
      ? prisma.case.findMany({
          where: queueWhere,
          include: caseInclude,
          orderBy: { stepEnteredAt: "asc" },
        })
      : Promise.resolve([]),
    canSubmit(user)
      ? prisma.case.findMany({
          where: { submittedById: user.id },
          include: caseInclude,
          orderBy: { submittedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    prisma.case.findMany({
      // 草稿為私人資料，一般可視範圍查詢一律排除他人草稿
      where: { ...visibilityWhere(user), status: { not: STATUS.DRAFT } },
      include: caseInclude,
      orderBy: { submittedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            您好，{user.name}
          </h1>
          <p className="text-sm text-slate-500">
            {ROLE_LABEL[user.role]}
            {user.storeCode !== "HQ" ? ` · ${user.storeCode}` : ""}
          </p>
        </div>
        {canSubmit(user) && (
          <Link
            href="/cases/new"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + 新增申請
          </Link>
        )}
      </div>

      {queueWhere && (
        <section>
          <h2 className="section-title">
            待我審核{" "}
            <span className="text-blue-600">({queue.length})</span>
          </h2>
          <CaseList cases={queue} />
        </section>
      )}

      {canSubmit(user) && (
        <section>
          <h2 className="section-title">
            我送出的案件
          </h2>
          <CaseList cases={mine} />
        </section>
      )}

      <section>
        <h2 className="section-title">
          {scopeLabel(user.role)}
        </h2>
        <CaseList cases={visible} />
      </section>
    </div>
  );
}

async function RoleDashboard({
  user,
  searchParams,
}: {
  user: {
    id: string;
    role: string;
    name: string;
    storeCode: string;
    deptCode: string | null;
  };
  searchParams: Promise<{ categoryIds?: string | string[] }>;
}) {
  const month = currentMonth();
  const sp = await searchParams;
  const selectedCategoryIds =
    sp.categoryIds === undefined
      ? null
      : Array.isArray(sp.categoryIds)
        ? sp.categoryIds
        : [sp.categoryIds];

  // Staff：首頁只有統計區，沒有案件明細
  if (user.role === ROLE.STAFF) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-slate-800">您好，{user.name}</h1>
          <p className="text-sm text-slate-500">Staff</p>
        </div>
        <DashboardStats month={month} />
      </div>
    );
  }

  let unresolvedWhere: Prisma.CaseWhereInput;
  let unresolvedTitle: string;
  let unresolvedHint: string;
  let subtitle: string;
  let scopeName = "";
  let monthlyWhere: Prisma.CaseWhereInput | null = null;

  // 草稿為私人資料，其他人不可見；此條件排除「他人的草稿」
  const notOthersDraft: Prisma.CaseWhereInput = {
    OR: [{ status: { not: STATUS.DRAFT } }, { submittedById: user.id }],
  };

  if (user.role === ROLE.KEZHANG) {
    const dept = { storeCode: user.storeCode, deptCode: user.deptCode ?? "" };
    unresolvedWhere = {
      ...dept,
      status: { not: STATUS.APPROVED },
      ...notOthersDraft,
    };
    unresolvedTitle = "未結案件";
    unresolvedHint = "本課．待審核／已駁回／已撤回／草稿";
    subtitle = `課長 · ${user.storeCode}${user.deptCode ? ` ${user.deptCode} 課` : ""}`;
    scopeName = "本課";
    monthlyWhere = { ...dept, month, ...notOthersDraft };
  } else if (user.role === ROLE.SUOZHANG) {
    // 本所：待審核／已駁回，以及「本人」撤回或草稿的案件（不含課長撤案）
    unresolvedWhere = {
      storeCode: user.storeCode,
      OR: [
        {
          status: {
            in: [
              STATUS.PENDING_SUOZHANG,
              STATUS.PENDING_BUZHUGUAN,
              STATUS.REJECTED,
            ],
          },
        },
        { status: STATUS.WITHDRAWN, submittedById: user.id },
        { status: STATUS.DRAFT, submittedById: user.id },
      ],
    };
    unresolvedTitle = "未結案件";
    unresolvedHint = "本所．待審核／已駁回／本人撤回或草稿";
    subtitle = `所長 · ${user.storeCode}`;
    scopeName = "本所";
    monthlyWhere = { storeCode: user.storeCode, month, ...notOthersDraft };
  } else {
    // 部主管：只顯示待部主管審核的案件
    unresolvedWhere = { status: STATUS.PENDING_BUZHUGUAN };
    unresolvedTitle = "待審核案件";
    unresolvedHint = "待部長審核";
    subtitle = "部長";
    monthlyWhere = null;
  }

  // 本月申請明細可另外用特案類型篩選（跟部長待審案件頁一致的下拉複選）
  if (monthlyWhere && selectedCategoryIds) {
    monthlyWhere = { ...monthlyWhere, categoryId: { in: selectedCategoryIds } };
  }

  // 部主管的待審核案件已獨立成「/queue」頁籤，首頁不再重複顯示
  const showUnresolvedHere = user.role !== ROLE.BUZHUGUAN;

  const [unresolved, monthly, categories] = await Promise.all([
    showUnresolvedHere
      ? prisma.case.findMany({
          where: unresolvedWhere,
          include: caseInclude,
          orderBy: { submittedAt: "desc" },
        })
      : Promise.resolve([]),
    monthlyWhere
      ? prisma.case.findMany({
          where: monthlyWhere,
          include: caseInclude,
          orderBy: { submittedAt: "desc" },
        })
      : Promise.resolve([]),
    monthlyWhere ? prisma.caseCategory.findMany({ orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
  ]);

  const canAdd = user.role === ROLE.KEZHANG || user.role === ROLE.SUOZHANG;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-800">您好，{user.name}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {canAdd && (
          <Link
            href="/cases/new"
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            + 新增申請
          </Link>
        )}
      </div>

      {user.role === ROLE.BUZHUGUAN && <DashboardStats month={month} />}

      {showUnresolvedHere && (
        <section>
          <h2 className="section-title">
            {unresolvedTitle}{" "}
            <span className="text-blue-600">({unresolved.length})</span>
            <span className="text-xs text-slate-400 font-normal ml-2">
              {unresolvedHint}
            </span>
          </h2>
          <SortableCaseTable rows={unresolved.map(toRow)} emptyText="沒有案件" />
        </section>
      )}

      {monthlyWhere && (
        <section className="space-y-3">
          <h2 className="section-title">
            {scopeName}本月申請明細 · {month}{" "}
            <span className="text-blue-600">({monthly.length})</span>
          </h2>
          <form className="flex flex-wrap items-center gap-2">
            <MultiSelectDropdown
              label="特案類型"
              name="categoryIds"
              groupName="dashboard-filters"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              查詢
            </button>
          </form>
          <SortableCaseTable
            rows={monthly.map(toRow)}
            emptyText="本月尚無申請"
            showTotals
          />
        </section>
      )}
    </div>
  );
}
