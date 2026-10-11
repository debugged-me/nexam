/**
 * theme.js — light / dark / system appearance mode.
 *
 * The mode persists in localStorage; the resolved value is applied as
 * `data-theme` on <html> so tokens.css can switch the palette. "system"
 * follows the OS via matchMedia and re-applies live when it changes.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'nexam.theme';
export const THEME_MODES = ['light', 'dark', 'system'];
const listeners = new Set();

function read() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return THEME_MODES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

let mode = read();

export function resolveTheme(m = mode) {
  if (m !== 'system') return m;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function apply() {
  const resolved = resolveTheme();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function getThemeMode() {
  return mode;
}

export function setThemeMode(next) {
  if (!THEME_MODES.includes(next) || next === mode) return;
  mode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* private mode — keep it in memory only */ }
  apply();
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** React binding: { mode, resolved, setThemeMode } — re-renders on change. */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, getThemeMode);
  return { mode: current, resolved: resolveTheme(current), setThemeMode };
}

// Follow the OS live while the mode is "system".
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (mode !== 'system') return;
    apply();
    listeners.forEach((fn) => fn());
  });
}

// Apply before first render — module is imported at app entry.
apply();
