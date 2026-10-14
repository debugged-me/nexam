/**
 * reportCharts.js — render Chart.js charts to PNG data-URLs at export time.
 *
 * Used by exports.js to embed real charts inside generated workbooks. Charts
 * draw on a detached canvas at 2x, no animation, fixed light palette so the
 * file looks identical whether the app is in dark mode or not.
 */
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Filler, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  Filler, Tooltip, Legend
);

const C = {
  blue: '#2E7CD6', green: '#23A265', amber: '#B07D1E', red: '#DC4445',
  ink: '#3D3D3A', ink3: '#6F6E69', grid: '#E8EBEF',
};

/** Score band colors — mirrors AnalyticsCharts' ≥75 green / ≥50 amber rule. */
export function bandColor(rate) {
  if (rate >= 75) return C.green;
  if (rate >= 50) return C.amber;
  return C.red;
}

const whiteBg = {
  id: 'whiteBg',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

const baseTicks = { color: C.ink3, font: { size: 11, family: "'Sora','Inter',system-ui,sans-serif" } };

function render(config, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w * 2;
  canvas.height = h * 2;
  const chart = new ChartJS(canvas.getContext('2d'), {
    ...config,
    options: {
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      devicePixelRatio: 2,
      ...config.options,
      plugins: { legend: { display: false }, tooltip: { enabled: false }, ...(config.options?.plugins || {}) },
    },
    plugins: [whiteBg],
  });
  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  return { dataUrl, w, h };
}

/**
 * Vertical/horizontal bars. Pass `banded: true` to color each bar by the
 * 75/50 correct-rate bands, or `color` for a flat accent.
 */
export function barsPng({ labels, values, horizontal = false, banded = false, colors = null, color = C.blue, w = 620, h = 250, pct = true, maxLabel = 26 }) {
  const clip = (s) => (String(s).length > maxLabel ? `${String(s).slice(0, maxLabel)}…` : String(s));
  const axis = pct ? { min: 0, max: 100, ticks: { ...baseTicks, callback: (v) => `${v}%` } }
                   : { beginAtZero: true, ticks: { ...baseTicks, precision: 0 } };
  return render({
    type: 'bar',
    data: {
      labels: labels.map(clip),
      datasets: [{
        data: values.map(Number),
        backgroundColor: colors || values.map((v) => (banded ? bandColor(Number(v)) : color)),
        borderRadius: 5,
        barThickness: horizontal ? 15 : undefined,
        maxBarThickness: horizontal ? 17 : 36,
      }],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      scales: horizontal
        ? { x: { ...axis, grid: { color: C.grid }, border: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { ...baseTicks, autoSkip: false } } }
        : { y: { ...axis, grid: { color: C.grid }, border: { display: false } }, x: { grid: { display: false }, border: { display: false }, ticks: { ...baseTicks, maxRotation: 0, autoSkip: true } } },
    },
  }, w, h);
}

/** Single-series smooth line with soft fill — score trends over time. */
export function linePng({ labels, values, color = C.green, w = 620, h = 230, pct = true, maxLabel = 16 }) {
  const clip = (s) => (String(s).length > maxLabel ? `${String(s).slice(0, maxLabel)}…` : String(s));
  const axis = pct ? { min: 0, max: 100, ticks: { ...baseTicks, callback: (v) => `${v}%` } }
                   : { beginAtZero: true, ticks: { ...baseTicks, precision: 0 } };
  return render({
    type: 'line',
    data: {
      labels: labels.map(clip),
      datasets: [{
        data: values.map(Number),
        borderColor: color,
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        backgroundColor: `${color}30`,
        pointRadius: 4,
        pointBackgroundColor: values.map((v) => (pct ? bandColor(Number(v)) : color)),
        pointBorderColor: 'transparent',
      }],
    },
    options: {
      scales: {
        y: { ...axis, grid: { color: C.grid }, border: { display: false } },
        x: { grid: { display: false }, border: { display: false }, ticks: { ...baseTicks, maxRotation: 0, autoSkip: true } },
      },
    },
  }, w, h);
}

/** Multi-series line — e.g. sign-ins vs succeeded vs scans per month. */
export function multiLinePng({ labels, series, w = 620, h = 240 }) {
  return render({
    type: 'line',
    data: {
      labels,
      datasets: series.map((s, i) => ({
        label: s.label,
        data: s.values.map(Number),
        borderColor: s.color || [C.blue, C.green, C.amber][i % 3],
        borderWidth: 2,
        tension: 0.35,
        pointRadius: 3,
        pointBackgroundColor: s.color || [C.blue, C.green, C.amber][i % 3],
      })),
    },
    options: {
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: C.ink3, boxWidth: 10, boxHeight: 10, font: { size: 10 } } },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, ticks: { ...baseTicks, precision: 0 } },
        x: { grid: { display: false }, border: { display: false }, ticks: { ...baseTicks, maxRotation: 0 } },
      },
    },
  }, w, h);
}
