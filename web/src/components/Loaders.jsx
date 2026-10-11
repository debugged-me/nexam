/**
 * Loaders — spinner primitives shared by the shell and pages.
 *
 * PageLoader fades in after a short delay, so a screen that loads quickly
 * never flashes a spinner; BootScreen covers the session restore on launch.
 */
export function Spinner({ size = 'md', className = '' }) {
  return <span className={`spinner spinner--${size} ${className}`} aria-hidden="true" />;
}

export function PageLoader({ label = 'Loading…', compact = false }) {
  return (
    <div className={`page-loader ${compact ? 'page-loader--compact' : ''}`} role="status">
      <Spinner size={compact ? 'md' : 'lg'} />
      <span>{label}</span>
    </div>
  );
}

export function BootScreen() {
  return (
    <div className="boot-screen" role="status">
      <span className="boot-mark"><img src="/favicon.png" alt="" /></span>
      <span className="boot-bar" aria-hidden="true"><i /></span>
      <span className="sr-only">Loading nexam…</span>
    </div>
  );
}

/**
 * TableSkeleton — shimmer placeholder shaped like a `.dataset` card while a
 * list page's data loads. Decorative only (aria-hidden); the shimmer freezes
 * under prefers-reduced-motion via loading.css.
 */
export function TableSkeleton({ rows = 6 }) {
  return (
    <section className="dataset sk-dataset" aria-hidden="true">
      <div className="dataset-bar sk-bar-row">
        <span className="sk" style={{ width: 'min(260px, 45%)', height: 36 }} />
        <span className="sk" style={{ width: 92, height: 36 }} />
        <span className="sk" style={{ width: 92, height: 36 }} />
      </div>
      <div className="sk-table">
        <div className="sk-head">
          <span className="sk" style={{ width: '52%' }} />
          <span className="sk" style={{ width: '14%' }} />
          <span className="sk" style={{ width: '18%' }} />
          <span className="sk sk-end" style={{ width: '8%' }} />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div className="sk-row" key={i} style={{ '--i': i }}>
            <span className="sk" style={{ width: `${40 + ((i * 17) % 24)}%`, height: 14 }} />
            <span className="sk" style={{ width: 60, height: 14 }} />
            <span className="sk sk-pill" style={{ width: 70 }} />
            <span className="sk sk-end" style={{ width: 30, height: 14 }} />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * AuthSplash — the brand moment shown briefly before the login page.
 *
 * Mirrors TheraLink's BrandMoment: a brand-gradient wash, a logo tile that
 * gently breathes, the wordmark + tagline rising in, and a sweeping arc
 * spinner keeping time. `leaving` fades the whole layer out before unmount.
 */
export function AuthSplash({ leaving = false }) {
  return (
    <div className={`auth-splash ${leaving ? 'is-leaving' : ''}`} role="status">
      <div className="splash-inner">
        <div className="splash-hero" aria-hidden="true">
          <span className="splash-disc splash-disc--outer" />
          <span className="splash-disc splash-disc--inner" />
          <img className="splash-logo" src="/favicon.png" alt="" width="120" height="120" />
        </div>
        <div className="splash-title">nexam</div>
        <p className="splash-msg">TOS-aligned Exam Builder</p>
        <svg className="splash-arc" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <circle cx="20" cy="20" r="17" stroke="var(--surface-3)" strokeWidth="3.5" />
          <circle className="splash-arc-sweep" cx="20" cy="20" r="17" stroke="var(--ink-3)"
            strokeWidth="3.5" strokeLinecap="round" strokeDasharray="67 107" />
        </svg>
        <span className="sr-only">Loading nexam…</span>
      </div>
    </div>
  );
}
