/**
 * rateLimit — small in-memory sliding-window limiter for expensive routes.
 *
 * Buckets key on the authenticated instructor (falls back to IP), so one
 * account can't spam AI jobs, uploads, or scan submissions. Returns 429 with
 * a Retry-After header and a friendly message once the window is full.
 *
 * In-memory means limits reset on restart and don't span multi-instance
 * deploys — adequate for a single-node API; swap for a shared store if the
 * deployment ever scales horizontally.
 */

const buckets = new Map();

/** Periodically drop empty buckets so the map can't grow unbounded. */
const SWEEP_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > SWEEP_MS) buckets.delete(key);
  }
}, SWEEP_MS).unref();

/**
 * @param {object} opts
 * @param {number} opts.max        max requests inside the window
 * @param {number} opts.windowSec  window length in seconds
 * @param {string} opts.name       bucket namespace
 */
export function rateLimit({ max, windowSec, name }) {
  return (req, res, next) => {
    const id = req.user?.id || req.ip || 'anon';
    const key = `${name}|${id}`;
    const now = Date.now();
    const cutoff = now - windowSec * 1000;
    const hits = (buckets.get(key) || []).filter((t) => t >= cutoff);

    if (hits.length >= max) {
      const retryAfter = Math.max(1, Math.ceil((hits[0] + windowSec * 1000 - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests — please wait about ${retryAfter >= 60 ? `${Math.ceil(retryAfter / 60)} minute(s)` : `${retryAfter} seconds`} and try again.`,
        retry_after: retryAfter,
      });
    }

    hits.push(now);
    buckets.set(key, hits);
    return next();
  };
}
