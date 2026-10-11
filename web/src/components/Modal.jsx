/**
 * Modal — reusable dialog component.
 * Renders a centered overlay with a card, title, body, and action buttons.
 * Closes on backdrop click or Escape.
 */
import { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { PageScopeContext } from './shellMeta.js';

export default function Modal({ open, title, subtitle, onClose, children, footer, size = 'md' }) {
  // The overlay lives at document.body — carry the page's @scope class so
  // page-scoped styles keep matching the modal's contents.
  const scope = useContext(PageScopeContext);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  // Render at document.body — inside a page panel the fixed overlay gets
  // clipped by overflow/containing-block ancestors.
  return createPortal(
    <div className={`modal-overlay${scope ? ` ${scope}` : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal-card modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
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
