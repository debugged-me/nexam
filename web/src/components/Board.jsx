/**
 * Board — Monday-style board primitives layered on the shared .dataset grid.
 *
 *   <StatusPill status="live" />          solid state block for a grid cell
 *   <BoardGroupHead />                    collapsible coloured group band (tr)
 *   <BoardGroupFoot />                    segmented status summary strip (tr)
 *   <BoardAddRow />                       "+ Add" affordance row (tr)
 *   groupColor(key)                       deterministic accent per entity
 *   statusOf(value)                       canonical tone for a raw status
 *
 * Everything renders inside a plain <table className="grid datatable">: a
 * group is a <tbody className="b-group"> whose first row is a BoardGroupHead,
 * so collapsing, colouring and summarising stay CSS-only off that wrapper.
 */
import { ChevronDown, Plus } from 'lucide-react';

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

/** Solid status block for a grid cell. `tone` may differ from label. */
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
 * Segmented status strip under a group: counts keyed by canonical tone,
 * rendered in `order` (STATUS_ORDER lists). Hidden tones are skipped.
 */
export function StatusSummary({ counts, order, totalLabel, legend = true }) {
  const total = order.reduce((n, k) => n + (counts[k] || 0), 0);
  if (!total) return null;
  const named = order.filter((k) => counts[k]);
  return (
    <span className="b-sum">
      <span className="b-sum-bar" role="img" aria-label={named.map((k) => `${counts[k]} ${STATUS_LABELS[k] || k}`).join(', ')}>
        {named.map((k) => (
          <span key={k} className="b-sum-seg" data-tone={k} style={{ width: `${(counts[k] / total) * 100}%` }} />
        ))}
      </span>
      <span className="b-sum-total">{totalLabel || `${total} item${total === 1 ? '' : 's'}`}</span>
      {legend && named.length > 1 && (
        <span className="b-sum-legend" aria-hidden="true">
          {named.map((k) => (
            <span key={k}><i data-tone={k} />{counts[k]}</span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Summary row; sits last inside tbody.b-group. */
export function BoardGroupFoot({ colSpan, children }) {
  return (
    <tr className="b-group-foot">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
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
