/**
 * Exam list helpers — publishing status and optional OMR results.
 * Fields come from GET /api/exams: status, scan_count, review_count, avg_score.
 */

export const PASS_MARK = 75; // same line Results & insights draws

const num = (v) => Math.max(0, Number(v) || 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const isPublished = (e) => e.status === 'published' || e.status === 'live';

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
