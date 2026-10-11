/**
 * useAuthEntrance — the shared guest-page entrance timeline.
 *
 * Shell settles in, then the brand-panel elements and form fields cascade.
 * Elements opt in with the `anim-in` class. useLayoutEffect so the `from`
 * states apply before paint; prefers-reduced-motion renders final state.
 */
import { useLayoutEffect } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup.js';

export function useAuthEntrance(ref) {
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.from('.auth-shell', { y: 12, autoAlpha: 0, duration: .35, clearProps: 'transform,opacity,visibility' })
        // One tight stagger across both panels — the whole entrance lands
        // in ~.7s instead of a long per-section cascade. clearProps drops
        // the inline transform so :active/:hover scales still work after.
        .from(
          '.auth-side .anim-in, .auth-card .anim-in',
          { y: 8, autoAlpha: 0, duration: .3, stagger: .025, clearProps: 'transform,opacity,visibility' },
          '-=.15',
        );
    }, ref);
    return () => ctx.revert();
  }, [ref]);
}
