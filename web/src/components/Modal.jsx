/**
 * Modal — reusable dialog component.
 * Renders a centered overlay with a card, title, body, and action buttons.
 * Closes on backdrop click or Escape.
 */
import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { EASE_STANDARD, SPRING_SNAPPY, DUR } from '../lib/motion.js';
import { X } from 'lucide-react';
import { PageScopeContext } from './shellMeta.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, subtitle, onClose, children, footer, size = 'md', side = false, icon: Icon, accent }) {
  // The overlay lives at document.body — carry the page's @scope class so
  // page-scoped styles keep matching the modal's contents.
  const scope = useContext(PageScopeContext);
  const cardRef = useRef(null);
  const reduceMotion = useReducedMotion();
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

  // Render at document.body — inside a page panel the fixed overlay gets
  // clipped by overflow/containing-block ancestors. AnimatePresence keeps the
  // dialog mounted long enough to play its exit motion.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`modal-overlay${side ? ' modal-overlay--sheet' : ''}${scope ? ` ${scope}` : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DUR.fast, ease: 'easeOut' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            className={`modal-card ${side ? 'modal-sheet' : `modal-${size}`}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            ref={cardRef}
            tabIndex={-1}
            initial={side
              ? (reduceMotion ? { opacity: 0 } : { opacity: 0, x: '100%' })
              : { opacity: 0, scale: 0.96, y: 6 }}
            animate={side
              ? (reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 })
              : { opacity: 1, scale: 1, y: 0 }}
            exit={side
              ? (reduceMotion ? { opacity: 0 } : { opacity: 0, x: '100%' })
              : { opacity: 0, scale: 0.97, y: 4 }}
            transition={side
              ? { duration: DUR.med, ease: EASE_STANDARD }
              : SPRING_SNAPPY}
          >
            <div className="modal-header">
              <div className="modal-headline">
                {Icon && (
                  <motion.span
                    className={`modal-icon${accent ? ' is-tinted' : ''}`}
                    style={accent ? { '--ma': accent } : undefined}
                    aria-hidden="true"
                    initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.14, type: 'spring', stiffness: 480, damping: 22 }}
                  >
                    <Icon size={17} />
                  </motion.span>
                )}
                <div className="modal-headline-copy">
                  <h2 className="modal-title">{title}</h2>
                  {subtitle && <p className="modal-subtitle">{subtitle}</p>}
                </div>
              </div>
              <button className="modal-close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
