// 單一數列的水平長條圖（無需分類/圖例）。依 dataviz 規範：單一序列不需圖例，
// 用循序藍（sequential blue #2a78d6）、細長條、圓端、直接標值。
export type BarDatum = { label: string; value: number };

export default function SimpleBarChart({
  data,
  valueFormatter = (n: number) => n.toLocaleString("en-US"),
}: {
  data: BarDatum[];
  valueFormatter?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">本月尚無資料</p>;
  }

  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div
            className="w-16 shrink-0 text-xs text-[#52514e] text-right truncate"
            title={d.label}
          >
            {d.label}
          </div>
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#2a78d6]"
              style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }}
            />
          </div>
          <div className="w-20 shrink-0 text-xs font-semibold text-slate-700 tabular-nums text-right">
            {valueFormatter(d.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
