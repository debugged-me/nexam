/**
 * motion.js — the JS half of the motion spec (tokens.css holds the CSS vars).
 * One easing ramp for everything: EASE_ENTER for arrivals, EASE_STANDARD for
 * layout/state moves. Durations in seconds — match --dur-1/2/3.
 */
export const EASE_ENTER = [0.16, 1, 0.3, 1];
export const EASE_STANDARD = [0.32, 0.72, 0, 1];
export const EASE_REVEAL = [0.22, 1, 0.36, 1];

/** Spring presets — physical motion for entrances and interactive surfaces.
 *  SNAPPY: small controls and menus. SOFT: larger surfaces (cards, modals,
 *  reveals) where overshoot must stay subtle. */
export const SPRING_SNAPPY = { type: 'spring', stiffness: 480, damping: 34, mass: 0.8 };
export const SPRING_SOFT = { type: 'spring', stiffness: 240, damping: 28 };

export const DUR = {
  fast: 0.16,
  med: 0.28,
  slow: 0.55,
};
