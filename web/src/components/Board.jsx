/**
 * Board — Monday-style board primitives layered on the shared .dataset grid.
 *
 *   <StatusPill status="live" />          tinted status pill for a grid cell
 *   <StatCard icon tint value label />    KPI card for .stats-grid rows
 *   <BoardGroupHead />                    collapsible coloured group band (tr)
 *   <BoardAddRow />                       "+ Add" affordance row (tr)
 *   groupColor(key)                       deterministic accent per entity
 *   statusOf(value)                       canonical tone for a raw status
 *   statusMeta(counts, order)             "2 published · 1 draft" rollup text
 *
 * Everything renders inside a plain <table className="grid datatable">: a
 * group is a <tbody className="b-group"> whose first row is a BoardGroupHead,
 * so collapsing, colouring and summarising stay CSS-only off that wrapper.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Plus } from 'lucide-react';

/* Canonical tone for every status used by the API. Maps to --st-* tokens. */
const STATUS_TONES = {
  draft: 'draft', pending: 'pending',
  live: 'live', active: 'active', finalized: 'finalized', processed: 'processed',
  published: 'published',
  rejected: 'rejected', failed: 'failed',
  archived: 'archived', review: 'review', none: 'none',
};

export const STATUS_LABELS = {
  draft: 'Draft',
  live: 'Live',
  published: 'Published',
  archived: 'Archived',
  active: 'Active',
  rejected: 'Rejected',
  finalized: 'Finalized',
  pending: 'Pending',
  processed: 'Processed',
  failed: 'Failed',
  review: 'In review',
  none: '—',
};

/* Order used by summary strips and status grouping. */
export const STATUS_ORDER = {
  exam: ['live', 'published', 'draft', 'archived'],
  question: ['active', 'draft', 'rejected'],
  tos: ['finalized', 'draft'],
  material: ['processed', 'pending', 'failed'],
};

/** Canonical tone for a raw status value (falls back to 'none'). */
export function statusOf(value) {
  return STATUS_TONES[String(value || '').toLowerCase()] || 'none';
}

/** Deterministic board accent for an entity key — a subject keeps its colour. */
export function groupColor(key) {
  const str = String(key ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `var(--gc-${(hash % 8) + 1})`;
}

/** Tinted status pill for a grid cell. `tone` may differ from label. */
export function StatusPill({ status, label, small = false, inline = false }) {
  const tone = statusOf(status);
  return (
    <span className={`b-status${small ? ' b-status--sm' : ''}${inline ? ' b-status--inline' : ''}`} data-tone={tone}>
      {label || STATUS_LABELS[tone] || '—'}
    </span>
  );
}

/** Coloured dot + label used to mark the group a row belongs to. */
export function GroupChip({ color, children, ...rest }) {
  return (
    <span className="b-chip" style={{ '--gc': color }} {...rest}><span>{children}</span></span>
  );
}

/**
 * KPI stat card — the shared app.css `.stat-card` anatomy: tinted icon chip
 * pinned top-right, big tabular number, label. Render inside .stats-grid.
 */
export function StatCard({ icon: Icon, tint = 'blue', value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tint}`}><Icon size={18} aria-hidden="true" /></div>
      <div className="stat-info">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

/**
 * Collapsible group band. Render as the first row of a tbody.b-group;
 * `colSpan` must cover every column in the table.
 */
export function BoardGroupHead({ color, title, count, meta, colSpan, collapsed, onToggle }) {
  return (
    <tr className="b-group-head">
      <td colSpan={colSpan}>
        <button
          type="button"
          className="b-group-toggle"
          style={{ '--gc': color }}
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <span className="b-group-caret" aria-hidden="true"><ChevronDown /></span>
          <span className="b-group-name">{title}</span>
          {count != null && <span className="b-group-count">{count}</span>}
          {meta && <span className="b-group-meta">{meta}</span>}
        </button>
      </td>
    </tr>
  );
}

/**
 * Compact status rollup for a group head's `meta` slot:
 * "2 published · 1 draft" in canonical order, zero tones skipped.
 */
export function statusMeta(counts, order) {
  return order
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${(STATUS_LABELS[k] || k).toLowerCase()}`)
    .join(' · ');
}

/** "+ Add" affordance row, matching the group's left spine. */
export function BoardAddRow({ colSpan, label = 'Add item', onClick, href, as: LinkComponent }) {
  const content = (
    <button type="button" className="b-add" onClick={onClick}>
      <Plus aria-hidden="true" /> {label}
    </button>
  );
  return (
    <tr className="b-add-row">
      <td colSpan={colSpan}>
        {LinkComponent && href
          ? <LinkComponent to={href} className="b-add"><Plus size={14} aria-hidden="true" /> {label}</LinkComponent>
          : content}
      </td>
    </tr>
  );
}

/**
 * The one action that moves a row on (adaptive lists). `step` is
 * { label, to, icon?, done?, warn?, hint? }; `block` is the full-width card
 * version with a trailing arrow.
 */
export function NextStepLink({ step, block = false }) {
  const Icon = step.icon || ArrowRight;
  return (
    <Link
      to={step.to}
      className={`row-next${step.done ? ' is-done' : ''}${step.warn ? ' is-warn' : ''}${block ? ' is-block' : ''}`}
      data-step={step.key}
      title={step.hint}
    >
      <Icon size={14} aria-hidden="true" />
      <span>{step.label}</span>
      {block && <ArrowRight size={14} aria-hidden="true" className="row-next-arrow" />}
    </Link>
  );
}

/** Collapsible group of cards (adaptive lists below 768px). */
export function CardGroup({ title, color, count, collapsed, onToggle, children }) {
  return (
    <section className="row-card-group" style={{ '--gc': color }}>
      <button type="button" className="row-card-group-head" aria-expanded={!collapsed} onClick={onToggle}>
        <ChevronDown size={15} aria-hidden="true" className="row-card-caret" />
        <span className="row-card-group-name">{title}</span>
        {count != null && <span className="b-group-count">{count}</span>}
      </button>
      {!collapsed && children}
    </section>
  );
}
