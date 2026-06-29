/** Dependency-free SVG charts for the dashboard. */

export const CHART_COLORS = ["#b58a36", "#2c5d63", "#3f6b52", "#a23b30", "#876214", "#3c5a82", "#7a5da8"];

export interface Datum {
  label: string;
  value: number;
}

/** Line/area chart — good for trends over time. */
export function LineChart({ data }: { data: Datum[] }) {
  const W = 340;
  const H = 170;
  const pad = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="muted">No data.</p>;

  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const x = (i: number) => pad + i * stepX;
  const y = (v: number) => pad + innerH - (v / max) * innerH;

  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${pad + innerH} L${pad},${pad + innerH} Z`;

  return (
    <div className="line-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Applications over time">
        {/* baseline + midline */}
        <line x1={pad} y1={pad + innerH} x2={W - pad} y2={pad + innerH} className="lc-axis" />
        <line x1={pad} y1={pad + innerH / 2} x2={W - pad} y2={pad + innerH / 2} className="lc-grid" />
        <path d={area} className="lc-area" />
        <path d={line} className="lc-line" />
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={3.5} className="lc-dot" />
        ))}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="lc-x">
            {d.label}
          </text>
        ))}
        {data.map((d, i) => (
          <text key={`v${i}`} x={x(i)} y={y(d.value) - 8} textAnchor="middle" className="lc-v">
            {d.value}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Horizontal bar chart — good for grant labels. */
export function BarChart({ data, format = (n) => n.toLocaleString() }: { data: Datum[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="muted">No data.</p>;
  return (
    <div className="bars">
      {data.map((d, i) => (
        <div className="bar-row" key={d.label + i}>
          <span className="bar-label">{d.label}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(d.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
          </div>
          <span className="bar-value">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Pie chart with legend. */
export function PieChart({ data }: { data: Datum[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 90;
  const cy = 90;
  const r = 85;

  if (total === 0) return <p className="muted">No applications yet.</p>;

  let acc = 0;
  const slices = data.map((d, i) => {
    const frac = d.value / total;
    const start = acc * 360;
    acc += frac;
    const end = acc * 360;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    let path: JSX.Element;
    if (frac >= 0.9999) {
      path = <circle cx={cx} cy={cy} r={r} fill={color} />;
    } else {
      const [sx, sy] = polar(cx, cy, r, start);
      const [ex, ey] = polar(cx, cy, r, end);
      const large = end - start > 180 ? 1 : 0;
      path = <path d={`M${cx},${cy} L${sx},${sy} A${r},${r} 0 ${large} 1 ${ex},${ey} Z`} fill={color} />;
    }
    return <g key={d.label + i}>{path}</g>;
  });

  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="Applications by grant">
        {slices}
      </svg>
      <ul className="pie-legend">
        {data.map((d, i) => (
          <li key={d.label + i}>
            <span className="legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {d.label} <strong>{d.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
