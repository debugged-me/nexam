/**
 * Reveal — scroll-into-view entrance. Wraps a card/section; children rise
 * and fade in once, when first seen. Reduced-motion renders instantly.
 * Pass the wrapped element's classes through `className` so layout (grids,
 * mb-*) stays on this node — no extra wrapper div.
 */
import { motion, useReducedMotion } from 'motion/react';
import { SPRING_SOFT } from '../lib/motion.js';

export default function Reveal({ children, className, delay = 0, ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px 0px' }}
      transition={{ ...SPRING_SOFT, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
