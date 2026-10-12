/**
 * viewTransitions.js — same-document View Transitions for route changes.
 *
 * vtNavigate() wraps a react-router navigate() in document.startViewTransition
 * with flushSync so the destination renders before the new snapshot is taken.
 * Elements opted into the morph carry `view-transition-name` (see
 * VT_SHARED_NAME) — the exams list title → exam detail h1 is the canonical
 * shared element. `html.vt-nav` scopes the crossfade/curve CSS in app.css so
 * the theme-toggle ripple is untouched.
 *
 * Unsupported browsers and reduced-motion users get a plain navigate().
 */
import { flushSync } from 'react-dom';

export const VT_SHARED_NAME = 'vt-shared-entity';

export function canViewTransition() {
  return (
    typeof document !== 'undefined' &&
    !!document.startViewTransition &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Navigate with a view transition.
 * @param navigate   react-router's navigate()
 * @param to         destination path
 * @param sharedEl   element to morph into the destination's named element
 */
export function vtNavigate(navigate, to, { sharedEl } = {}) {
  if (!canViewTransition()) {
    navigate(to);
    return;
  }
  const html = document.documentElement;
  html.classList.add('vt-nav');
  if (sharedEl) sharedEl.style.viewTransitionName = VT_SHARED_NAME;
  const vt = document.startViewTransition(() => {
    flushSync(() => navigate(to));
  });
  // .finished rejects when the transition is skipped — swallow it after
  // cleanup so nothing surfaces as an unhandled rejection.
  vt.finished
    .catch(() => {})
    .finally(() => {
      html.classList.remove('vt-nav');
      if (sharedEl) sharedEl.style.viewTransitionName = '';
    });
}
