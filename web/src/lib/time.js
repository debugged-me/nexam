/**
 * Time display helpers — absolute "M j, g:i A" (matches the legacy PHP
 * format) plus a short relative label ("4 min ago") for feeds where
 * recency matters more than the calendar date.
 */

/** Format a timestamp like the PHP "M j, g:i A". */
export function fmtScanned(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const hr = d.getHours() % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${months[d.getMonth()]} ${d.getDate()}, ${hr}:${min} ${ampm}`;
}

/**
 * Relative label for recent timestamps — "just now" / "4 min ago" /
 * "yesterday" / "3 days ago". Returns null when the value is missing,
 * invalid, or older than a week, so callers fall back to `fmtScanned`.
 */
export function timeAgo(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return null;
}
