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
export const FONTS = ['system', 'sora', 'googlesans', 'inter'];

const GLOBAL_KEY = 'nexam.theme';        // last applied mode — boot cache
const LAST_UID_KEY = 'nexam.theme.uid';  // account the boot cache belongs to
const userKey = (id) => `nexam.theme.${id}`;
const FONT_KEY = 'nexam.font';
const fontUserKey = (id) => `nexam.font.${id}`;

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
    return FONTS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

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
    return readFontKey(uid && fontUserKey(uid)) || readFontKey(FONT_KEY) || 'system';
  } catch {
    return 'system';
  }
}

let mode = readInitial();
let font = readInitialFont();
let boundUserId = null;
let forcedTheme = null; // resolved palette override while a guest page mounts

export function resolveTheme(m = mode) {
  if (m !== 'system') return m;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply() {
  const resolved = forcedTheme || resolveTheme();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.font = font;
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
      localStorage.setItem(LAST_UID_KEY, boundUserId);
    }
    localStorage.setItem(GLOBAL_KEY, mode);
    localStorage.setItem(FONT_KEY, font);
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
  if (!FONTS.includes(next) || next === font) return;
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

/**
 * Bind the theme to an account — call when /auth/me or login resolves.
 * Priority: the server-saved preference → this browser's per-user cache → system.
 */
export function applyUserTheme(user) {
  boundUserId = user?.id ?? null;
  mode = THEME_MODES.includes(user?.theme)
    ? user.theme
    : readKey(userKey(boundUserId)) || 'system';
  font = FONTS.includes(user?.font)
    ? user.font
    : readFontKey(fontUserKey(boundUserId)) || 'system';
  persist();
  apply();
  notify();
}

/** Unbind on logout — back to a neutral guest state. */
export function clearUserTheme() {
  boundUserId = null;
  mode = 'system';
  font = 'system';
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

/** React binding: { mode, resolved, setThemeMode, font, setFont } — re-renders on change. */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, getThemeMode);
  const currentFont = useSyncExternalStore(subscribe, () => font);
  return { mode: current, resolved: forcedTheme || resolveTheme(current), setThemeMode, font: currentFont, setFont };
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
if (GUEST_PATHS.includes(window.location.pathname)) { forcedTheme = 'light'; font = 'system'; }
apply();
