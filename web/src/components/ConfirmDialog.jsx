/**
 * ConfirmDialog — promise-based confirmation modal.
 *
 * Replaces window.confirm() so every destructive action uses the app's own
 * dialog chrome instead of the browser's native prompt. Call sites read like
 * the native API:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm('Delete this question?'))) return;
 *
 * Options: { title, confirmText, danger, icon, tone }. danger defaults to true
 * (red button + red icon tile); pass danger: false for non-destructive
 * confirmations — pair it with `icon` (a Lucide component) and `tone`
 * ('neutral' | 'accent') so the dialog keeps the icon treatment.
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolveRef = useRef(null);

  const close = useCallback((result) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((message, options = {}) => {
    resolveRef.current?.(false); // a new prompt supersedes a pending one
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        title: options.title || 'Are you sure?',
        message,
        confirmText: options.confirmText || 'Delete',
        danger: options.danger !== false,
        icon: options.icon || null,
        tone: options.tone || 'neutral',
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        title={state?.title || ''}
        onClose={() => close(false)}
        size="sm"
        footer={(
          <>
            <button type="button" className="btn" onClick={() => close(false)}>Cancel</button>
            <button
              type="button"
              className={state?.danger ? 'btn btn-danger' : 'btn btn-primary'}
              autoFocus
              onClick={() => close(true)}
            >
              {state?.confirmText}
            </button>
          </>
        )}
      >
        <div className="confirm-body">
          {(() => {
            const Icon = state?.danger ? (state.icon || AlertTriangle) : state?.icon;
            if (!Icon) return null;
            return (
              <span className={`confirm-icon${state?.danger ? '' : ` confirm-icon--${state?.tone}`}`} aria-hidden="true">
                <Icon size={18} />
              </span>
            );
          })()}
          <p className="confirm-message">{state?.message}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
