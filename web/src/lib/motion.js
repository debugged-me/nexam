/**
 * motion.js — the JS half of the motion spec (tokens.css holds the CSS vars).
 * One easing ramp for everything: EASE_ENTER for arrivals, EASE_STANDARD for
 * layout/state moves. Durations in seconds — match --dur-1/2/3.
 */
export const EASE_ENTER = [0.16, 1, 0.3, 1];
export const EASE_STANDARD = [0.32, 0.72, 0, 1];
export const EASE_REVEAL = [0.22, 1, 0.36, 1];

export const DUR = {
  fast: 0.16,
  med: 0.28,
  slow: 0.55,
};
