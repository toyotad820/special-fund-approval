"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABEL, STATUS_STYLE, STATUS } from "@/lib/constants";
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
  submittedAt: string; // ISO
  status: string;
};

type ColType = "text" | "number" | "date" | "status";
type Col = { key: keyof CaseRowData; label: string; type: ColType };

const COLUMNS: Col[] = [
  { key: "orderNo", label: "訂單編號", type: "text" },
  { key: "month", label: "月份", type: "text" },
  { key: "plateName", label: "領牌名稱", type: "text" },
  { key: "categoryName", label: "特案類別", type: "text" },
  { key: "categoryNo", label: "類別編號", type: "text" },
  { key: "carModel", label: "車名", type: "text" },
  { key: "subsidyDeptCourse", label: "所課支援金", type: "number" },
  { key: "goldMedal", label: "金牌", type: "number" },
  { key: "silverMedal", label: "銀牌", type: "number" },
  { key: "discountTotal", label: "折讓總額", type: "number" },
  { key: "specialSubsidy", label: "特案支援金額", type: "number" },
  { key: "description", label: "特案內容說明", type: "text" },
  { key: "submitterName", label: "送單人", type: "text" },
  { key: "submittedAt", label: "送出時間", type: "date" },
  { key: "status", label: "審核狀態", type: "status" },
];

// 狀態排序權重
const STATUS_ORDER: Record<string, number> = {
  [STATUS.PENDING_SUOZHANG]: 1,
  [STATUS.PENDING_BUZHUGUAN]: 2,
  [STATUS.REJECTED]: 3,
  [STATUS.WITHDRAWN]: 4,
  [STATUS.APPROVED]: 5,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SortableCaseTable({
  rows,
  emptyText = "目前沒有案件",
}: {
  rows: CaseRowData[];
  emptyText?: string;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<keyof CaseRowData>("submittedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    const type = col?.type ?? "text";
    const arr = [...rows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (type === "number") {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      } else if (type === "date") {
        cmp = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      } else if (type === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]), "zh-Hant");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

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
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-max text-sm">
        <thead className="bg-slate-100 sticky top-0">
          <tr>
            {COLUMNS.map((c) => {
              const active = c.key === sortKey;
              return (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`px-3 py-2 text-left font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-slate-200 ${
                    active ? "text-blue-700" : "text-slate-600"
                  } ${c.type === "number" ? "text-right" : ""}`}
                  title="點擊排序"
                >
                  {c.label}
                  <span className="ml-1 text-xs">
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
              className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer"
            >
              {COLUMNS.map((c) => {
                const v = r[c.key];
                if (c.type === "status") {
                  return (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      <span
                        className={`text-xs font-medium rounded-full px-2 py-0.5 ${STATUS_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                  );
                }
                if (c.type === "number") {
                  return (
                    <td key={c.key} className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-slate-800">
                      {money(v as number)}
                    </td>
                  );
                }
                if (c.type === "date") {
                  return (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap text-slate-600">
                      {fmtDateTime(v as string)}
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
      </table>
    </div>
  );
}
