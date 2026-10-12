/**
 * DetailsModal — read-only record view in a right-side sheet.
 * Used as the "Read more" / "View details" target wherever list rows truncate
 * text, so the full value is always one click away. `fields` values may be
 * strings, numbers, or JSX (e.g. a StatusPill); empty values are skipped.
 * Field `kind` lifts values out of the list:
 *   'meta'  — pill row under the header (status, subject, format…)
 *   'stat'  — numeric tiles in a KPI strip
 *   'bloom' — weights object rendered as a segmented bar + legend
 *   'block' — long text rendered as a scrollable preformatted panel
 * Anything without `kind` stays a label/value row.
 * Sections stagger in behind the sheet slide so the panel lands composed
 * rather than popping fully-formed.
 */
import { motion, useReducedMotion } from 'motion/react';
import { ScrollText } from 'lucide-react';
import Modal from './Modal.jsx';
import { EASE_ENTER } from '../lib/motion.js';
import { BLOOM_LABELS, BLOOM_ORDER } from '../lib/insights.js';

const BLOOM_COLORS = ['#2383E2', '#1FA9A0', '#7CB342', '#DFA32B', '#DE7634', '#C4576E'];

function Section({ i, reduce, children }) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + i * 0.05, duration: 0.28, ease: EASE_ENTER }}
    >
      {children}
    </motion.div>
  );
}

export default function DetailsModal({ open, title, subtitle, icon, accent, fields = [], onClose }) {
  const reduce = useReducedMotion();
  const rows = fields.filter((f) => f.value !== undefined && f.value !== null && f.value !== '');
  const chips = rows.filter((f) => f.kind === 'meta');
  const stats = rows.filter((f) => f.kind === 'stat');
  const blooms = rows.filter((f) => f.kind === 'bloom');
  const blocks = rows.filter((f) => f.kind === 'block');
  const rest = rows.filter((f) => !f.kind);

  const sections = [];
  if (chips.length) {
    sections.push(
      <div className="detail-chips" key="chips">
        {chips.map((f) =>
          typeof f.value === 'string'
            ? <span className="detail-chip" key={f.label}>{f.value}</span>
            : <span key={f.label}>{f.value}</span>
        )}
      </div>
    );
  }
  if (stats.length) {
    sections.push(
      <div className="detail-stats" key="stats">
        {stats.map((f) => (
          <div className="detail-stat" key={f.label}>
            <strong>{f.value}</strong>
            <span>{f.label}</span>
          </div>
        ))}
      </div>
    );
  }
  blooms.forEach((f) => {
    const segs = BLOOM_ORDER
      .map((k, i) => ({ k, pct: Number(f.value?.[k]) || 0, color: BLOOM_COLORS[i] }))
      .filter((s) => s.pct > 0);
    sections.push(
      <div className="detail-bloom" key={f.label}>
        <div className="detail-bloom-label">{f.label}</div>
        <div className="detail-bloom-bar">
          {segs.map((s) => (
            <span key={s.k} style={{ width: `${s.pct}%`, background: s.color }} />
          ))}
        </div>
        <ul className="detail-bloom-legend">
          {segs.map((s) => (
            <li key={s.k}><i style={{ background: s.color }} />{BLOOM_LABELS[s.k]} <b>{s.pct}%</b></li>
          ))}
        </ul>
      </div>
    );
  });
  if (rest.length) {
    sections.push(
      <dl className="detail-list" key="list">
        {rest.map((f) => (
          <div className="detail-list-row" key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  blocks.forEach((f) => {
    sections.push(
      <div className="detail-block" key={f.label} style={f.accent ? { '--ba': f.accent } : undefined}>
        <div className="detail-block-label">
          {f.label}
          {f.badge && <span className="detail-block-badge">{f.badge}</span>}
        </div>
        <div className="detail-block-body">
          <pre className="detail-block-content">{f.value}</pre>
          {f.onExpand && (
            <div className="detail-block-foot">
              <button type="button" className="detail-expand" onClick={f.onExpand}>
                <ScrollText size={13} /> {f.expandLabel || 'Read full content'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  });

  return (
    <Modal open={open} title={title} subtitle={subtitle} onClose={onClose} side icon={icon} accent={accent}>
      {sections.map((s, i) => <Section key={s.key || i} i={i} reduce={reduce}>{s}</Section>)}
    </Modal>
  );
}
