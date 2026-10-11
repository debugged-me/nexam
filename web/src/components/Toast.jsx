/**
 * Toast — application notifications backed by `sonner`.
 *
 * The public API is unchanged (useToast → show/success/error/warning/info/
 * dismiss) so call sites don't move; the rendered stack is sonner's, themed
 * through the CSS variables in styles/toast.css.
 */
import { createContext, useContext, useCallback, useMemo } from 'react';
import { Toaster, toast as sonner } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const dismiss = useCallback((id) => sonner.dismiss(id), []);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const opts = { duration: duration > 0 ? duration : Infinity };
    const fn = sonner[type] || sonner;
    return fn(message, opts);
  }, []);

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
      <Toaster
        position="top-center"
        richColors
        gap={8}
        visibleToasts={4}
        icons={{
          success: <CheckCircle2 size={16} />,
          error: <XCircle size={16} />,
          warning: <AlertTriangle size={16} />,
          info: <Info size={16} />,
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export default ToastContext;
