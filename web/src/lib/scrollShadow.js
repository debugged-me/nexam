/**
 * scrollShadow.js — flips `.is-stuck` on `.dataset-scroll` wrappers whose
 * sticky table header is pinned under the fixed topbar. Desktop headers stick
 * at `top: var(--topbar-height)` against the *window* scrollport (below
 * 1100px board.css releases sticky entirely, so detection gates on the
 * computed position). One delegated rAF-throttled listener covers every
 * current and future table — pages never wire anything themselves.
 */
export function initScrollShadows() {
  let raf = 0;
  function update() {
    raf = 0;
    const topbarH =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')) || 56;
    document.querySelectorAll('.dataset-scroll').forEach((el) => {
      const th = el.querySelector('thead > tr > th');
      if (!th) return;
      // Skip released headers (≤1100px: position static, no stick possible).
      if (getComputedStyle(th).position !== 'sticky') {
        el.classList.remove('is-stuck');
        return;
      }
      el.classList.toggle('is-stuck', th.getBoundingClientRect().top <= topbarH + 1);
    });
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true, capture: true });
  window.addEventListener('resize', schedule);
  schedule();
}
