/**
 * Loaders — spinner primitives shared by the shell and pages.
 *
 * PageLoader fades in after a short delay, so a screen that loads quickly
 * never flashes a spinner; BootScreen covers the session restore on launch.
 */
import { GraduationCap } from 'lucide-react';

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
      <span className="boot-mark"><GraduationCap size={22} /></span>
      <Spinner size="md" />
      <span className="sr-only">Loading nexam…</span>
    </div>
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
          <circle cx="20" cy="20" r="17" stroke="var(--action-100)" strokeWidth="3.5" />
          <circle className="splash-arc-sweep" cx="20" cy="20" r="17" stroke="var(--action-600)"
            strokeWidth="3.5" strokeLinecap="round" strokeDasharray="67 107" />
        </svg>
        <span className="sr-only">Loading nexam…</span>
      </div>
    </div>
  );
}
