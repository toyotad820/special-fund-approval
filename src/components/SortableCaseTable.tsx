"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, STATUS_STYLE, STATUS_DOT, STATUS } from "@/lib/constants";
import { money } from "@/lib/format";

export type CaseRowData = {
  id: string;
  orderNo: string;
  month: string;
  plateName: string;
  categoryName: string;
  categoryNo: string;
  carModel: string;
  subsidyDeptCourse: number;
  goldMedal: number;
  silverMedal: number;
  discountTotal: number;
  specialSubsidy: number;
  description: string;
  submitterName: string;
  submittedAt: string; // ISO（保留供預設排序用，不顯示為欄位）
  status: string;
  rejectedByRole?: string | null; // 駁回關卡（所長／部主管）
};

type ColType = "text" | "number" | "status";
type Col = { key: keyof CaseRowData; label: string; type: ColType; width?: number };

// 審核狀態擺第一欄；不含送單人、送出時間、月份
const COLUMNS: Col[] = [
  { key: "status", label: "審核狀態", type: "status" },
  { key: "orderNo", label: "訂單編號", type: "text" },
  { key: "plateName", label: "領牌名稱", type: "text" },
  { key: "categoryName", label: "特案類別", type: "text" },
  { key: "categoryNo", label: "類別編號", type: "text" },
  { key: "carModel", label: "車名", type: "text" },
  { key: "subsidyDeptCourse", label: "所課支援金", type: "number", width: 96 },
  { key: "goldMedal", label: "金牌", type: "number" },
  { key: "silverMedal", label: "銀牌", type: "number" },
  { key: "discountTotal", label: "折讓總額", type: "number" },
  { key: "specialSubsidy", label: "特案支援金額", type: "number" },
  { key: "description", label: "特案內容說明", type: "text" },
];

const NUMBER_KEYS = COLUMNS.filter((c) => c.type === "number").map((c) => c.key);

const STATUS_ORDER: Record<string, number> = {
  [STATUS.DRAFT]: 0,
  [STATUS.PENDING_SUOZHANG]: 1,
  [STATUS.PENDING_BUZHUGUAN]: 2,
  [STATUS.REJECTED]: 3,
  [STATUS.WITHDRAWN]: 4,
  [STATUS.APPROVED]: 5,
};

export default function SortableCaseTable({
  rows,
  emptyText = "目前沒有案件",
  showTotals = false,
}: {
  rows: CaseRowData[];
  emptyText?: string;
  showTotals?: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<keyof CaseRowData | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows; // 預設維持伺服器排序（送出時間新→舊）
    const col = COLUMNS.find((c) => c.key === sortKey);
    const type = col?.type ?? "text";
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (type === "number") {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      } else if (type === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "zh-Hant");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const k of NUMBER_KEYS) t[k] = 0;
    for (const r of rows) for (const k of NUMBER_KEYS) t[k] += r[k] as number;
    return t;
  }, [rows]);

  function toggleSort(key: keyof CaseRowData) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">{emptyText}</p>;
  }

  return (
    <div className="overflow-auto max-h-[26rem] rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <table className="min-w-max text-sm">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr className="border-b border-slate-200">
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
                  className={`px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors ${
                    active ? "text-blue-700" : "text-slate-500"
                  } ${c.type === "number" ? "text-right" : ""}`}
                  title="點擊排序"
                >
                  {c.label}
                  <span className={`ml-1 ${active ? "text-blue-500" : "text-slate-300"}`}>
                    {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.id}
              onClick={() => router.push(`/cases/${r.id}`)}
              className="border-t border-slate-100 even:bg-slate-50/40 hover:bg-blue-50/70 cursor-pointer transition-colors"
            >
              {COLUMNS.map((c) => {
                const v = r[c.key];
                if (c.type === "status") {
                  return (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5 ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? "bg-slate-400"}`}
                        />
                        {r.status === STATUS.REJECTED && r.rejectedByRole
                          ? `${r.rejectedByRole}駁回`
                          : STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  );
                }
                if (c.type === "number") {
                  return (
                    <td
                      key={c.key}
                      style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
                      className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-slate-800"
                    >
                      {money(v as number)}
                    </td>
                  );
                }
                if (c.key === "orderNo") {
                  return (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap font-mono font-medium text-blue-700">
                      {v as string}
                    </td>
                  );
                }
                if (c.key === "description") {
                  return (
                    <td key={c.key} className="px-3 py-2 max-w-[220px] truncate text-slate-600" title={v as string}>
                      {v as string}
                    </td>
                  );
                }
                return (
                  <td key={c.key} className="px-3 py-2 whitespace-nowrap text-slate-800">
                    {v as string}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {showTotals && (
          <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold">
            <tr>
              {COLUMNS.map((c, i) => {
                if (c.type === "number") {
                  return (
                    <td
                      key={c.key}
                      style={c.width ? { width: c.width, maxWidth: c.width } : undefined}
                      className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-slate-900"
                    >
                      {money(totals[c.key])}
                    </td>
                  );
                }
                return (
                  <td key={c.key} className="px-3 py-2 whitespace-nowrap text-slate-700">
                    {i === 0 ? `合計 ${rows.length} 筆` : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
