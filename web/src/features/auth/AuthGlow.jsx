/**
 * AuthGlow — cursor-following spotlight behind the auth card.
 *
 * A soft accent radial that trails the pointer (gsap.quickTo smoothing, so
 * the drift feels weighted rather than 1:1). Sits behind .auth-shell like
 * the existing ::before ambient wash. Holds a fixed position for reduced
 * motion and coarse pointers — depth without motion.
 */
import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup.js';

export default function AuthGlow() {
  const dotRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return undefined;
    // Park the glow slightly above center, behind the card, on mount.
    gsap.set(dot, { x: window.innerWidth * 0.5, y: window.innerHeight * 0.38 });
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) {
      return undefined;
    }
    const setX = gsap.quickTo(dot, 'x', { duration: 0.9, ease: 'power3.out' });
    const setY = gsap.quickTo(dot, 'y', { duration: 0.9, ease: 'power3.out' });
    const move = (e) => { setX(e.clientX); setY(e.clientY); };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  return (
    <div className="auth-glow" aria-hidden="true">
      <div className="auth-glow-dot" ref={dotRef} />
    </div>
  );
}
