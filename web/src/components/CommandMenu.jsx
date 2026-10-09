import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, ArrowDown, CornerDownLeft, X } from 'lucide-react';
import { COMMAND_ITEMS } from './navigation.js';

/** Local navigation search. It never fetches or indexes instructor content. */
export default function CommandMenu({ open, onClose }) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const needle = query.trim().toLowerCase();
  const rank = (item) =>
    item.label.toLowerCase().startsWith(needle)
      ? 0
      : item.label.toLowerCase().includes(needle)
        ? 1
        : 2;
  const results = COMMAND_ITEMS.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(needle)
  ).sort((a, b) => rank(a) - rank(b));

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

  useEffect(() => {
    if (open) document.getElementById(`command-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected, open]);

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
      <div className="command-surface">
        <div className="command-search">
          <Search size={20} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Where would you like to go?"
            aria-label="Search pages"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-autocomplete="list"
            aria-activedescendant={results.length ? `command-${selected}` : undefined}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
                event.preventDefault();
                setSelected((current) =>
                  results.length
                    ? (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                      results.length
                    : 0
                );
              }
              if (event.key === 'Enter' && results[selected]) {
                event.preventDefault();
                choose(results[selected]);
              }
            }}
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
        <p className="command-label">Go to</p>
        <div id="command-results" role="listbox" aria-label="Pages" className="command-results">
          {results.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                id={`command-${index}`}
                type="button"
                role="option"
                aria-selected={index === selected}
                className="command-option"
                onClick={() => choose(item)}
                onPointerMove={() => setSelected(index)}
              >
                <span className="command-icon">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {index === selected && (
                  <CornerDownLeft size={15} className="command-enter" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
        {!results.length && (
          <p className="command-empty" role="status">
            No pages match “{query}”. Try “subjects” or “exams”.
          </p>
        )}
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
      </div>
    </dialog>
  );
}
