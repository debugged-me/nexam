/**
 * Sparkline — tiny cumulative area chart for KPI tiles.
 *
 * Renders a daily series as a running total so the line slopes with growth
 * instead of flickering around zero on quiet days. Pure SVG, no chart lib,
 * decorative only (aria-hidden). Gradient color follows the tile's tint.
 */
import { useId } from 'react';

const W = 100;
const H = 34;

export default function Sparkline({ points = [], color = 'var(--accent, #2D93E8)', cumulative = true }) {
  const gid = useId();
  if (!points.length) return null;
  const cum = [];
  if (cumulative === false) {
    points.forEach((v) => cum.push(Number(v || 0)));
  } else {
    points.forEach((v) => cum.push((cum[cum.length - 1] || 0) + Number(v || 0)));
  }
  const lo = cumulative ? 0 : Math.min(...cum);
  const span = Math.max(1, Math.max(...cum) - lo);
  const stepX = W / Math.max(1, cum.length - 1);
  const xy = cum.map((v, i) => [i * stepX, H - 3 - ((v - lo) / span) * (H - 9)]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
