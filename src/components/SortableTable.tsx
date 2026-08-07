"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import AccStatusBadge from "./AccStatusBadge";

export type SortCol = {
  key: string;
  label: string;
  kind?: "link" | "status" | "date" | "text" | "warn"; // 預設 text；warn=有值時顯示紅字
  align?: "left" | "right" | "center";
  grow?: boolean; // 佔滿剩餘寬度（如更換說明）
  mono?: boolean;
  width?: string; // 限寬（如 "6rem"），超過以 truncate 省略
};

export type SortRow = Record<string, string | number | null> & { href?: string; id?: string };

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
  selectable = false,
  renderBulkActions,
}: {
  columns: SortCol[];
  rows: SortRow[];
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  emptyText?: string;
  minWidth?: number;
  // 開啟後每列前加勾選欄，配合 renderBulkActions 顯示整批操作工具列（rows 需帶 id）
  selectable?: boolean;
  renderBulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;
}) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [dir, setDir] = useState<"asc" | "desc">(defaultSortDir);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
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
  }, [rows, sortKey, dir, columns]);

  const onSort = (k: string) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir("asc");
    }
  };

  const alignCls = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  const selectedIds = [...selected];
  const clearSelection = () => setSelected(new Set());
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === sorted.length
        ? new Set()
        : new Set(sorted.map((r) => r.id).filter((id): id is string => !!id))
    );

  return (
    <div className="space-y-2">
      {selectable && selectedIds.length > 0 && renderBulkActions?.(selectedIds, clearSelection)}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth }}>
          <thead className="bg-slate-50">
            <tr>
              {selectable && (
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === sorted.length}
                    onChange={toggleAll}
                    className="align-middle"
                  />
                </th>
              )}
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
                {selectable && (
                  <td className="px-3 py-2">
                    {r.id && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleRow(r.id!)}
                        className="align-middle"
                      />
                    )}
                  </td>
                )}
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
                  if (c.kind === "warn") {
                    return (
                      <td
                        key={c.key}
                        className={`${base} ${v ? "text-rose-600 font-medium" : "text-slate-300"}`}
                        style={style}
                        title={c.width ? String(v ?? "") : undefined}
                      >
                        {v || "—"}
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
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
