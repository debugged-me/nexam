import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Search, ArrowUp, ArrowDown, CornerDownLeft, X } from 'lucide-react';
import { COMMAND_ITEMS } from './navigation.js';

/** Local navigation search (cmdk). It never fetches or indexes instructor content. */

const GROUP_LABELS = {
  home: 'Home',
  Workspace: 'Workspace',
  Assessment: 'Assessment',
  Institution: 'Institution',
};
const GROUP_ORDER = ['quick', 'home', 'Workspace', 'Assessment', 'Institution'];

// Items without a `group` (Build an exam, Account settings) lead the list.
const GROUPED = (() => {
  const map = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const item of COMMAND_ITEMS) {
    map.get(item.group && GROUP_LABELS[item.group] ? item.group : 'quick').push(item);
  }
  return [...map.entries()].filter(([, items]) => items.length);
})();

export default function CommandMenu({ open, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open) {
      dialog.showModal();
      inputRef.current?.focus();
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        dialog.close();
        document.body.style.overflow = previous;
      };
    }
  }, [open]);

  function choose(item) {
    onClose();
    navigate(item.to);
  }

  return (
    <dialog
      ref={dialogRef}
      className="command-dialog"
      aria-label="Go to a page"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Command className="command-surface" label="Go to a page" loop>
        <div className="command-search">
          <Search size={20} aria-hidden="true" />
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Where would you like to go?"
            aria-label="Search pages"
          />
          <button
            type="button"
            className="command-close"
            aria-label="Close quick navigation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <Command.List id="command-results" className="command-results" aria-label="Pages">
          <Command.Empty className="command-empty">
            No pages match “{query}”. Try “subjects” or “exams”.
          </Command.Empty>
          {GROUPED.map(([group, items]) => (
            <Command.Group
              key={group}
              heading={group === 'quick' ? 'Quick actions' : GROUP_LABELS[group]}
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.key}
                    value={item.label}
                    keywords={[item.description || '', GROUP_LABELS[item.group] || '']}
                    onSelect={() => choose(item)}
                    className="command-option"
                  >
                    <span className="command-icon">
                      <Icon size={18} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <CornerDownLeft size={15} className="command-enter" aria-hidden="true" />
                  </Command.Item>
                );
              })}
            </Command.Group>
          ))}
        </Command.List>
        <footer className="command-footer">
          <span>
            <ArrowUp size={12} />
            <ArrowDown size={12} /> to navigate
          </span>
          <span>
            <CornerDownLeft size={12} /> to open
          </span>
          <span>
            <kbd>esc</kbd> to close
          </span>
        </footer>
      </Command>
    </dialog>
  );
}
