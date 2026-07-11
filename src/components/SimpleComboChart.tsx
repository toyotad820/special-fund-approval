// 堆疊長條＋折線複合圖：長條（左軸）依特案類別堆疊呈現金額總和（顏色與甜甜圈圖一致），
// 折線（右軸）呈現平均金額。兩軸量級不同，各自標色與座標軸區分，並附圖例。
import { CATEGORICAL } from "@/lib/chartColors";

export type StackedComboDatum = { label: string; segments: number[]; line: number };

const LINE_COLOR = "#eb6834"; // orange，與長條明顯區隔

export default function SimpleComboChart({
  data,
  seriesNames,
  lineLabel = "平均金額",
  width = 360,
  height = 260,
  barFormatter = (n: number) => n.toLocaleString("en-US"),
  lineFormatter = (n: number) => n.toLocaleString("en-US"),
}: {
  data: StackedComboDatum[];
  seriesNames: string[];
  lineLabel?: string;
  width?: number;
  height?: number;
  barFormatter?: (n: number) => string;
  lineFormatter?: (n: number) => string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">本月尚無資料</p>;
  }

  const padding = { top: 28, right: 48, bottom: 34, left: 54 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const totals = data.map((d) => d.segments.reduce((s, v) => s + v, 0));
  const maxBar = Math.max(1, ...totals) * 1.15;
  const maxLine = Math.max(1, ...data.map((d) => d.line)) * 1.15;

  const bandW = plotW / data.length;
  const barW = Math.min(36, bandW * 0.5);

  const xCenter = (i: number) => padding.left + bandW * i + bandW / 2;
  const yBar = (v: number) => padding.top + plotH - (v / maxBar) * plotH;
  const yLine = (v: number) => padding.top + plotH - (v / maxLine) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${yLine(d.line)}`)
    .join(" ");

  const ticks = 4;

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600 mb-2">
        {seriesNames.map((name, i) => (
          <span key={name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
            />
            {name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: LINE_COLOR }} />
          {lineLabel}
        </span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`各所金額總和（依特案類別堆疊）與${lineLabel}長條折線複合圖`}
      >
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const gy = padding.top + (plotH / ticks) * i;
          const val = maxBar * (1 - i / ticks);
          return (
            <g key={`l${i}`}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={gy}
                y2={gy}
                stroke="#e1e0d9"
                strokeWidth={1}
              />
              <text x={padding.left - 8} y={gy + 3} textAnchor="end" fontSize={9} fill="#898781">
                {barFormatter(Math.round(val))}
              </text>
            </g>
          );
        })}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const gy = padding.top + (plotH / ticks) * i;
          const val = maxLine * (1 - i / ticks);
          return (
            <text
              key={`r${i}`}
              x={width - padding.right + 8}
              y={gy + 3}
              textAnchor="start"
              fontSize={9}
              fill={LINE_COLOR}
            >
              {lineFormatter(Math.round(val))}
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

        {data.map((d, i) => {
          const x = xCenter(i) - barW / 2;
          let acc = 0;
          return (
            <g key={`${d.label}-bar`}>
              {d.segments.map((v, si) => {
                if (v <= 0) return null;
                const yTop = yBar(acc + v);
                const yBottom = yBar(acc);
                acc += v;
                return (
                  <rect
                    key={`${d.label}-seg-${si}`}
                    x={x}
                    y={yTop}
                    width={barW}
                    height={Math.max(0, yBottom - yTop)}
                    fill={CATEGORICAL[si % CATEGORICAL.length]}
                  />
                );
              })}
            </g>
          );
        })}

        <path d={linePath} fill="none" stroke={LINE_COLOR} strokeWidth={2} />
        {data.map((d, i) => (
          <g key={`${d.label}-pt`}>
            <circle
              cx={xCenter(i)}
              cy={yLine(d.line)}
              r={4}
              fill={LINE_COLOR}
              stroke="#fcfcfb"
              strokeWidth={1.5}
            />
            <text
              x={xCenter(i)}
              y={yLine(d.line) - 9}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill={LINE_COLOR}
            >
              {lineFormatter(d.line)}
            </text>
          </g>
        ))}

        {data.map((d, i) => (
          <text
            key={`${d.label}-x`}
            x={xCenter(i)}
            y={height - padding.bottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill="#52514e"
          >
            {d.label}
          </text>
        ))}

        <text x={padding.left - 44} y={padding.top - 10} fontSize={9} fill="#898781">
          金額總和
        </text>
        <text x={width - padding.right + 2} y={padding.top - 10} fontSize={9} fill={LINE_COLOR}>
          {lineLabel}
        </text>
      </svg>
    </div>
  );
}
