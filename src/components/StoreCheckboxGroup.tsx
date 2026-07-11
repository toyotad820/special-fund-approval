"use client";

import { useRef } from "react";

export default function StoreCheckboxGroup({ stores }: { stores: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  function setAll(checked: boolean) {
    const boxes = containerRef.current?.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    boxes?.forEach((b) => (b.checked = checked));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="label mb-0">所別（可複選）</div>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="text-blue-600 hover:underline"
          >
            全選
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="text-blue-600 hover:underline"
          >
            全不選
          </button>
        </div>
      </div>
      <div ref={containerRef} className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stores.map((s) => (
          <label
            key={s}
            className="flex items-center gap-1.5 text-sm text-slate-700 rounded-lg border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
          >
            <input type="checkbox" name="storeCodes" value={s} defaultChecked className="rounded" />
            {s}
          </label>
        ))}
      </div>
      {stores.length === 0 && <p className="text-sm text-slate-400">尚無所別資料</p>}
    </div>
  );
}
