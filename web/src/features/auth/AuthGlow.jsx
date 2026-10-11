/**
 * AuthGlow — smoke trail behind the auth card.
 *
 * Two layers on top of the page's static ambient wash:
 *  1. `.auth-glow-dot` — a big accent pool that follows the pointer on a
 *     long lag (quickTo), so it drifts like a fog bank rather than tracking.
 *  2. `<canvas>` — smoke: soft particles emitted under the cursor that
 *     expand, rise, and curl away via a sine wobble, capped at 90 live
 *     particles and paused for reduced motion or coarse pointers.
 */
import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsapSetup.js';

/** --action-600 as "r,g,b" for canvas gradients (tokens aren't canvas-aware). */
function accentRGB() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue('--action-600').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '45,147,232';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export default function AuthGlow() {
  const dotRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const dot = dotRef.current;
    const canvas = canvasRef.current;
    if (!dot || !canvas) return undefined;

    // Park the fog bank above center; only fine pointers get tracking/smoke.
    gsap.set(dot, { x: window.innerWidth * 0.5, y: window.innerHeight * 0.38 });
    if (prefersReducedMotion() || !window.matchMedia('(pointer: fine)').matches) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    const rgb = accentRGB();
    const particles = [];
    let raf = 0;
    let prevT = 0;
    let lastMove = -Infinity;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (x, y, speed) => {
      const count = Math.min(4, 1 + Math.floor(speed / 28));
      for (let i = 0; i < count; i += 1) {
        particles.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 16,
          r: 16 + Math.random() * 24,
          grow: 26 + Math.random() * 30,      // expansion is the smoke signature
          vx: (Math.random() - 0.5) * 30,
          vy: -16 - Math.random() * 30,       // buoyant rise
          life: 0,
          ttl: 1.3 + Math.random() * 1.3,
          alpha: 0.13 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (particles.length > 90) particles.splice(0, particles.length - 90);
    };

    const setX = gsap.quickTo(dot, 'x', { duration: 1.8, ease: 'power2.out' });
    const setY = gsap.quickTo(dot, 'y', { duration: 1.8, ease: 'power2.out' });
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;

    const move = (e) => {
      setX(e.clientX);
      setY(e.clientY);
      const now = performance.now();
      const dt = now - lastT;
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY; lastT = now; lastMove = now;
      if (dt > 0) spawn(e.clientX, e.clientY, dist / (dt / 1000));
    };

    const step = (t) => {
      const dt = Math.min(0.05, (t - prevT) / 1000 || 0.016);
      prevT = t;
      // Lingering puff for ~0.9s after the pointer stops — smoke settles.
      if (t - lastMove < 900 && Math.random() < 0.35) spawn(lastX, lastY, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
        const k = p.life / p.ttl;
        p.r += p.grow * dt;
        p.x += (p.vx + Math.sin(t * 0.002 + p.phase) * 22) * dt;
        p.y += p.vy * dt;
        const a = p.alpha * Math.sin(Math.PI * k); // in-out fade
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(${rgb},${(a * 0.45).toFixed(3)})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    window.addEventListener('pointermove', move, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="auth-glow" aria-hidden="true">
      <div className="auth-glow-dot" ref={dotRef} />
      <canvas className="auth-glow-smoke" ref={canvasRef} />
    </div>
  );
}
