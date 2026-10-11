/**
 * Toast — lightweight application notification system.
 * Types: success, error, warning, info.
 * Top-center stack with status fills and a countdown progress bar.
 */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

let idCounter = 0;
const EXIT_MS = 300;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    // Fade out first, then drop the node so the exit motion is visible.
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, EXIT_MS);
  }, []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter;
    setToasts((list) => [...list, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  // Memoized so consumers receive a stable context value — an unmemoized
  // object would give every useToast() caller a new `toast` each render and
  // re-fire effects that depend on it (e.g. router-state toasts looping).
  const api = useMemo(() => ({
    show,
    success: (m, d) => show(m, 'success', d),
    error: (m, d) => show(m, 'error', d),
    warning: (m, d) => show(m, 'warning', d),
    info: (m, d) => show(m, 'info', d),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info;
  return (
    <div
      className={`toast toast--${toast.type || 'info'}${toast.out ? ' toast--out' : ''}`}
      role="status"
      onClick={onDismiss}
    >
      <Icon size={16} />
      <span>{toast.message}</span>
      {toast.duration > 0 && (
        <span className="toast__progress" style={{ animationDuration: `${toast.duration}ms` }} />
      )}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export default ToastContext;
