/**
 * EmptyStateArt — looping Lottie illustration for `.empty-state` blocks.
 *
 * Renders the shared `emptyStateArt` animation (paper + sweeping magnifier)
 * centered above the empty-state copy. Honors prefers-reduced-motion by
 * holding the first frame instead of looping. Purely decorative — hidden
 * from assistive tech and suppressed in print (see print.css).
 */
import { LottieLight } from 'lottie-react';
import { useReducedMotion } from 'motion/react';
import emptyStateArt from '../assets/emptyStateArt.js';

export default function EmptyStateArt({ size = 140 }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="empty-art" style={{ width: size, height: size * 0.75 }} aria-hidden="true">
      <LottieLight src={emptyStateArt} autoplay={!reduceMotion} loop style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
