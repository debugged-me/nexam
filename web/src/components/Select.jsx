/**
 * Select — themed dropdown for toolbars and filter bars.
 *
 *   <Select value={sort} onChange={setSort} label="Sort subjects"
 *           icon={ArrowUpDown} options={[{ value: 'name', label: 'Name' }]} />
 *
 * Desktop gets Radix's listbox (token-styled, dark-mode aware, keyboard
 * typeahead). Touch and narrow screens keep the native <select> — the OS
 * picker is the better control there and always meets the 44px target.
 * Values are strings; Radix reserves '' so it is never a valid option.
 */
import { useRef, useState } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import ScopedLayer from './ScopedLayer.jsx';

export default function Select({ value, onChange, options, label, icon: Icon, className = '', searchable = false, searchPlaceholder = 'Search…' }) {
  const native = useMediaQuery('(hover: none), (max-width: 599px)');
  const current = options.find((o) => o.value === value);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const filtered = searchable && query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  const pick = (v) => { setQuery(''); onChange(v); };

  if (native) {
    return (
      <label className={`nx-select nx-select--native${className ? ` ${className}` : ''}`}>
        {Icon && <Icon size={15} aria-hidden="true" />}
        <span className="sr-only">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true" className="nx-select-caret" />
      </label>
    );
  }

  return (
    <RadixSelect.Root value={value} onValueChange={pick}
      onOpenChange={(open) => {
        if (!open) { setQuery(''); return; }
        if (searchable) setTimeout(() => searchRef.current?.focus(), 40);
      }}>
      <RadixSelect.Trigger className={`nx-select${className ? ` ${className}` : ''}`} aria-label={label}>
        {Icon && <Icon size={15} aria-hidden="true" />}
        <RadixSelect.Value>{current?.label}</RadixSelect.Value>
        <RadixSelect.Icon className="nx-select-caret"><ChevronDown size={14} /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <ScopedLayer>
          <RadixSelect.Content className="nx-pop nx-select-menu" position="popper" sideOffset={6} collisionPadding={12}>
            {searchable && (
              <div className="nx-select-search">
                <Search size={13} aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  placeholder={searchPlaceholder}
                  aria-label={label}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={(e) => {
                    // The listbox steals focus back to its content when the
                    // filtered items re-render — hand it back so typing goes on.
                    if (e.relatedTarget?.classList?.contains('nx-select-menu')) {
                      requestAnimationFrame(() => searchRef.current?.focus());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filtered.length) { pick(filtered[0].value); return; }
                    if (e.key !== 'Escape' && e.key !== 'Tab') e.stopPropagation();
                  }}
                />
                {query ? (
                  <button type="button" tabIndex={-1} aria-label="Clear search" onClick={() => setQuery('')}>
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            )}
            <RadixSelect.Viewport>
              {filtered.length === 0 && <div className="nx-select-empty">No matches</div>}
              {filtered.map((o) => (
                <RadixSelect.Item key={o.value} value={o.value} className="nx-select-item">
                  <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="nx-select-check"><Check size={14} /></RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </ScopedLayer>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
