import '../styles/appearance.css';
/**
 * AppearancePage — theme preference (light / dark / system) with live
 * preview mocks and a swatch strip of the resolved palette. The same
 * three-way toggle lives in the topbar user dropdown; both write to the
 * same per-device setting.
 */
import AppShell from '../components/AppShell.jsx';
import { useTheme } from '../lib/theme.js';
import { Check, Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  {
    key: 'light',
    label: 'Light',
    description: 'Bright canvas — the default nexam look.',
    Icon: Sun,
  },
  {
    key: 'dark',
    label: 'Dark',
    description: 'Deep slate surfaces, easier on the eyes at night.',
    Icon: Moon,
  },
  {
    key: 'system',
    label: 'System',
    description: 'Follows your device — switches automatically.',
    Icon: Monitor,
  },
];

const SWATCHES = [
  { name: 'Canvas', v: '--canvas' },
  { name: 'Card', v: '--surface' },
  { name: 'Inset', v: '--surface-2' },
  { name: 'Text', v: '--ink' },
  { name: 'Accent', v: '--action-600' },
  { name: 'Success', v: '--green-600' },
  { name: 'Warning', v: '--amber-600' },
  { name: 'Danger', v: '--red-600' },
];

export default function AppearancePage() {
  const { mode, resolved, setThemeMode } = useTheme();

  return (
    <AppShell pageClass="appearance" activeNav="appearance" pageTitle="Appearance">
      <div className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Appearance</h1>
          <p className="page-sub">
            Choose how nexam looks on this device. Saved to this browser —
            currently {resolved === 'dark' ? 'dark' : 'light'}
            {mode === 'system' ? ' (following system)' : ''}.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Theme</span>
        </div>
        <div className="card-body">
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {OPTIONS.map(({ key, label, description, Icon }) => {
              const selected = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-card${selected ? ' is-selected' : ''}`}
                  onClick={() => setThemeMode(key)}
                >
                  <span className={`theme-shot theme-shot--${key}`} aria-hidden="true">
                    <span className="shot-side" />
                    <span className="shot-main">
                      <i className="shot-bar" />
                      <i className="shot-line" />
                      <i className="shot-line shot-line--short" />
                      <i className="shot-cta" />
                    </span>
                    {selected && (
                      <span className="shot-check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="theme-card-meta">
                    <Icon size={15} />
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Palette</span>
        </div>
        <div className="card-body">
          <div className="swatch-row">
            {SWATCHES.map((s) => (
              <div className="swatch" key={s.v}>
                <i style={{ background: `var(${s.v})` }} aria-hidden="true" />
                <small>{s.name}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
