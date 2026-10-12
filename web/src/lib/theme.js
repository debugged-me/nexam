/**
 * theme.js — light / dark / system appearance mode.
 *
 * The mode is stored per account (users.theme via PUT /auth/theme) and
 * cached per user in localStorage, so it follows the person — not the
 * browser. Two people sharing a machine keep their own preference.
 *
 * Auth/legal pages (login, register, forgot, reset, verify, privacy, terms)
 * have no account bound to them, so they pin a light palette via
 * pinTheme()/unpinTheme() regardless of who last signed in.
 *
 * The resolved value is applied as `data-theme` on <html> so tokens.css can
 * switch the palette. "system" follows the OS via matchMedia, live.
 */
import { useSyncExternalStore } from 'react';

export const THEME_MODES = ['light', 'dark', 'system'];
export const FACES = ['system', 'sora', 'googlesans', 'inter', 'geist'];
export const FONTS = ['system', 'sora', 'duo', 'googlesans', 'inter', 'geist'];
export const TEXT_SIZES = ['compact', 'default', 'large'];
export const ACCENTS = ['blue', 'emerald', 'violet', 'amber', 'rose'];
export const RADII = ['sharp', 'default', 'rounded'];

/** Presets resolve to [display, body] face pairs; custom pairings are
 *  stored as "display+body" (e.g. "sora+inter") in the same font field. */
const PRESET_PAIRS = {
  system: ['system', 'system'],
  sora: ['sora', 'sora'],
  duo: ['sora', 'system'],
  googlesans: ['googlesans', 'googlesans'],
  inter: ['inter', 'inter'],
  geist: ['geist', 'geist'],
};
const PRESET_FOR_PAIR = Object.fromEntries(
  Object.entries(PRESET_PAIRS).map(([k, v]) => [v.join('+'), k])
);

/** [display, body] faces for any stored font value (preset or "a+b"). */
export function fontPair(v = font) {
  if (PRESET_PAIRS[v]) return PRESET_PAIRS[v];
  const [d, b] = String(v).split('+');
  return FACES.includes(d) && FACES.includes(b) ? [d, b] : PRESET_PAIRS.duo;
}

function isValidFont(v) {
  if (FONTS.includes(v)) return true;
  const [d, b] = String(v).split('+');
  return FACES.includes(d) && FACES.includes(b);
}

const GLOBAL_KEY = 'nexam.theme';        // last applied mode — boot cache
const LAST_UID_KEY = 'nexam.theme.uid';  // account the boot cache belongs to
const userKey = (id) => `nexam.theme.${id}`;
const FONT_KEY = 'nexam.font';
const fontUserKey = (id) => `nexam.font.${id}`;
const SIZE_KEY = 'nexam.size';
const sizeUserKey = (id) => `nexam.size.${id}`;
const ACCENT_KEY = 'nexam.accent';
const accentUserKey = (id) => `nexam.accent.${id}`;
const RADIUS_KEY = 'nexam.radius';
const radiusUserKey = (id) => `nexam.radius.${id}`;

/** Paths that always render light — no account is bound there. */
const GUEST_PATHS = ['/login', '/register', '/forgot', '/reset', '/verify', '/privacy', '/terms'];

const listeners = new Set();

function readKey(k) {
  try {
    const v = k ? localStorage.getItem(k) : null;
    return THEME_MODES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

function readFontKey(k) {
  try {
    const v = k ? localStorage.getItem(k) : null;
    return isValidFont(v) ? v : null;
  } catch {
    return null;
  }
}

function readSizeKey(k) {
  try {
    const v = k ? localStorage.getItem(k) : null;
    return TEXT_SIZES.includes(v) ? v : null;
  } catch {
    return null;
  }
}

const readAccentKey = (k) => {
  try {
    const v = k ? localStorage.getItem(k) : null;
    return ACCENTS.includes(v) ? v : null;
  } catch {
    return null;
  }
};

const readRadiusKey = (k) => {
  try {
    const v = k ? localStorage.getItem(k) : null;
    return RADII.includes(v) ? v : null;
  } catch {
    return null;
  }
};

/** Boot mode: the last signed-in account's cached preference, else system. */
function readInitial() {
  try {
    const uid = localStorage.getItem(LAST_UID_KEY);
    return readKey(uid && userKey(uid)) || readKey(GLOBAL_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function readInitialFont() {
  try {
    const uid = localStorage.getItem(LAST_UID_KEY);
    return readFontKey(uid && fontUserKey(uid)) || readFontKey(FONT_KEY) || 'duo';
  } catch {
    return 'duo';
  }
}

function readInitialSize() {
  try {
    const uid = localStorage.getItem(LAST_UID_KEY);
    return readSizeKey(uid && sizeUserKey(uid)) || readSizeKey(SIZE_KEY) || 'compact';
  } catch {
    return 'compact';
  }
}

const readInitialPref = (reader, globalKey, userKeyFn, fallback) => {
  try {
    const uid = localStorage.getItem(LAST_UID_KEY);
    return reader(uid && userKeyFn(uid)) || reader(globalKey) || fallback;
  } catch {
    return fallback;
  }
};

let mode = readInitial();
let font = readInitialFont();
let textSize = readInitialSize();
let accent = readInitialPref(readAccentKey, ACCENT_KEY, accentUserKey, 'blue');
let radius = readInitialPref(readRadiusKey, RADIUS_KEY, radiusUserKey, 'default');
let boundUserId = null;
let forcedTheme = null; // resolved palette override while a guest page mounts

export function resolveTheme(m = mode) {
  if (m !== 'system') return m;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply() {
  const resolved = forcedTheme || resolveTheme();
  const [displayFace, bodyFace] = fontPair();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.font = font;
  document.documentElement.dataset.fontDisplay = displayFace;
  document.documentElement.dataset.fontBody = bodyFace;
  document.documentElement.dataset.accent = accent;
  document.documentElement.dataset.radius = radius;
  document.documentElement.dataset.textSize = textSize;
  document.documentElement.style.colorScheme = resolved;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function getThemeMode() {
  return mode;
}

/** Force a resolved palette regardless of the bound mode (guest pages). */
export function pinTheme(resolved) {
  forcedTheme = resolved;
  apply();
  notify();
}

export function unpinTheme() {
  forcedTheme = null;
  apply();
  notify();
}

function persist() {
  try {
    if (boundUserId) {
      localStorage.setItem(userKey(boundUserId), mode);
      localStorage.setItem(fontUserKey(boundUserId), font);
      localStorage.setItem(sizeUserKey(boundUserId), textSize);
      localStorage.setItem(accentUserKey(boundUserId), accent);
      localStorage.setItem(radiusUserKey(boundUserId), radius);
      localStorage.setItem(LAST_UID_KEY, boundUserId);
    }
    localStorage.setItem(GLOBAL_KEY, mode);
    localStorage.setItem(FONT_KEY, font);
    localStorage.setItem(SIZE_KEY, textSize);
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem(RADIUS_KEY, radius);
  } catch { /* private mode — keep it in memory only */ }
}

export function setThemeMode(next, origin) {
  if (!THEME_MODES.includes(next) || next === mode) return;
  mode = next;
  persist();
  const mutate = () => { apply(); notify(); };
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && document.startViewTransition) {
    // Circular ripple-reveal from the toggle — coordinates land on CSS vars
    // the ::view-transition-new clip-path animation reads (see app.css).
    document.documentElement.style.setProperty('--vt-x', `${Math.round(origin?.x ?? window.innerWidth / 2)}px`);
    document.documentElement.style.setProperty('--vt-y', `${Math.round(origin?.y ?? window.innerHeight / 2)}px`);
    document.startViewTransition(mutate);
  } else {
    mutate();
  }
  if (boundUserId) {
    import('./api.js')
      .then(({ default: api }) => api.put('/auth/appearance', { theme: next }))
      .catch(() => { /* offline — the per-user cache still has it */ });
  }
}

/** Typeface preference — applied instantly as data-font on <html>. */
export function setFont(next) {
  if (!isValidFont(next) || next === font) return;
  font = next;
  persist();
  apply();
  notify();
  if (boundUserId) {
    import('./api.js')
      .then(({ default: api }) => api.put('/auth/appearance', { font: next }))
      .catch(() => { /* offline — the per-user cache still has it */ });
  }
}

/** Custom display+body pairing — collapses to the matching preset when
 *  one exists (sora+system stores "duo", not "sora+system"). */
export function setFontPair(display, body) {
  if (!FACES.includes(display) || !FACES.includes(body)) return;
  setFont(PRESET_FOR_PAIR[`${display}+${body}`] || `${display}+${body}`);
}

/** Text-size preference — applied instantly as data-text-size on <html>. */
export function setTextSize(next) {
  if (!TEXT_SIZES.includes(next) || next === textSize) return;
  textSize = next;
  persist();
  apply();
  notify();
  if (boundUserId) {
    import('./api.js')
      .then(({ default: api }) => api.put('/auth/appearance', { text_size: next }))
      .catch(() => { /* offline — the per-user cache still has it */ });
  }
}

/** Accent color — applied instantly as data-accent on <html>. */
export function setAccent(next) {
  if (!ACCENTS.includes(next) || next === accent) return;
  accent = next;
  persist();
  apply();
  notify();
  if (boundUserId) {
    import('./api.js')
      .then(({ default: api }) => api.put('/auth/appearance', { accent: next }))
      .catch(() => { /* offline — the per-user cache still has it */ });
  }
}

/** Corner radius preset — applied instantly as data-radius on <html>. */
export function setRadius(next) {
  if (!RADII.includes(next) || next === radius) return;
  radius = next;
  persist();
  apply();
  notify();
  if (boundUserId) {
    import('./api.js')
      .then(({ default: api }) => api.put('/auth/appearance', { radius: next }))
      .catch(() => { /* offline — the per-user cache still has it */ });
  }
}

/**
 * Bind the theme to an account — call when /auth/me or login resolves.
 * Priority: the server-saved preference → this browser's per-user cache → system.
 */
export function applyUserTheme(user) {
  boundUserId = user?.id ?? null;
  mode = THEME_MODES.includes(user?.theme)
    ? user.theme
    : readKey(userKey(boundUserId)) || 'system';
  font = isValidFont(user?.font)
    ? user.font
    : readFontKey(fontUserKey(boundUserId)) || 'duo';
  textSize = TEXT_SIZES.includes(user?.text_size)
    ? user.text_size
    : readSizeKey(sizeUserKey(boundUserId)) || 'compact';
  accent = ACCENTS.includes(user?.accent)
    ? user.accent
    : readAccentKey(accentUserKey(boundUserId)) || 'blue';
  radius = RADII.includes(user?.radius)
    ? user.radius
    : readRadiusKey(radiusUserKey(boundUserId)) || 'default';
  persist();
  apply();
  notify();
}

/** Unbind on logout — back to a neutral guest state. */
export function clearUserTheme() {
  boundUserId = null;
  mode = 'system';
  font = 'duo';
  textSize = 'compact';
  accent = 'blue';
  radius = 'default';
  try {
    localStorage.removeItem(LAST_UID_KEY);
    localStorage.removeItem(GLOBAL_KEY);
  } catch { /* ignore */ }
  apply();
  notify();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React binding: { mode, resolved, setThemeMode, font, setFont, setFontPair, textSize, setTextSize, accent, setAccent, radius, setRadius } — re-renders on change. */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, getThemeMode);
  const currentFont = useSyncExternalStore(subscribe, () => font);
  const currentSize = useSyncExternalStore(subscribe, () => textSize);
  const currentAccent = useSyncExternalStore(subscribe, () => accent);
  const currentRadius = useSyncExternalStore(subscribe, () => radius);
  return { mode: current, resolved: forcedTheme || resolveTheme(current), setThemeMode, font: currentFont, setFont, setFontPair, textSize: currentSize, setTextSize, accent: currentAccent, setAccent, radius: currentRadius, setRadius };
}

// Follow the OS live while the mode is "system".
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode !== 'system' || forcedTheme) return;
    apply();
    notify();
  });
}

// Apply before first render — and never flash an account theme on guest pages.
if (GUEST_PATHS.includes(window.location.pathname)) { forcedTheme = 'light'; font = 'duo'; textSize = 'compact'; accent = 'blue'; radius = 'default'; }
apply();
