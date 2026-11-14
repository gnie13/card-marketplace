import { fmtDay } from "@/lib/util";

type Pt = { d: string; v: number };

export function Spark({ pts, w = 120, h = 30 }: { pts: Pt[]; w?: number; h?: number }) {
  if (pts.length < 2) return <span className="mute mono small">1 price point</span>;
  const vs = pts.map((p) => p.v);
  const mn = Math.min(...vs);
  const r = Math.max(...vs) - mn || 1;
  const xy = pts.map((p, i) => [4 + (i * (w - 8)) / (pts.length - 1), 4 + (h - 8) * (1 - (p.v - mn) / r)]);
  const d = xy.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const e = xy[xy.length - 1];
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Price trend over ${pts.length} updates`}>
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={e[0]} cy={e[1]} r="3.5" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2" />
    </svg>
  );
}

export function LineChart({ pts, fmt }: { pts: Pt[]; fmt: (n: number) => string }) {
  const W = 640, H = 180, pl = 6, pr = 6, pt = 18, pb = 22;
  const vs = pts.map((p) => p.v);
  const mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const X = (i: number) => pl + (i * (W - pl - pr)) / (pts.length - 1);
  const Y = (v: number) => pt + (H - pt - pb) * (1 - (v - mn) / r);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const L = pts.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Line chart from ${fmt(pts[0].v)} to ${fmt(pts[L].v)}`}>
      <line x1={pl} x2={W - pr} y1={Y(mx)} y2={Y(mx)} stroke="var(--hair)" />
      <line x1={pl} x2={W - pr} y1={Y(mn)} y2={Y(mn)} stroke="var(--hair)" />
      <text x={pl} y={Y(mx) - 5}>{fmt(mx)}</text>
      {mx !== mn && <text x={pl} y={Y(mn) - 5}>{fmt(mn)}</text>}
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={X(L)} cy={Y(pts[L].v)} r="4" fill="var(--ink)" stroke="var(--paper)" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={p.d} cx={X(i)} cy={Y(p.v)} r="9" fill="transparent">
          <title>{`${fmtDay(p.d)}: ${fmt(p.v)}`}</title>
        </circle>
      ))}
      <text x={pl} y={H - 6}>{fmtDay(pts[0].d)}</text>
      <text x={W - pr} y={H - 6} textAnchor="end">{fmtDay(pts[L].d)}</text>
    </svg>
  );
}

export function BarChart({ rows, fmt, label }: { rows: Pt[]; fmt: (n: number) => string; label: string }) {
  const W = 640, H = 170, pl = 6, pt = 18, pb = 22;
  const max = Math.max(...rows.map((r) => r.v), 0);
  const bw = (W - pl * 2) / rows.length;
  const base = H - pb;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={pl} x2={W - pl} y1={pt} y2={pt} stroke="var(--hair)" />
      <text x={pl} y={pt - 5}>{max ? fmt(max) : "No activity yet"}</text>
      {rows.map((r, i) => {
        const x = pl + i * bw + 1, w = Math.max(2, bw - 2);
        const h = max ? (r.v / max) * (base - pt) : 0;
        const y = base - h, rr = Math.min(4, w / 2, h);
        return (
          <g key={r.d}>
            {h < 1 ? (
              <rect x={x} y={base - 1} width={w} height={1} fill="var(--hair)" />
            ) : (
              <path d={`M${x} ${base}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${base}Z`} fill="var(--ink)" />
            )}
            <rect x={pl + i * bw} y={pt} width={bw} height={base - pt} fill="transparent">
              <title>{`${fmtDay(r.d)}: ${fmt(r.v)}`}</title>
            </rect>
          </g>
        );
      })}
      <line x1={pl} x2={W - pl} y1={base} y2={base} stroke="var(--mute)" />
      <text x={pl} y={H - 6}>{fmtDay(rows[0].d)}</text>
      <text x={W - pl} y={H - 6} textAnchor="end">{fmtDay(rows[rows.length - 1].d)}</text>
    </svg>
  );
}
