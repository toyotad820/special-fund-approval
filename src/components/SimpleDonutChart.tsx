// 比例圖（甜甜圈圖）：呈現各類別佔整體的比例。依 dataviz 規範，多序列（≥2）用
// 固定順序的分類色，並附圖例與直接標示百分比（不可只靠顏色辨識）。
export type DonutDatum = { label: string; value: number };

// 分類色（固定順序，不循環新增色相）
const CATEGORICAL = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#e87ba4", // magenta
  "#eb6834", // orange
];

export default function SimpleDonutChart({
  data,
  size = 160,
  thickness = 26,
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  if (data.length === 0 || total === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">本月尚無資料</p>;
  }

  let offsetAcc = 0;

  return (
    <div className="flex items-center gap-6 flex-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0 -rotate-90"
        role="img"
        aria-label="各類別金額佔比甜甜圈圖"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e1e0d9"
          strokeWidth={thickness}
        />
        {data.map((d, i) => {
          const frac = d.value / total;
          if (frac <= 0) return null;
          const dash = frac * circumference;
          const gap = circumference - dash;
          // 區塊間留 2px 分隔縫
          const strokeDasharray = `${Math.max(0, dash - 2)} ${gap + 2}`;
          const strokeDashoffset = -offsetAcc;
          offsetAcc += dash;
          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={CATEGORICAL[i % CATEGORICAL.length]}
              strokeWidth={thickness}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
      </svg>
      <ul className="space-y-1.5 text-sm min-w-[140px]">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
            />
            <span className="text-slate-600 truncate">{d.label}</span>
            <span className="ml-auto font-semibold text-slate-800 tabular-nums">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
