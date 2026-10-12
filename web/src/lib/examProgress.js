/**
 * Exam list helpers — where an exam stands and the one next step that moves
 * it on, in the same order as the exam page's lifecycle rail:
 * assembled → sets generated → published → scanned → reviewed.
 * Fields come from GET /api/exams: question_count, set_count_generated,
 * status, scan_count, review_count, avg_score.
 */

export const PASS_MARK = 75; // same line Results & insights draws

const num = (v) => Math.max(0, Number(v) || 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const isPublished = (e) => e.status === 'published' || e.status === 'live';

export function examNextStep(e) {
  const detail = `/exams/${e.id}`;
  if (!num(e.question_count)) return { key: 'assemble', label: 'Add questions', to: detail };
  if (!num(e.set_count_generated)) return { key: 'sets', label: 'Generate sets', to: detail };
  if (!isPublished(e)) return { key: 'publish', label: 'Publish', to: detail };
  if (!num(e.scan_count)) {
    return { key: 'scan', label: 'Scan sheets', hint: 'Scan the answer sheets with the Nexam mobile app', to: detail };
  }
  const toReview = num(e.review_count);
  if (toReview) return { key: 'review', label: `Confirm ${plural(toReview, 'scan')}`, to: detail, warn: true };
  return { key: 'results', label: 'View results', to: `/analytics/exam/${encodeURIComponent(e.id)}`, done: true };
}

/** Results summary for a row: null until a sheet is scanned. */
export function examResults(e) {
  const scans = num(e.scan_count);
  if (!scans) return null;
  const avg = e.avg_score == null ? null : Math.max(0, Math.min(100, Number(e.avg_score)));
  return {
    scans,
    avg,
    toReview: num(e.review_count),
    passing: avg != null && avg >= PASS_MARK,
    caption: plural(scans, 'sheet'),
  };
}
