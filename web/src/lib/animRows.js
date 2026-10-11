/**
 * animRows — shared auto-animate callback ref for row containers.
 *
 * Attach to any element whose direct children are list rows (a `<tbody>`,
 * a card list, a chip row): adds/removes/reorders then glide instead of
 * popping. `autoAnimate` does not dedupe per element, so a WeakSet guards
 * repeat attach across renders. auto-animate itself already respects
 * prefers-reduced-motion.
 */
import { autoAnimate } from '@formkit/auto-animate';

const applied = new WeakSet();

export function animateRows(el) {
  if (el && !applied.has(el)) {
    applied.add(el);
    autoAnimate(el);
  }
}
