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

const FONT_OPTIONS = [
  {
    key: 'sora',
    label: 'Sora',
    description: 'Modern geometric sans — the default nexam look.',
  },
  {
    key: 'system',
    label: 'SF Pro',
    description: 'Apple\u2019s system face — the macOS feel, bundled for any device.',
  },
  {
    key: 'duo',
    label: 'Sora + SF Pro',
    description: 'Sora headlines and numerals, SF Pro body — both voices at once.',
  },
  {
    key: 'googlesans',
    label: 'Google Sans',
    description: 'Friendly product sans with a soft, rounded voice.',
  },
  {
    key: 'inter',
    label: 'Inter',
    description: 'Neutral workhorse — maximum legibility at small sizes.',
  },
];

const SIZE_OPTIONS = [
  {
    key: 'compact',
    label: 'Compact',
    description: 'The standard nexam scale — dense, more on screen.',
  },
  {
    key: 'default',
    label: 'Regular',
    description: 'A notch roomier — text and spacing scale up together.',
  },
  {
    key: 'large',
    label: 'Large',
    description: 'Bigger text throughout — easier on the eyes.',
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
  const { mode, setThemeMode, font, setFont, textSize, setTextSize } = useTheme();

  return (
    <AppShell pageClass="appearance" activeNav="appearance" pageTitle="Appearance">


      <div className="card" data-tour="appearance-themes">
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
          <span className="card-title">Typeface</span>
        </div>
        <div className="card-body">
          <div className="font-grid" role="radiogroup" aria-label="Typeface">
            {FONT_OPTIONS.map(({ key, label, description }) => {
              const selected = font === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`font-card${selected ? ' is-selected' : ''}`}
                  onClick={() => setFont(key)}
                >
                  <span className={`font-shot font-shot--${key}`} aria-hidden="true">
                    <b>Aa</b>
                    <i>The quick brown fox jumps</i>
                    {selected && (
                      <span className="shot-check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="theme-card-meta">
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
          <span className="card-title">Text size</span>
        </div>
        <div className="card-body">
          <div className="font-grid" role="radiogroup" aria-label="Text size">
            {SIZE_OPTIONS.map(({ key, label, description }) => {
              const selected = textSize === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`font-card${selected ? ' is-selected' : ''}`}
                  onClick={() => setTextSize(key)}
                >
                  <span className={`font-shot size-shot size-shot--${key}`} aria-hidden="true">
                    <b>Aa</b>
                    <i>The quick brown fox jumps</i>
                    {selected && (
                      <span className="shot-check">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="theme-card-meta">
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" data-tour="appearance-palette">
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
