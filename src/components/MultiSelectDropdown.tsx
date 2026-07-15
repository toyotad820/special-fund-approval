"use client";

import { useEffect, useRef } from "react";

// 下拉式核取方塊多選元件：外層用 <details> 做開合，不需要額外的 JS 狀態；
// 「全部」是清單第一個選項，勾選它會連動全選/全不選其餘選項。
// 同一個 groupName 的多個下拉選單會互斥開合（原生 <details name> 行為），
// 並在點擊外部時自動收合，避免遮住下方表格或彼此重疊。
export default function MultiSelectDropdown({
  label,
  name,
  options,
  defaultSelectAll = true,
  groupName,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultSelectAll?: boolean;
  groupName?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const allRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
        detailsRef.current.open = false;
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  function syncAll(checked: boolean) {
    const boxes = detailsRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-item]'
    );
    boxes?.forEach((b) => (b.checked = checked));
  }

  function onItemChange() {
    const boxes = detailsRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"][data-item]'
    );
    const allChecked = boxes ? [...boxes].every((b) => b.checked) : false;
    if (allRef.current) allRef.current.checked = allChecked;
  }

  return (
    <details ref={detailsRef} name={groupName} className="relative">
      <summary className="input inline-flex items-center gap-1.5 cursor-pointer select-none w-auto list-none [&::-webkit-details-marker]:hidden">
        {label}
        <span className="text-slate-400">▾</span>
      </summary>
      <div className="absolute z-30 mt-1 w-56 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg p-2 space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer border-b border-slate-100 mb-1">
          <input
            ref={allRef}
            type="checkbox"
            defaultChecked={defaultSelectAll}
            onChange={(e) => syncAll(e.target.checked)}
            className="rounded"
          />
          全部
        </label>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2 text-sm text-slate-700 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              data-item
              defaultChecked={defaultSelectAll}
              onChange={onItemChange}
              className="rounded"
            />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}
