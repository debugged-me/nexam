/**
 * Modal — reusable dialog component.
 * Renders a centered overlay with a card, title, body, and action buttons.
 * Closes on backdrop click or Escape.
 */
import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PageScopeContext } from './shellMeta.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
  // The overlay lives at document.body — carry the page's @scope class so
  // page-scoped styles keep matching the modal's contents.
  const scope = useContext(PageScopeContext);
  const cardRef = useRef(null);
  // Callers pass inline onClose handlers — keep the latest in a ref so the
  // effect below doesn't re-run on every parent render (which used to snap
  // focus back to the close button on each keystroke).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const card = cardRef.current;

    // Focus the first field (or the card itself) so keyboard/AT users land
    // inside the dialog instead of behind it.
    const focusables = card ? [...card.querySelectorAll(FOCUSABLE)] : [];
    (focusables[0] || card)?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return; }
      if (e.key !== 'Tab' || !card) return;
      // Trap: wrap Tab at the edges so focus never leaves the dialog.
      const items = [...card.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // Render at document.body — inside a page panel the fixed overlay gets
  // clipped by overflow/containing-block ancestors.
  return createPortal(
    <div className={`modal-overlay${scope ? ` ${scope}` : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title} ref={cardRef} tabIndex={-1}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
