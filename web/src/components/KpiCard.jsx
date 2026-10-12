/**
 * KpiCard — the dashboard KPI tile, shared app-wide.
 *
 *   <div className="dash-kpis">
 *     <KpiCard icon={ScanLine} tint={3} value={1204} label="Scans"
 *              hint="across 12 exams" i={1}
 *              delta={{ cls: 'is-up', icon: 'up', text: '+4.2 pts' }}
 *              spark={[3, 8, 5, 12]} sparkColor="var(--green-600)" />
 *   </div>
 *
 * Tint is the --gc-N group palette (1–8). Values roll via AnimatedNumber;
 * pass `raw` for non-numeric figures ("12/40"). `to` renders the tile as a
 * router Link and reveals the corner arrow on hover. Pointer tilt + sheen
 * are built in and respect prefers-reduced-motion.
 */
import { Link } from 'react-router-dom';
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber.jsx';
import Sparkline from './Sparkline.jsx';
import { prefersReducedMotion } from '../lib/gsapSetup.js';

/** Pointer-tracked tilt — writes --rx/--ry for the transform and --mx/--my
 *  for the radial sheen in app.css. */
const tilt = prefersReducedMotion() ? {} : {
  onMouseMove(e) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-py * 5).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(px * 6).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
  },
  onMouseLeave(e) {
    e.currentTarget.style.removeProperty('--rx');
    e.currentTarget.style.removeProperty('--ry');
  },
};

const DELTA_ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus };

export default function KpiCard({
  icon: Icon, tint = 2, value, suffix, decimals, raw, label, hint,
  delta, spark, sparkColor, cumulative, hero, to, i = 0, ...rest
}) {
  const Tag = to ? Link : 'div';
  const DeltaIcon = delta?.icon ? DELTA_ICONS[delta.icon] : null;
  return (
    <Tag
      to={to}
      className={`dash-kpi${hero ? ' is-hero' : ''}`}
      style={{ '--i': i }}
      {...tilt}
      {...rest}
    >
      <span className="dash-kpi-top">
        <span className={`dash-kpi-icon tint-${tint}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
        {to && <ArrowUpRight size={15} className="dash-kpi-arrow" />}
      </span>
      <span className="dash-kpi-num">
        <strong>
          {raw != null ? raw : <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />}
        </strong>
        {delta && (
          <span className={`dash-delta ${delta.cls}`} title={delta.title}>
            {DeltaIcon && <DeltaIcon size={11} />}
            {delta.text}
          </span>
        )}
      </span>
      <span className="dash-kpi-label">{label}</span>
      {hint && <small>{hint}</small>}
      {spark?.length > 0 && (
        <Sparkline points={spark} color={sparkColor} cumulative={cumulative} />
      )}
    </Tag>
  );
}
