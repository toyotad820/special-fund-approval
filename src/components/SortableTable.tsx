"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AccStatusBadge from "./AccStatusBadge";

export type SortCol = {
  key: string;
  label: string;
  kind?: "link" | "status" | "date" | "text"; // 預設 text
  align?: "left" | "right" | "center";
  grow?: boolean; // 佔滿剩餘寬度（如更換說明）
  mono?: boolean;
  width?: string; // 限寬（如 "6rem"），超過以 truncate 省略
};

export type SortRow = Record<string, string | number | null> & { href?: string };

function fmtDate(v: string | number | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SortableTable({
  columns,
  rows,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyText = "目前沒有資料",
  minWidth = 640,
}: {
  columns: SortCol[];
  rows: SortRow[];
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  emptyText?: string;
  minWidth?: number;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [dir, setDir] = useState<"asc" | "desc">(defaultSortDir);

  const colOf = (k: string) => columns.find((c) => c.key === k);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = colOf(sortKey);
    const isDate = col?.kind === "date";
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // 空值永遠排最後
      if (av == null || av === "") return 1;
      if (bv == null || bv === "") return -1;
      let cmp: number;
      if (isDate) {
        cmp = new Date(av).getTime() - new Date(bv).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), "zh-Hant", { numeric: true });
      }
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, dir]);

  const onSort = (k: string) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir("asc");
    }
  };

  const alignCls = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => {
                const active = sortKey === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={() => onSort(c.key)}
                    style={c.width ? { maxWidth: c.width, width: c.width } : undefined}
                    className={`text-xs font-semibold px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 transition-colors ${alignCls(c.align)} ${c.grow ? "w-full" : ""} ${active ? "text-blue-600" : "text-slate-500"}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      <span className="text-[9px] leading-none">
                        {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                {columns.map((c) => {
                  const v = r[c.key];
                  const style = c.width ? { maxWidth: c.width, width: c.width } : undefined;
                  const base = `px-3 py-2 text-sm ${alignCls(c.align)} ${c.mono ? "font-mono" : ""} ${c.width ? "truncate" : "whitespace-nowrap"} ${c.grow ? "w-full whitespace-normal" : ""}`;
                  if (c.kind === "link") {
                    return (
                      <td key={c.key} className={base} style={style}>
                        <Link href={r.href || "#"} className={`${c.mono ? "font-mono " : ""}text-blue-600 hover:underline font-semibold`}>
                          {v}
                        </Link>
                      </td>
                    );
                  }
                  if (c.kind === "status") {
                    return (
                      <td key={c.key} className={base} style={style}>
                        <AccStatusBadge status={String(v ?? "")} />
                      </td>
                    );
                  }
                  if (c.kind === "date") {
                    return (
                      <td key={c.key} className={`${base} text-slate-600`} style={style} title={fmtDate(v)}>
                        {fmtDate(v)}
                      </td>
                    );
                  }
                  return (
                    <td key={c.key} className={`${base} text-slate-800`} style={style} title={c.width ? String(v ?? "") : undefined}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-400">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
