/**
 * Blueprint list helpers — how far a blueprint's plan is filled and the one
 * next step that moves it on. Fields come from GET /api/tos:
 *   status, topic_count, total_items,
 *   banked  — planned items covered by live questions (drafts count),
 *   missing — planned items still to generate (per topic × Bloom cell),
 *   ready   — planned items exam assembly may pick (approved + cleared),
 *   exam_count, published_count.
 * All counts are per cell server-side, so they match the blueprint page.
 */

export const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
export const BLOOM_LABELS = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};

const num = (v) => Math.max(0, Number(v) || 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Coverage split into what the bar draws: ready (approved), pending
 * (covered but not yet assemblable — drafts or unchecked), and missing.
 * `state` is the headline: none | short | review | ready.
 */
export function blueprintCoverage(t) {
  const total = num(t.total_items);
  const covered = Math.min(num(t.banked), total);
  const ready = Math.min(num(t.ready), covered);
  const missing = Math.min(num(t.missing ?? total - covered), total);
  const pending = covered - ready;
  const state = !num(t.topic_count) || !total ? 'none'
    : missing > 0 ? 'short'
      : pending > 0 ? 'review'
        : 'ready';
  return { total, covered, ready, pending, missing, state };
}

/** Short caption for the coverage cell. */
export function coverageCaption(cov) {
  if (cov.state === 'none') return 'No topics yet';
  if (cov.state === 'short') return `${cov.missing} to generate`;
  if (cov.state === 'review') return `${cov.pending} to approve`;
  return 'All approved';
}

/** The one action that moves this blueprint forward. */
export function blueprintNextStep(t) {
  const detail = `/tos/${t.id}`;
  const cov = blueprintCoverage(t);
  if (!num(t.topic_count)) return { key: 'topics', label: 'Add topics', to: detail };
  if (t.status !== 'finalized') return { key: 'finalize', label: 'Finalize', to: detail };
  if (cov.missing > 0) return { key: 'generate', label: `Generate ${cov.missing}`, hint: `Generate the ${cov.missing} missing items`, to: detail };
  if (cov.pending > 0) {
    const to = t.subject_id ? `/questions/review?subject_id=${encodeURIComponent(t.subject_id)}` : '/questions/review';
    return { key: 'review', label: `Approve ${cov.pending}`, hint: `Approve the ${cov.pending} drafts still pending`, to };
  }
  const exams = num(t.exam_count);
  if (!exams) return { key: 'exam', label: 'Build exam', to: `/exams/new?tos=${encodeURIComponent(t.id)}` };
  return { key: 'exams', label: `${plural(exams, 'exam')} built`, to: '/exams', done: true };
}

/** Bloom weights as ordered segments; zero-weight levels are kept (width 0). */
export function bloomMix(weights) {
  const w = weights || {};
  return BLOOM_ORDER.map((key, i) => ({ key, label: BLOOM_LABELS[key], level: i + 1, pct: num(w[key]) }));
}
