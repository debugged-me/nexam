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
