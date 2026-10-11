/**
 * AnimatedNumber — KPI/stat figure that springs between values instead of
 * snapping. Respects reduced-motion via the app-level MotionConfig.
 */
import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

export default function AnimatedNumber({ value = 0, format }) {
  const spring = useSpring(0, { stiffness: 140, damping: 28 });
  const display = useTransform(spring, (v) =>
    format ? format(v) : Math.round(v).toLocaleString());

  useEffect(() => {
    spring.set(Number(value) || 0);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}
