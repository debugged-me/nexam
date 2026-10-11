import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

/** Icon-rail labels render outside the scrolling navigation so they cannot clip. */
export default function SidebarLink({ compact, label, children, onPointerEnter, onFocus, onClick, ...props }) {
  const [open, setOpen] = useState(false);
  const linkRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimer = useRef(null);
  const tooltipId = useId();

  const keepOpen = useCallback(() => clearTimeout(closeTimer.current), []);
  const close = useCallback(() => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  }, []);

  function show(event) {
    if (!compact || event.pointerType === 'touch' || !window.matchMedia('(min-width: 992px)').matches) return;
    keepOpen();
    setOpen(true);
  }

  function scheduleClose() {
    keepOpen();
    closeTimer.current = setTimeout(close, 150);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !compact || !tooltipRef.current) return;
    const link = linkRef.current.getBoundingClientRect();
    const rail = linkRef.current.closest('.sidebar').getBoundingClientRect();
    const tooltip = tooltipRef.current;
    const top = Math.max(8, Math.min(link.top + (link.height - tooltip.offsetHeight) / 2, window.innerHeight - tooltip.offsetHeight - 8));
    // Only runtime coordinates live here; all visual rules belong to app.css.
    tooltip.style.setProperty('--sidebar-tooltip-top', `${top}px`);
    tooltip.style.setProperty('--sidebar-tooltip-left', `${rail.right + 8}px`);
  }, [open, compact]);

  return (
    <>
      <Link
        {...props}
        ref={linkRef}
        aria-label={label}
        aria-describedby={open && compact ? tooltipId : undefined}
        onPointerEnter={(event) => { show(event); onPointerEnter?.(event); }}
        onPointerLeave={scheduleClose}
        onFocus={(event) => { show(event); onFocus?.(event); }}
        onBlur={close}
        onClick={(event) => { close(); onClick?.(event); }}
      >
        {children}
      </Link>
      {open && compact && createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="sidebar-tooltip"
          onPointerEnter={keepOpen}
          onPointerLeave={scheduleClose}
        >
          {label}
        </div>,
        document.body,
      )}
    </>
  );
}
