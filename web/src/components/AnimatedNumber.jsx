/**
 * AnimatedNumber — KPI/stat figure that animates between values instead of
 * snapping. Plain numbers use NumberFlow (per-digit roll); callers needing a
 * custom `format` function keep the motion spring path since NumberFlow
 * formats via Intl.NumberFormat only. `suffix`/`decimals` cover the common
 * "92.4%" cases and roll like the rest.
 */
import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion, useSpring, useTransform } from 'motion/react';

function SpringNumber({ value, format }) {
  const spring = useSpring(0, { stiffness: 140, damping: 28 });
  const display = useTransform(spring, (v) => format(v));
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span>{display}</motion.span>;
}

export default function AnimatedNumber({ value = 0, format, suffix, decimals }) {
  const num = Number(value) || 0;
  // NumberFlow only animates on value *changes* — mount at 0, then hand it the
  // real value a frame later so the first paint rolls up like the spring did.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(num));
    return () => cancelAnimationFrame(id);
  }, [num]);
  if (format) return <SpringNumber value={num} format={format} />;
  return (
    <NumberFlow
      value={shown}
      format={
        decimals != null
          ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
          : undefined
      }
      suffix={suffix}
      respectMotionPreference
      transformTiming={{ duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }}
      spinTiming={{ duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' }}
      opacityTiming={{ duration: 200 }}
      willChange
    />
  );
}
