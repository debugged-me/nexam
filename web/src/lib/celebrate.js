/**
 * celebrate — a short confetti burst for "shipped it" moments (exam sets
 * generated, TOS finalized). Colors come from live tokens so light/dark
 * themes stay on-brand; suppressed under prefers-reduced-motion.
 */
import confetti from 'canvas-confetti';
import { prefersReducedMotion } from './gsapSetup.js';

function brandColors() {
  const cs = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return [
    pick('--action-600', '#2D93E8'),
    pick('--brand-accent', '#7C5CFC'),
    pick('--green-600', '#23A265'),
    pick('--amber-600', '#B07D1E'),
  ];
}

export default function celebrate() {
  if (prefersReducedMotion()) return;
  const colors = brandColors();
  confetti({
    particleCount: 80,
    spread: 65,
    startVelocity: 32,
    gravity: 0.9,
    ticks: 160,
    origin: { x: 0.5, y: 0.62 },
    colors,
    disableForReducedMotion: true,
  });
}
