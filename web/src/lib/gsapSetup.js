/**
 * gsapSetup — single registration point for GSAP + ScrollTrigger.
 *
 * Import { gsap, ScrollTrigger } from here instead of 'gsap' directly so the
 * plugin is registered exactly once, no matter how many pages use it.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/** True when the OS asks for reduced motion — callers render content
 *  statically (final state) instead of animating toward it. */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export { gsap, ScrollTrigger };
