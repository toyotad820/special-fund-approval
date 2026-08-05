"use client";

import { useState, useMemo, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, STATUS_STYLE, STATUS_DOT, STATUS } from "@/lib/constants";
import { money } from "@/lib/format";

export type CaseRowData = {
  id: string;
  orderNo: string;
  month: string;
  storeDept: string; // 所別/課別，例：D01 / 1
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
type Col = { key: keyof CaseRowData; label: string; type: ColType; width?: number; frozen?: boolean };

// 審核狀態擺第一欄；不含送單人、送出時間、月份
// 前三欄（審核狀態／所別課別／領牌名稱）凍結，橫向捲動時保持可見
const COLUMNS: Col[] = [
  { key: "status", label: "審核狀態", type: "status", width: 82, frozen: true },
  { key: "storeDept", label: "所別/課別", type: "text", width: 78, frozen: true },
  { key: "plateName", label: "領牌名稱", type: "text", width: 110, frozen: true },
  // 特案類別先隱藏
  { key: "categoryNo", label: "類別編號", type: "text", width: 80 },
  { key: "carModel", label: "車名", type: "text", width: 100 },
  { key: "subsidyDeptCourse", label: "所課支援金", type: "number", width: 96 },
  { key: "goldMedal", label: "金牌金額", type: "number", width: 90 },
  { key: "silverMedal", label: "銀牌金額", type: "number", width: 90 },
  { key: "discountTotal", label: "折讓總額", type: "number", width: 96 },
  { key: "specialSubsidy", label: "特案支援金額", type: "number", width: 100 },
  { key: "description", label: "特案內容說明", type: "text" },
];

const NUMBER_KEYS = COLUMNS.filter((c) => c.type === "number").map((c) => c.key);

const CHECKBOX_COL_WIDTH = 40;

// 凍結欄的 left 偏移（累加前面凍結欄的寬度，勾選欄有開才算進去），最後一欄加陰影分隔線
function computeFrozenLeft(withCheckbox: boolean): Map<string, number> {
  const map = new Map<string, number>();
  let acc = withCheckbox ? CHECKBOX_COL_WIDTH : 0;
  for (const c of COLUMNS) {
    if (!c.frozen) continue;
    map.set(c.key, acc);
    acc += c.width ?? 0;
  }
  return map;
}
const LAST_FROZEN_KEY = COLUMNS.filter((c) => c.frozen).map((c) => c.key).pop();

function frozenStyle(c: Col, frozenLeft: Map<string, number>): CSSProperties | undefined {
  if (!c.frozen) return undefined;
  return { left: frozenLeft.get(c.key), width: c.width, maxWidth: c.width };
}

function frozenClass(c: Col, base: string, bg: "bg-white" | "bg-slate-50" = "bg-white"): string {
  if (!c.frozen) return base;
  const shadow = c.key === LAST_FROZEN_KEY ? " shadow-[2px_0_4px_-2px_rgba(0,0,0,0.15)]" : "";
  return `${base} sticky z-[1] ${bg}${shadow}`;
}

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
  selectable = false,
  renderBulkActions,
}: {
  rows: CaseRowData[];
  emptyText?: string;
  showTotals?: boolean;
  // 開啟後每列前加勾選欄，配合 renderBulkActions 顯示整批操作工具列
  selectable?: boolean;
  renderBulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<keyof CaseRowData | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const frozenLeft = useMemo(() => computeFrozenLeft(selectable), [selectable]);

  function toggleRow(id: string, e: MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === sorted.length ? new Set() : new Set(sorted.map((r) => r.id))
    );
  }

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

  const selectedIds = [...selected];
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="space-y-2">
      {selectable && selectedIds.length > 0 && renderBulkActions?.(selectedIds, clearSelection)}
      <div className="overflow-auto max-h-[26rem] rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-max text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              {selectable && (
                <th
                  style={{ left: 0, width: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}
                  className="sticky z-[1] bg-slate-50 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === sorted.length}
                    onChange={toggleAll}
                    className="align-middle"
                  />
                </th>
              )}
              {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  style={c.frozen ? frozenStyle(c, frozenLeft) : c.width ? { width: c.width, maxWidth: c.width } : undefined}
                  className={frozenClass(
                    c,
                    `bg-slate-50 px-3 py-2.5 text-xs font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors ${
                      active ? "text-blue-700" : "text-slate-500"
                    } ${c.type === "number" ? "text-center" : "text-left"}`,
                    "bg-slate-50"
                  )}
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
              {selectable && (
                <td
                  style={{ left: 0, width: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}
                  className="sticky z-[1] bg-white px-3 py-2"
                  onClick={(e) => toggleRow(r.id, e)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => {}}
                    className="align-middle"
                  />
                </td>
              )}
              {COLUMNS.map((c) => {
                const v = r[c.key];
                if (c.type === "status") {
                  return (
                    <td
                      key={c.key}
                      style={c.frozen ? frozenStyle(c, frozenLeft) : c.width ? { width: c.width, maxWidth: c.width } : undefined}
                      className={frozenClass(c, "px-2 py-2 whitespace-nowrap")}
                    >
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}
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
                if (c.key === "description") {
                  return (
                    <td key={c.key} className="px-3 py-2 max-w-[220px] truncate text-slate-600" title={v as string}>
                      {v as string}
                    </td>
                  );
                }
                return (
                  <td
                    key={c.key}
                    style={c.frozen ? frozenStyle(c, frozenLeft) : c.width ? { width: c.width, maxWidth: c.width } : undefined}
                    className={frozenClass(c, "px-3 py-2 whitespace-nowrap text-slate-800 truncate")}
                  >
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
              {selectable && (
                <td
                  style={{ left: 0, width: CHECKBOX_COL_WIDTH, maxWidth: CHECKBOX_COL_WIDTH }}
                  className="sticky z-[1] bg-slate-50 px-3 py-2"
                />
              )}
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
                  <td
                    key={c.key}
                    style={c.frozen ? frozenStyle(c, frozenLeft) : undefined}
                    className={frozenClass(c, "px-3 py-2 whitespace-nowrap text-slate-700", "bg-slate-50")}
                  >
                    {i === 0 ? `合計 ${rows.length} 筆` : ""}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
        </table>
      </div>
    </div>
  );
}
