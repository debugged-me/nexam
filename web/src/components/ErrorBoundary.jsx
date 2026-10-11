/**
 * ErrorBoundary — catches render errors anywhere below it and shows a
 * recoverable fallback instead of a white screen.
 *
 * Mounted around the route tree in App.jsx. Logs the error to the console;
 * the fallback offers a reload and a way back to the dashboard.
 */
import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[nexam] Render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <span className="error-boundary-icon"><AlertTriangle size={22} /></span>
          <h1>Something went wrong</h1>
          <p>
            The page hit an unexpected error. Your work is saved on the server —
            reload to pick up where you left off.
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn-outline" href="/dashboard">Back to dashboard</a>
          </div>
          {this.state.error?.message && (
            <code className="error-boundary-detail">{String(this.state.error.message)}</code>
          )}
        </div>
      </div>
    );
  }
}
