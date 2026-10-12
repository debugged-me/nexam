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
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useMediaQuery } from '../lib/useMediaQuery.js';
import ScopedLayer from './ScopedLayer.jsx';

export default function Select({ value, onChange, options, label, icon: Icon, className = '' }) {
  const native = useMediaQuery('(hover: none), (max-width: 599px)');
  const current = options.find((o) => o.value === value);

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
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger className={`nx-select${className ? ` ${className}` : ''}`} aria-label={label}>
        {Icon && <Icon size={15} aria-hidden="true" />}
        <RadixSelect.Value>{current?.label}</RadixSelect.Value>
        <RadixSelect.Icon className="nx-select-caret"><ChevronDown size={14} /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <ScopedLayer>
          <RadixSelect.Content className="nx-pop nx-select-menu" position="popper" sideOffset={6} collisionPadding={12}>
            <RadixSelect.Viewport>
              {options.map((o) => (
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
