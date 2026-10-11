/**
 * guide.js — on-demand guided tours (Driver.js), manager singleton.
 *
 * MANUAL START ONLY — this is the contract the whole feature is built on:
 * `startGuidedTour` is invoked exclusively from the Help button's click
 * handler in AppLayout. Nothing calls it on mount, login, route change,
 * refresh, or any other lifecycle hook, and no persisted flag may ever
 * trigger a start. `stopGuidedTour` is safe to call from lifecycle hooks —
 * teardown is not a start.
 *
 * Tours are explanatory-only highlights: they never click, fill, submit, or
 * otherwise drive the UI, which is what keeps them safe around exam flows.
 */
import 'driver.js/dist/driver.css';
import '../styles/help.css';
import { resolveTour } from './tours.js';

let activeDriver = null;   // Driver instance of the running tour
let activeTour = null;     // tour definition of the running tour
let activeStepCount = 0;   // resolved steps, for the step chip + dots
let starting = false;      // guards a double click while driver.js lazy-loads
let returnFocusToHelp = false;

const HELP_BUTTON_SEL = '[data-tour="shell-help"]';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Lazy-load Driver.js — nothing is fetched until the first Help click. */
async function loadDriver() {
  const mod = await import('driver.js');
  return mod.driver;
}

/** Element rendered AND not CSS-hidden (display:none / visibility:hidden). */
function isTargetable(el) {
  if (!(el instanceof Element) || !el.getClientRects().length) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/**
 * Turn a tour definition into driver steps, keeping only targets that are
 * actually on screen for this viewport and role. Selectors stay as strings so
 * driver.js re-resolves them when each step is shown (content may mount
 * between steps); `skipMissingElement` covers the residual race.
 */
function resolveSteps(tour) {
  const steps = [];
  for (const def of tour.steps) {
    if (def.minWidth && window.innerWidth < def.minWidth) continue;
    if (def.maxWidth && window.innerWidth > def.maxWidth) continue;
    const popover = { title: def.title, description: def.description };
    if (def.side) popover.side = def.side;
    if (def.align) popover.align = def.align;
    if (!def.sel) {
      steps.push({ popover });
      continue;
    }
    const el = document.querySelector(def.sel);
    if (!el || !isTargetable(el)) continue;
    steps.push({ element: def.sel, popover });
  }
  return steps;
}

/* The guide's professor mascot — drawn from palette tokens only (works in
   light and dark). Exported so the topbar button and the popover header share
   the same character. Animations (wave, blink, sparkle) are CSS keyframes,
   all silenced under prefers-reduced-motion. */
export const GUIDE_AVATAR_SVG = `<svg class="nx-guide-avatar-svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <path class="nx-guide-sparkle" d="M6.5 14.5 l1.1 2.6 2.6 1.1 -2.6 1.1 -1.1 2.6 -1.1 -2.6 -2.6 -1.1 2.6 -1.1 z" fill="var(--amber-600)"/>
  <path class="nx-guide-sparkle nx-guide-sparkle--b" d="M40.5 6.5 l.9 2 2 .9 -2 .9 -.9 2 -.9 -2 -2 -.9 2 -.9 z" fill="var(--action-400)"/>
  <circle cx="24" cy="29" r="13" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="1.4"/>
  <path d="M10.5 18 L24 11.5 L37.5 18 L24 24.5 Z" fill="var(--ink)"/>
  <path d="M35 19.6 V25.2" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="35" cy="27.4" r="1.7" fill="var(--amber-600)"/>
  <g class="nx-guide-eyes" fill="var(--ink)">
    <circle cx="19.6" cy="29" r="1.15"/>
    <circle cx="28.4" cy="29" r="1.15"/>
  </g>
  <circle cx="19.6" cy="29" r="3.4" stroke="var(--ink)" stroke-width="1.4"/>
  <circle cx="28.4" cy="29" r="3.4" stroke="var(--ink)" stroke-width="1.4"/>
  <path d="M23 29 h2" stroke="var(--ink)" stroke-width="1.4"/>
  <path d="M16.2 28.3 L13.4 27.2" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M31.8 28.3 L34.6 27.2" stroke="var(--ink)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M20.4 34.4 Q24 36.8 27.6 34.4" stroke="var(--ink)" stroke-width="1.5" stroke-linecap="round"/>
  <g class="nx-guide-avatar-arm">
    <path d="M36 36.5 Q41 36.8 42.4 32.3" stroke="var(--ink)" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="43" cy="30.4" r="2.1" fill="var(--amber-600)"/>
  </g>
</svg>`;

/**
 * Dress the driver.js popover: branded header band (mascot + tour name +
 * step chip) and a dot track in the footer. Called on every step render, so
 * it updates the chip/dots and re-fires the pop-in transition each time.
 */
function mountChrome(popover, opts) {
  const { wrapper } = popover;
  const index = opts.index ?? opts.state.activeIndex ?? 0;
  const total = activeStepCount || 1;

  let head = wrapper.querySelector('.nx-tour-head');
  if (!head) {
    head = document.createElement('div');
    head.className = 'nx-tour-head';
    head.innerHTML =
      `<span class="nx-tour-avatar" aria-hidden="true">${GUIDE_AVATAR_SVG}</span>` +
      `<span class="nx-tour-meta"><span class="nx-tour-kicker">nexam guide</span>` +
      `<span class="nx-tour-name"></span></span>` +
      `<span class="nx-tour-step"></span>`;
    wrapper.insertBefore(head, popover.title);
  }
  head.querySelector('.nx-tour-name').textContent = activeTour?.name || 'Guide';
  head.querySelector('.nx-tour-step').textContent = `${index + 1} / ${total}`;

  let dots = wrapper.querySelector('.nx-tour-dots');
  if (!dots) {
    dots = document.createElement('div');
    dots.className = 'nx-tour-dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < total; i++) dots.appendChild(document.createElement('span'));
    popover.footer.insertBefore(dots, popover.footerButtons);
  }
  dots.querySelectorAll('span').forEach((dot, i) => {
    dot.classList.toggle('on', i === index);
    dot.classList.toggle('past', i < index);
  });

  // Re-fire the entrance transition on every step.
  if (!window.matchMedia(REDUCED_MOTION).matches) {
    wrapper.classList.remove('nx-pop');
    void wrapper.offsetWidth;
    wrapper.classList.add('nx-pop');
  }
}

function handleDestroyed() {
  activeDriver = null;
  activeTour = null;
  activeStepCount = 0;
  if (returnFocusToHelp) {
    returnFocusToHelp = false;
    const button = document.querySelector(HELP_BUTTON_SEL);
    if (button instanceof HTMLElement) {
      // After React/RAF settle so the closed popover can't steal it back.
      requestAnimationFrame(() => button.focus());
    }
  }
}

/**
 * Start the tour for the current screen. Returns {started, message?} — the
 * caller toasts `message` when help is unavailable here. Async because
 * driver.js is code-split and fetched on first use.
 */
export async function startGuidedTour(pathname, role) {
  if (starting) return { started: false };
  const tour = resolveTour(pathname, role);
  if (!tour) return { started: false, message: 'No guided tour for this screen yet.' };
  const steps = resolveSteps(tour);
  if (steps.length === 0) {
    return { started: false, message: 'Nothing on this screen can be highlighted right now.' };
  }
  starting = true;
  try {
    const driverFn = await loadDriver();
    stopGuidedTour();
    const motionOK = !window.matchMedia(REDUCED_MOTION).matches;
    returnFocusToHelp = true;
    activeTour = tour;
    activeStepCount = steps.length;
    activeDriver = driverFn({
      animate: motionOK,
      smoothScroll: motionOK,
      overlayColor: 'rgb(12, 12, 14)',
      overlayOpacity: 0.55,
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: 'nx-tour',
      popoverOffset: 14,
      showProgress: false,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      closeBtnLabel: 'Close tour',
      allowClose: true,
      allowKeyboardControl: true,
      overlayClickBehavior: 'close',
      skipMissingElement: true,
      steps,
      onPopoverRender: mountChrome,
      onDestroyed: handleDestroyed,
    });
    activeDriver.drive();
    return { started: true };
  } finally {
    starting = false;
  }
}

/**
 * Tear down a running tour — called on route change, layout unmount, and
 * pagehide. Never restarts anything; the tour only ever begins from a Help
 * click. Suppresses the focus return that an in-tour close performs.
 */
export function stopGuidedTour() {
  returnFocusToHelp = false;
  const current = activeDriver;
  activeDriver = null;
  activeTour = null;
  activeStepCount = 0;
  if (current) current.destroy();
}

export function isTourActive() {
  return activeDriver !== null;
}
