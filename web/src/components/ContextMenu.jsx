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
import { AnimatePresence, motion } from 'motion/react';
import { Drawer } from 'vaul';
import { SPRING_SNAPPY } from '../lib/motion.js';
import { useMediaQuery } from '../lib/useMediaQuery.js';
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

  const menuEl = (
    <AnimatePresence>
      {menu && <ContextMenuPanel x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </AnimatePresence>
  );

  return { menuEl, openMenu, closeMenu };
}

/** Shared item renderer — same buttons drive the desktop popover and the
 *  mobile bottom sheet, so labels/icons/danger stay in sync. A plain render
 *  helper (not a component) keeps this file's export shape unchanged. */
function renderMenuItems(items, onClose, sheet) {
  return items.map((item, i) =>
    item === 'sep' ? (
      <div key={i} className="ctx-menu__sep" role="separator" />
    ) : (
      <button
        key={i}
        type="button"
        role="menuitem"
        className={`ctx-menu__item${item.danger ? ' ctx-menu__item--danger' : ''}${sheet ? ' ctx-menu__item--sheet' : ''}`}
        disabled={item.disabled}
        onClick={() => { onClose(); item.onClick?.(); }}
      >
        {item.icon ? <item.icon size={sheet ? 16 : 14} /> : null}
        <span>{item.label}</span>
      </button>
    )
  );
}

function ContextMenuPanel({ x, y, items, onClose }) {
  const ref = useRef(null);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [sheetOpen, setSheetOpen] = useState(true);
  // Let vaul finish its slide-down before the portal unmounts, or the sheet
  // snaps away mid-animation.
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    // On mobile vaul owns focus trap, Escape, and overlay dismissal — running
    // the desktop handlers too would double-close and skip the sheet's
    // slide-down animation.
    if (isMobile) return undefined;
    const previouslyFocused = document.activeElement;

    function itemButtons() {
      return [...(ref.current?.querySelectorAll('.ctx-menu__item:not([disabled])') || [])];
    }
    function focusItem(index) {
      const btns = itemButtons();
      if (btns.length) btns[Math.max(0, Math.min(index, btns.length - 1))].focus();
    }

    // Keyboard users land on the first item; arrows cycle, Escape closes.
    focusItem(0);

    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    // Typeahead — typing jumps to the next item whose label starts with
    // the accumulated buffer (resets after ~0.6s idle), like native menus.
    let search = '';
    let searchAt = 0;
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      const btns = itemButtons();
      if (!btns.length) return;
      const cur = btns.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        btns[(cur + 1) % btns.length].focus();
      } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        btns[(cur - 1 + btns.length) % btns.length].focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        btns[0].focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        btns[btns.length - 1].focus();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const now = Date.now();
        search = now - searchAt > 600 ? '' : search;
        search += e.key.toLowerCase();
        searchAt = now;
        const labels = btns.map((b) => b.textContent.trim().toLowerCase());
        // Search from the item after the focused one, wrapping around.
        let idx = labels.findIndex((l, i) => i > cur && l.startsWith(search));
        if (idx === -1) idx = labels.findIndex((l) => l.startsWith(search));
        if (idx === -1 && search.length > 1) {
          search = e.key.toLowerCase();
          idx = labels.findIndex((l) => l.startsWith(search));
        }
        if (idx !== -1) {
          e.preventDefault();
          btns[idx].focus();
        }
      }
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
      previouslyFocused?.focus?.();
    };
  }, [onClose, isMobile]);

  // Clamp to the real rendered size once mounted.
  useEffect(() => {
    const el = ref.current;
    if (!el || isMobile) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) el.style.left = `${Math.max(8, window.innerWidth - r.width - 8)}px`;
    if (r.bottom > window.innerHeight - 8) el.style.top = `${Math.max(8, window.innerHeight - r.height - 8)}px`;
  }, [isMobile]);

  // Mobile: finger-sized bottom sheet (vaul handles drag-to-dismiss, focus
  // trap, and the overlay) — a floating popover is unusable at phone widths.
  if (isMobile) {
    return createPortal(
      <Drawer.Root open={sheetOpen} onOpenChange={(o) => { if (!o) closeSheet(); }}>
        <Drawer.Portal>
          <Drawer.Overlay className="ctx-sheet-overlay" />
          <Drawer.Content className="ctx-sheet" aria-label="Actions">
            <Drawer.Title className="sr-only">Actions</Drawer.Title>
            <div className="ctx-sheet-handle" aria-hidden="true" />
            <div className="ctx-sheet-items" ref={ref} role="menu">
              {renderMenuItems(items, closeSheet, true)}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>,
      document.body
    );
  }

  return createPortal(
    <motion.div
      ref={ref}
      className="ctx-menu"
      role="menu"
      style={{ left: x, top: y, transformOrigin: 'top left' }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
      transition={SPRING_SNAPPY}
    >
      {renderMenuItems(items, onClose, false)}
    </motion.div>,
    document.body
  );
}

export default useContextMenu;
