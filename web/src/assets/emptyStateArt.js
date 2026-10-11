/**
 * emptyStateArt — hand-authored Lottie animation for `.empty-state` blocks.
 *
 * A paper sheet with text lines, a magnifier that sweeps across it, and a
 * small accent spark pulsing over the corner. 160×120 @ 30fps, 90-frame loop.
 * Palette is fixed (paper is always light — like a physical sheet) so it reads
 * in both light and dark themes.
 *
 * Consumed by EmptyStateArt.jsx (lottie-react `animationData`).
 */

const BLUE = [0.176, 0.576, 0.91, 1];      // --brand-accent #2D93E8
const BLUE_SOFT = [0.498, 0.725, 0.941, 1]; // --action-300 #7FB9F0
const PAPER = [0.957, 0.965, 0.984, 1];
const PAPER_LINE = [0.851, 0.871, 0.894, 1];
const TEXT_LINE = [0.78, 0.808, 0.871, 1];

/** Ease-in-out position keyframe helper (Lottie multi-dim format). */
const posKF = (frames) => ({
  a: 1,
  k: frames.map(([t, x, y], i) => (
    i === frames.length - 1
      ? { t, s: [x, y, 0] }
      : { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t, s: [x, y, 0] }
  )),
});

const tr = { p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } };

const line = (nm, w, x, y, wKf = null) => ({
  ty: 'gr', nm,
  it: [
    { ty: 'rc', d: 1, s: wKf || { a: 0, k: [w, 6] }, p: { a: 0, k: [x, y] }, r: { a: 0, k: [3] } },
    { ty: 'fl', c: { a: 0, k: TEXT_LINE }, o: { a: 0, k: 100 } },
    { ...tr },
  ],
});

export default {
  v: '5.7.4', fr: 30, ip: 0, op: 90, w: 160, h: 120, ddd: 0,
  nm: 'nexam-empty-state',
  assets: [],
  layers: [
    /* Spark — small accent dot pulsing at the sheet's top-right corner. */
    {
      ddd: 0, ind: 1, ty: 4, nm: 'spark', sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [118, 32, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 8, s: [0, 0, 100] },
            { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 26, s: [100, 100, 100] },
            { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 66, s: [100, 100, 100] },
            { t: 84, s: [0, 0, 100] },
          ],
        },
      },
      ao: 0,
      shapes: [{
        ty: 'gr', nm: 'dot',
        it: [
          { ty: 'el', d: 1, s: { a: 0, k: [11, 11] }, p: { a: 0, k: [0, 0] } },
          { ty: 'fl', c: { a: 0, k: BLUE_SOFT }, o: { a: 0, k: 100 } },
          { ...tr },
        ],
      }],
      ip: 0, op: 90, st: 0,
    },
    /* Magnifier — sweeps right across the lines, dips to the lower line,
       returns. Stroke ring + rotated rounded-rect handle. */
    {
      ddd: 0, ind: 2, ty: 4, nm: 'lens', sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: posKF([[0, 62, 52], [32, 96, 52], [64, 80, 70], [90, 62, 52]]),
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr', nm: 'ring',
          it: [
            { ty: 'el', d: 1, s: { a: 0, k: [30, 30] }, p: { a: 0, k: [0, 0] } },
            { ty: 'st', c: { a: 0, k: BLUE }, o: { a: 0, k: 100 }, w: { a: 0, k: 4.5 }, lc: 2, lj: 2 },
            { ...tr },
          ],
        },
        {
          ty: 'gr', nm: 'handle',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [6.5, 17] }, p: { a: 0, k: [0, 22] }, r: { a: 0, k: [3] } },
            { ty: 'fl', c: { a: 0, k: BLUE }, o: { a: 0, k: 100 } },
            { ...tr, r: { a: 0, k: 45 } },
          ],
        },
      ],
      ip: 0, op: 90, st: 0,
    },
    /* Paper sheet — static body, three text lines; the middle line grows
       and shrinks like a line being written. */
    {
      ddd: 0, ind: 3, ty: 4, nm: 'paper', sr: 1,
      ks: {
        o: { a: 0, k: 100 }, r: { a: 0, k: 0 },
        p: { a: 0, k: [80, 62, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr', nm: 'sheet',
          it: [
            { ty: 'rc', d: 1, s: { a: 0, k: [88, 104] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: [8] } },
            { ty: 'fl', c: { a: 0, k: PAPER }, o: { a: 0, k: 100 } },
            { ty: 'st', c: { a: 0, k: PAPER_LINE }, o: { a: 0, k: 100 }, w: { a: 0, k: 1.5 }, lc: 2, lj: 2 },
            { ...tr },
          ],
        },
        line('line-1', 56, -6, -28),
        line('line-2', 44, -12, -8, {
          a: 1,
          k: [
            { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 10, s: [44, 6] },
            { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 50, s: [60, 6] },
            { t: 86, s: [44, 6] },
          ],
        }),
        line('line-3', 50, -9, 12),
        line('line-4', 30, -19, 32),
      ],
      ip: 0, op: 90, st: 0,
    },
  ],
};
