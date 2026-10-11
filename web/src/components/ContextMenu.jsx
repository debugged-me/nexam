/**
 * ContextMenu — right-click (and long-press-free) row menu.
 *
 * Usage:
 *   const { menuEl, openMenu, closeMenu } = useContextMenu();
 *   <tr onContextMenu={(e) => openMenu(e, items)}>…</tr>
 *   {menuEl}
 *
 * `items` is an array of:
 *   { label, icon?: LucideIcon, onClick, danger?: bool, disabled?: bool }
 *   or the string 'sep' for a divider.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './Toast.jsx';

const MENU_MIN_W = 220;
const EST_ITEM_H = 30;

/** Clipboard write + toast feedback — the "Copy …" item in most row menus. */
export function useCopyText() {
  const toast = useToast();
  return useCallback(
    (text, label = 'Text') => {
      navigator.clipboard?.writeText(text ?? '').then(
        () => toast.success(`${label} copied.`),
        () => toast.error('Copy failed.')
      );
    },
    [toast]
  );
}

export function useContextMenu() {
  const [menu, setMenu] = useState(null); // { x, y, items }

  const openMenu = useCallback((e, items) => {
    e.preventDefault();
    e.stopPropagation();
    const estH = items.length * EST_ITEM_H + 12;
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - MENU_MIN_W - 8),
      y: Math.min(e.clientY, window.innerHeight - estH - 8),
      items,
    });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const menuEl = menu ? (
    <ContextMenuPanel x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />
  ) : null;

  return { menuEl, openMenu, closeMenu };
}

function ContextMenuPanel({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onScrollOrResize() { onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [onClose]);

  // Clamp to the real rendered size once mounted.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  }, []);

  return createPortal(
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: x, top: y }}>
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="ctx-menu__sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`ctx-menu__item${item.danger ? ' ctx-menu__item--danger' : ''}`}
            disabled={item.disabled}
            onClick={() => { onClose(); item.onClick?.(); }}
          >
            {item.icon ? <item.icon size={14} /> : null}
            <span>{item.label}</span>
          </button>
        )
      )}
    </div>,
    document.body
  );
}

export default useContextMenu;
