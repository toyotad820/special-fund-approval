// 散佈圖：同時比較兩個不同量級的指標（例如金額總和 vs 平均金額），
// 避免用雙 Y 軸長條/組合圖（會捏造出不存在的對齊關係）。單一序列，
// 不需圖例，逐點直接標籤（資料點少，適合直接標示）。
export type ScatterDatum = { label: string; x: number; y: number; r?: number };

export default function SimpleScatterChart({
  data,
  xLabel,
  yLabel,
  width = 340,
  height = 260,
  xFormatter = (n: number) => n.toLocaleString("en-US"),
  yFormatter = (n: number) => n.toLocaleString("en-US"),
}: {
  data: ScatterDatum[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  xFormatter?: (n: number) => string;
  yFormatter?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">本月尚無資料</p>;
  }

  const padding = { top: 16, right: 16, bottom: 40, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const xMax = Math.max(1, ...data.map((d) => d.x)) * 1.15;
  const yMax = Math.max(1, ...data.map((d) => d.y)) * 1.15;

  const px = (x: number) => padding.left + (x / xMax) * plotW;
  const py = (y: number) => padding.top + plotH - (y / yMax) * plotH;

  const ticks = 4;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="max-w-full"
      role="img"
      aria-label={`${xLabel}與${yLabel}散佈圖`}
    >
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const gy = padding.top + (plotH / ticks) * i;
        const val = yMax * (1 - i / ticks);
        return (
          <g key={`gy${i}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={gy}
              y2={gy}
              stroke="#e1e0d9"
              strokeWidth={1}
            />
            <text x={padding.left - 8} y={gy + 3} textAnchor="end" fontSize={10} fill="#898781">
              {yFormatter(Math.round(val))}
            </text>
          </g>
        );
      })}
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const gx = padding.left + (plotW / ticks) * i;
        const val = (xMax / ticks) * i;
        return (
          <text
            key={`gx${i}`}
            x={gx}
            y={height - padding.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#898781"
          >
            {xFormatter(Math.round(val))}
          </text>
        );
      })}

      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={height - padding.bottom}
        y2={height - padding.bottom}
        stroke="#c3c2b7"
        strokeWidth={1.5}
      />
      <line
        x1={padding.left}
        x2={padding.left}
        y1={padding.top}
        y2={height - padding.bottom}
        stroke="#c3c2b7"
        strokeWidth={1.5}
      />

      {data.map((d) => {
        const r = d.r ?? 6;
        return (
          <g key={d.label}>
            <circle
              cx={px(d.x)}
              cy={py(d.y)}
              r={r}
              fill="#2a78d6"
              fillOpacity={0.82}
              stroke="#fcfcfb"
              strokeWidth={2}
            />
            <text
              x={px(d.x)}
              y={py(d.y) - r - 5}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="#3f3e3b"
            >
              {d.label}
            </text>
          </g>
        );
      })}

      <text
        x={padding.left + plotW / 2}
        y={height - 2}
        textAnchor="middle"
        fontSize={11}
        fill="#52514e"
      >
        {xLabel}
      </text>
      <text
        x={12}
        y={padding.top + plotH / 2}
        textAnchor="middle"
        fontSize={11}
        fill="#52514e"
        transform={`rotate(-90 12 ${padding.top + plotH / 2})`}
      >
        {yLabel}
      </text>
    </svg>
  );
}
