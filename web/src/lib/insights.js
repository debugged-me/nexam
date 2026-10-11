/**
 * insights.js — pure insight-derivation logic for the analytics dashboards.
 *
 * Turned into a lib module so the rules are unit-testable without React:
 * `buildInsights` returns icon *keys*; the page maps them to Lucide icons.
 */

export const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
export const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
export const LOWER_ORDER = ['remember', 'understand', 'apply'];
export const HIGHER_ORDER = ['analyze', 'evaluate', 'create'];
export const PASS_MARK = 75;

/** Weighted average correct rate across the given Bloom levels (null if none). */
export function bloomGroupRate(blooms, keys) {
  let correct = 0;
  let responses = 0;
  for (const b of blooms || []) {
    if (!keys.includes(b.bloom)) continue;
    correct += Number(b.correct_count || 0);
    responses += Number(b.responses || 0);
  }
  return responses ? (correct / responses) * 100 : null;
}

/**
 * Turn the raw aggregates into narrative insights — the system reads the
 * numbers so the instructor doesn't have to.
 *
 * Input (any subset): themes [{topic, correctRate, responses, items}],
 * bloomLevels [{bloom, correct_count, responses}], trend [{avg_score}],
 * stats {total_scans, passing_count}, setComparison [{set_label, avg_score}],
 * pendingReviews.
 *
 * Output: [{ tone: 'good'|'warn'|'info', icon: string, text: string }]
 */
export function buildInsights({ themes, bloomLevels, trend, stats, setComparison, pendingReviews } = {}) {
  const out = [];
  const usable = (themes || []).filter((t) => Number(t.responses) >= 3);

  if (usable.length) {
    const weakest = usable[0]; // API sorts ascending by correct rate
    const strongest = usable[usable.length - 1];
    const weakFlagged = weakest.correctRate < 60;
    if (weakFlagged) {
      out.push({ tone: 'warn', icon: 'alert', text: `Least-mastered topic: ${weakest.topic} — only ${weakest.correctRate}% correct across ${weakest.responses} responses.` });
    }
    if (strongest.correctRate >= PASS_MARK && (!weakFlagged || strongest.topic !== weakest.topic)) {
      out.push({ tone: 'good', icon: 'check', text: `Strongest topic: ${strongest.topic} — ${strongest.correctRate}% correct.` });
    }
  }

  const lower = bloomGroupRate(bloomLevels, LOWER_ORDER);
  const higher = bloomGroupRate(bloomLevels, HIGHER_ORDER);
  if (lower !== null && higher !== null) {
    const gap = lower - higher;
    if (gap >= 10) {
      out.push({ tone: 'warn', icon: 'layers', text: `Higher-order items (Analyze–Create) run ${Math.round(gap)} pts below lower-order — a reasoning gap, not a recall gap.` });
    } else if (gap <= -10) {
      out.push({ tone: 'good', icon: 'layers', text: `Higher-order items outscore lower-order by ${Math.round(-gap)} pts — students reason well, not just recall.` });
    }
  }

  if (stats && Number(stats.total_scans || 0) > 0) {
    const passRate = (Number(stats.passing_count || 0) / Number(stats.total_scans)) * 100;
    if (passRate < 60) {
      out.push({ tone: 'warn', icon: 'alert', text: `Only ${Math.round(passRate)}% of students reached the ${PASS_MARK}% mark.` });
    } else if (passRate >= PASS_MARK) {
      out.push({ tone: 'good', icon: 'check', text: `${Math.round(passRate)}% of students passed (≥${PASS_MARK}%).` });
    }
  }

  if ((setComparison || []).length >= 2) {
    const [a, b] = setComparison;
    const delta = Number(a.avg_score || 0) - Number(b.avg_score || 0);
    if (Math.abs(delta) >= 8) {
      const hi = delta > 0 ? a : b;
      const lo = delta > 0 ? b : a;
      out.push({ tone: 'warn', icon: 'alert', text: `Set ${hi.set_label} averages ${Number(hi.avg_score).toFixed(1)}% vs Set ${lo.set_label} at ${Number(lo.avg_score).toFixed(1)}% — the parallel sets may not be equivalent.` });
    }
  }

  if ((trend || []).length >= 4) {
    const mid = Math.floor(trend.length / 2);
    const older = trend.slice(0, mid);
    const recent = trend.slice(mid);
    const avg = (rows) => rows.reduce((sum, r) => sum + Number(r.avg_score || 0), 0) / rows.length;
    const delta = avg(recent) - avg(older);
    if (Math.abs(delta) >= 3) {
      out.push({ tone: delta > 0 ? 'good' : 'warn', icon: delta > 0 ? 'up' : 'down', text: `Class scores are trending ${delta > 0 ? 'up' : 'down'} about ${Math.abs(Math.round(delta))} pts over the recent scan days.` });
    }
  }

  if (Number(pendingReviews || 0) > 0) {
    out.push({ tone: 'info', icon: 'info', text: `${pendingReviews} scanned ${Number(pendingReviews) === 1 ? 'sheet is' : 'sheets are'} flagged for review — figures may shift once resolved.` });
  }

  return out;
}
