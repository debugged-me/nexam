import '../styles/appearance.css';
/**
 * AppearancePage — theme preference (light / dark / system) with live
 * preview mocks and a swatch strip of the resolved palette. The same
 * three-way toggle lives in the topbar user dropdown; both write to the
 * same per-device setting.
 */
import { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import Modal from '../components/Modal.jsx';
import { fontPair, useTheme } from '../lib/theme.js';
import { Blend, Check, Monitor, Moon, Sun } from 'lucide-react';

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
    key: 'duo',
    label: 'Sora + SF Pro',
    description: 'Sora headlines and numerals, SF Pro body — the default nexam look.',
  },
  {
    key: 'sora',
    label: 'Sora',
    description: 'Modern geometric sans everywhere — rounded, friendly voice.',
  },
  {
    key: 'system',
    label: 'SF Pro',
    description: 'Apple\u2019s system face — the macOS feel, bundled for any device.',
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
  {
    key: 'geist',
    label: 'Geist',
    description: 'Vercel\u2019s crisp grotesque — pairs with Geist Mono for code.',
  },
];

const FACE_OPTIONS = [
  { key: 'sora', label: 'Sora' },
  { key: 'system', label: 'SF Pro' },
  { key: 'googlesans', label: 'Google Sans' },
  { key: 'inter', label: 'Inter' },
  { key: 'geist', label: 'Geist' },
];

const FACE_STACKS = {
  sora: '"Sora", sans-serif',
  system: '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  googlesans: '"Google Sans", sans-serif',
  inter: '"Inter", sans-serif',
  geist: '"Geist", sans-serif',
};

const ACCENT_OPTIONS = [
  { key: 'blue', label: 'Blue', sw: '#2383E2' },
  { key: 'emerald', label: 'Emerald', sw: '#23A265' },
  { key: 'violet', label: 'Violet', sw: '#7C5CD6' },
  { key: 'amber', label: 'Amber', sw: '#B07D1E' },
  { key: 'rose', label: 'Rose', sw: '#D93856' },
];

const RADIUS_OPTIONS = [
  { key: 'sharp', label: 'Sharp', description: 'Minimal rounding — crisp, technical edges.', r: 4 },
  { key: 'default', label: 'Default', description: 'The standard nexam corner scale.', r: 10 },
  { key: 'rounded', label: 'Rounded', description: 'Softer, pillier surfaces throughout.', r: 18 },
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
  const { mode, setThemeMode, font, setFont, setFontPair, textSize, setTextSize, accent, setAccent, radius, setRadius } = useTheme();
  const [displayFace, bodyFace] = fontPair(font);
  const isCustom = font.includes('+');
  const faceLabel = (key) => FACE_OPTIONS.find((f) => f.key === key)?.label || key;
  const [pairOpen, setPairOpen] = useState(false);
  const [draft, setDraft] = useState(['sora', 'system']);
  const openPairPicker = () => { setDraft(fontPair(font)); setPairOpen(true); };

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

      <div className="card" data-tour="appearance-accent">
        <div className="card-header">
          <span className="card-title">Accent</span>
        </div>
        <div className="card-body">
          <div className="accent-row" role="radiogroup" aria-label="Accent color">
            {ACCENT_OPTIONS.map(({ key, label, sw }) => {
              const selected = accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`accent-chip${selected ? ' is-selected' : ''}`}
                  onClick={() => setAccent(key)}
                >
                  <i style={{ background: sw }} aria-hidden="true">
                    {selected && <Check size={13} strokeWidth={3.5} />}
                  </i>
                  <strong>{label}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" data-tour="appearance-typeface">
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
            <button
              type="button"
              role="radio"
              aria-checked={isCustom}
              className={`font-card${isCustom ? ' is-selected' : ''}`}
              onClick={openPairPicker}
            >
              <span className="font-shot font-shot--custom" aria-hidden="true">
                <b style={{ fontFamily: FACE_STACKS[displayFace] }}>Aa</b>
                <i style={{ fontFamily: FACE_STACKS[bodyFace] }}>The quick brown fox jumps</i>
                {isCustom && (
                  <span className="shot-check">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="theme-card-meta">
                <strong>Custom</strong>
                <small>{isCustom ? `${faceLabel(displayFace)} + ${faceLabel(bodyFace)}` : 'Pick your own display + body pair.'}</small>
              </span>
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={pairOpen}
        size="sm"
        icon={Blend}
        title="Custom pairing"
        subtitle="Mix a display face for titles and a body face for everything else."
        onClose={() => setPairOpen(false)}
        footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPairOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setFontPair(draft[0], draft[1]); setPairOpen(false); }}
            >
              Use pairing
            </button>
          </>
        )}
      >
        <div className="pair-grid">
          <label className="pair-field">
            <span className="pair-label">Display face</span>
            <small>Titles, headlines, and KPI numerals.</small>
            <select
              className="form-control form-select"
              value={draft[0]}
              onChange={(e) => setDraft([e.target.value, draft[1]])}
            >
              {FACE_OPTIONS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <label className="pair-field">
            <span className="pair-label">Body face</span>
            <small>Paragraphs, tables, forms, and controls.</small>
            <select
              className="form-control form-select"
              value={draft[1]}
              onChange={(e) => setDraft([draft[0], e.target.value])}
            >
              {FACE_OPTIONS.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <div className="font-shot pair-shot" aria-hidden="true">
            <b style={{ fontFamily: FACE_STACKS[draft[0]] }}>Aa</b>
            <i style={{ fontFamily: FACE_STACKS[draft[1]] }}>The quick brown fox jumps</i>
            <small className="pair-shot-name">{faceLabel(draft[0])} + {faceLabel(draft[1])}</small>
          </div>
        </div>
      </Modal>

      <div className="card" data-tour="appearance-size">
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

      <div className="card" data-tour="appearance-corners">
        <div className="card-header">
          <span className="card-title">Corners</span>
        </div>
        <div className="card-body">
          <div className="font-grid" role="radiogroup" aria-label="Corner radius">
            {RADIUS_OPTIONS.map(({ key, label, description, r }) => {
              const selected = radius === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`font-card${selected ? ' is-selected' : ''}`}
                  onClick={() => setRadius(key)}
                >
                  <span className="font-shot radius-shot" aria-hidden="true">
                    <i style={{ borderRadius: `${r}px` }} />
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
