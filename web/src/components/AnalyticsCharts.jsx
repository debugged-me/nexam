/**
 * AnalyticsCharts — Chart.js wrappers for the analytics dashboards.
 *
 * Colors resolve from the design tokens at render time so charts follow the
 * active light/dark theme. Animations are Chart.js defaults with a slight
 * ease-out so cards feel alive without being noisy.
 */
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  ScatterController,
  Filler, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line, Radar, Doughnut, Scatter } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  ScatterController,
  Filler, Tooltip, Legend
);

ChartJS.defaults.font.family = "'Sora', 'Inter', 'Google Sans', system-ui, sans-serif";

/** Read a CSS custom property from the active theme. */
function cssVar(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette() {
  return {
    green: cssVar('--green-600', '#23A265'),
    amber: cssVar('--amber-600', '#B07D1E'),
    red: cssVar('--red-600', '#DC4445'),
    blue: cssVar('--blue-600', '#2E7CD6'),
    ink: cssVar('--ink-3', '#6F6E69'),
    ink2: cssVar('--ink-2', '#3D3D3A'),
    grid: cssVar('--line', '#E8EBEF'),
    surface: cssVar('--surface-2', '#F1F0F5'),
  };
}

/** Band color for a correct-rate value: ≥75 green, 50–74 amber, <50 red. */
function bandColor(rate, p) {
  if (rate >= 75) return p.green;
  if (rate >= 50) return p.amber;
  return p.red;
}

const ANIM = { duration: 800, easing: 'easeOutQuart' };

/**
 * Canvas is invisible to assistive tech — every chart ships a screen-reader
 * data table and an img-role summary so the numbers are accessible without
 * the picture.
 */
function ChartFigure({ label, columns, rows, height, children }) {
  return (
    <figure className="chart-figure" style={{ height, margin: 0 }} role="img" aria-label={label}>
      {children}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const tooltipBase = (p) => ({
  backgroundColor: p.ink2,
  titleFont: { weight: '700' },
  bodyFont: { weight: '500' },
  padding: 10,
  cornerRadius: 8,
  displayColors: false,
});

/**
 * Horizontal mastery bars — one per topic or Bloom level.
 * Height grows with row count; the parent can scroll if it caps the height.
 */
export function MasteryBarChart({ rows, height }) {
  const p = palette();
  const h = height || Math.max(160, rows.length * 38 + 16);
  const data = {
    labels: rows.map((r) => r.name),
    datasets: [{
      data: rows.map((r) => Number(r.correctRate || 0)),
      backgroundColor: rows.map((r) => bandColor(Number(r.correctRate || 0), p)),
      borderRadius: 6,
      barThickness: 14,
      maxBarThickness: 16,
    }],
  };
  const options = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    animation: { ...ANIM, duration: 700, delay: (ctx) => ctx.dataIndex * 70 },
    scales: {
      x: {
        min: 0, max: 100,
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, callback: (v) => `${v}%` },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: p.ink2,
          font: { size: 11, weight: '600' },
          autoSkip: false,
          callback: function (v) {
            const label = this.getLabelForValue(v);
            return label.length > 24 ? `${label.slice(0, 24)}…` : label;
          },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(p),
        callbacks: {
          label: (ctx) => {
            const r = rows[ctx.dataIndex];
            return ` ${Number(r.correctRate || 0).toFixed(1)}% correct · ${r.items} item${r.items === 1 ? '' : 's'} · ${r.responses} responses`;
          },
        },
      },
    },
  };
  return (
    <ChartFigure
      label={`Mastery chart — ${rows.length} groups, percent correct each`}
      columns={['Topic', '% correct', 'Items', 'Responses']}
      rows={rows.map((r) => [r.name, `${Number(r.correctRate || 0).toFixed(1)}%`, r.items, r.responses])}
      height={h}
    >
      <Bar data={data} options={options} />
    </ChartFigure>
  );
}

/** Radar over the six Bloom levels — the cognitive "shape" of the class. */
export function BloomRadarChart({ rows, order, labels }) {
  const p = palette();
  const byLevel = {};
  for (const r of rows) byLevel[r.bloom] = r;
  const data = {
    labels: order.map((l) => labels[l] || l),
    datasets: [{
      data: order.map((l) => (byLevel[l] ? Number(byLevel[l].correctRate || 0) : null)),
      backgroundColor: `${p.blue}26`,
      borderColor: p.blue,
      borderWidth: 2,
      pointBackgroundColor: order.map((l) => (byLevel[l] ? bandColor(Number(byLevel[l].correctRate || 0), p) : p.surface)),
      pointBorderColor: p.blue,
      pointRadius: 4,
      spanGaps: true,
    }],
  };
  const options = {
    maintainAspectRatio: false,
    animation: { duration: 1200, easing: 'easeOutQuart' },
    scales: {
      r: {
        min: 0, max: 100,
        grid: { color: p.grid },
        angleLines: { color: p.grid },
        backgroundColor: 'transparent',
        pointLabels: { color: p.ink2, font: { size: 11, weight: '600' } },
        ticks: {
          stepSize: 25,
          font: { size: 9 },
          color: p.ink,
          backdropColor: 'transparent',
          callback: (v) => `${v}%`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(p),
        callbacks: {
          label: (ctx) => {
            const r = byLevel[order[ctx.dataIndex]];
            return r
              ? ` ${Number(r.correctRate || 0).toFixed(1)}% correct · ${r.items} items · ${r.responses} responses`
              : ' no scored responses yet';
          },
        },
      },
    },
  };
  return (
    <ChartFigure
      label="Cognitive level radar — percent correct per Bloom level"
      columns={['Bloom level', '% correct', 'Items', 'Responses']}
      rows={order.map((l) => {
        const r = byLevel[l];
        return [labels[l] || l, r ? `${Number(r.correctRate || 0).toFixed(1)}%` : 'no data', r?.items ?? '—', r?.responses ?? '—'];
      })}
      height={300}
    >
      <Radar data={data} options={options} />
    </ChartFigure>
  );
}

/** Daily class-average line — smooth curve with soft fill. */
export function TrendLineChart({ trend }) {
  const p = palette();
  const labels = trend.map((t) => {
    const d = new Date(t.day);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const avgs = trend.map((t) => Number(t.avg_score || 0));
  const data = {
    labels,
    datasets: [{
      data: avgs,
      fill: true,
      tension: 0.4,
      borderColor: p.green,
      borderWidth: 2,
      backgroundColor: (context) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return `${p.green}1F`;
        const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, `${p.green}38`);
        g.addColorStop(1, `${p.green}00`);
        return g;
      },
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: avgs.map((a) => bandColor(a, p)),
      pointBorderColor: 'transparent',
    }],
  };
  const options = {
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart', delay: (ctx) => ctx.dataIndex * 60 },
    scales: {
      y: {
        min: 0, max: 100,
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, callback: (v) => `${v}%` },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(p),
        callbacks: {
          title: (items) => `Scans on ${items[0].label}`,
          label: (ctx) => ` ${Number(ctx.raw).toFixed(1)}% class average · ${trend[ctx.dataIndex].scans} scans`,
        },
      },
    },
  };
  return (
    <ChartFigure
      label="Score trend — class average per scan day"
      columns={['Day', 'Class average', 'Scans']}
      rows={trend.map((t, i) => [labels[i], `${avgs[i].toFixed(1)}%`, t.scans])}
      height={210}
    >
      <Line data={data} options={options} />
    </ChartFigure>
  );
}

/** Score distribution histogram — bins tinted by the pass mark. */
export function DistBarChart({ distMap, bins }) {
  const p = palette();
  const counts = bins.map((b) => distMap[b] || 0);
  const data = {
    labels: bins.map((b) => `${b}-${b + 9}`),
    datasets: [{
      data: counts,
      // Color by bin midpoint vs the 75% pass mark
      backgroundColor: bins.map((b) => bandColor(b + 5, p)),
      borderRadius: 5,
      maxBarThickness: 34,
    }],
  };
  const options = {
    maintainAspectRatio: false,
    animation: { ...ANIM, delay: (ctx) => ctx.dataIndex * 80 },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, precision: 0 },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 } },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipBase(p),
        callbacks: {
          title: (items) => `Score ${items[0].label}%`,
          label: (ctx) => ` ${ctx.raw} student${ctx.raw === 1 ? '' : 's'}`,
        },
      },
    },
  };
  return (
    <ChartFigure
      label="Score distribution — students per 10-point score band"
      columns={['Score band', 'Students']}
      rows={bins.map((b, i) => [`${b}–${b + 9}%`, counts[i]])}
      height={240}
    >
      <Bar data={data} options={options} />
    </ChartFigure>
  );
}

/**
 * Shades the "ideal difficulty" band and the fair-discrimination threshold
 * behind the scatter — classic item-analysis quadrant reading.
 */
const itemZonesPlugin = {
  id: 'itemZones',
  beforeDraw(chart, _args, opts) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !opts) return;
    ctx.save();
    // Ideal difficulty corridor: 30–70% correct.
    const x1 = scales.x.getPixelForValue(30);
    const x2 = scales.x.getPixelForValue(70);
    ctx.fillStyle = opts.band;
    ctx.fillRect(x1, chartArea.top, x2 - x1, chartArea.bottom - chartArea.top);
    // Fair discrimination threshold at r = .2 and the zero line.
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = opts.warn;
    ctx.beginPath();
    const yT = scales.y.getPixelForValue(0.2);
    ctx.moveTo(chartArea.left, yT); ctx.lineTo(chartArea.right, yT); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = opts.axis;
    ctx.beginPath();
    const y0 = scales.y.getPixelForValue(0);
    ctx.moveTo(chartArea.left, y0); ctx.lineTo(chartArea.right, y0); ctx.stroke();
    ctx.restore();
  },
};

/**
 * Item quality map — difficulty index (% correct, x) against the corrected
 * point-biserial discrimination (y). Upper band = strong items; below the
 * dashed r=.2 line = items that don't separate strong from weak students.
 */
export function ItemScatterChart({ items }) {
  const p = palette();
  const points = (items || []).filter((it) => it.discrimination !== null && it.discrimination !== undefined);
  const colorFor = (it) => {
    if (it.discrimination >= 0.3) return p.green;
    if (it.discrimination >= 0.15) return p.amber;
    return p.red;
  };
  const data = {
    datasets: [{
      data: points.map((it) => ({ x: it.correctRate, y: it.discrimination, item: it })),
      backgroundColor: points.map((it) => `${colorFor(it)}CC`),
      borderColor: points.map(colorFor),
      borderWidth: 1.5,
      pointRadius: 6,
      pointHoverRadius: 8,
    }],
  };
  const options = {
    maintainAspectRatio: false,
    animation: { ...ANIM, delay: (ctx) => ctx.dataIndex * 25 },
    scales: {
      x: {
        min: 0, max: 100,
        title: { display: true, text: 'Difficulty — % correct', color: p.ink, font: { size: 11, weight: '600' } },
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, callback: (v) => `${v}%` },
      },
      y: {
        suggestedMin: -0.2, suggestedMax: 0.8,
        title: { display: true, text: 'Discrimination (point-biserial r)', color: p.ink, font: { size: 11, weight: '600' } },
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 } },
      },
    },
    plugins: {
      legend: { display: false },
      itemZones: { band: `${p.blue}14`, warn: p.amber, axis: p.grid },
      tooltip: {
        ...tooltipBase(p),
        callbacks: {
          title: (items) => {
            const it = items[0].raw.item;
            return `Item ${it.itemNumber}${it.set ? ` · Set ${it.set}` : ''}`;
          },
          label: (ctx) => {
            const it = ctx.raw.item;
            const stem = it.stem ? (it.stem.length > 44 ? `${it.stem.slice(0, 44)}…` : it.stem) : '';
            return ` ${it.correctRate}% correct · r = ${it.discrimination}${stem ? ` — ${stem}` : ''}`;
          },
        },
      },
    },
  };
  return (
    <ChartFigure
      label="Item quality map — difficulty versus discrimination per item"
      columns={['Item', 'Set', '% correct', 'Discrimination r']}
      rows={points.map((it) => [it.itemNumber, it.set || '—', `${it.correctRate}%`, it.discrimination])}
      height={300}
    >
      <Scatter data={data} options={options} plugins={[itemZonesPlugin]} />
    </ChartFigure>
  );
}

/** Compact horizontal bars for raw counts — question mix, per-set sizes. */
export function CountsBarChart({ rows, height }) {
  const p = palette();
  const h = height || Math.max(120, rows.length * 30 + 12);
  const data = {
    labels: rows.map((r) => r.name),
    datasets: [{
      data: rows.map((r) => Number(r.n || 0)),
      backgroundColor: rows.map((r) => r.color || (r.var ? cssVar(r.var, p.blue) : p.blue)),
      borderRadius: 5,
      barThickness: 12,
      maxBarThickness: 14,
    }],
  };
  const options = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    animation: { ...ANIM, duration: 650, delay: (ctx) => ctx.dataIndex * 55 },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, precision: 0 },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: p.ink2, font: { size: 10.5, weight: '600' }, autoSkip: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: { ...tooltipBase(p), callbacks: { label: (ctx) => ` ${ctx.raw}` } },
    },
  };
  return (
    <ChartFigure
      label="Count breakdown"
      columns={['Group', 'Count']}
      rows={rows.map((r) => [r.name, r.n])}
      height={h}
    >
      <Bar data={data} options={options} />
    </ChartFigure>
  );
}

/** Multi-series monthly line — sign-ins vs succeeded vs scans over time. */
export function LoginTrendChart({ rows }) {
  const p = palette();
  const labels = rows.map((r) => r.month);
  const series = [
    { key: 'logins', label: 'Sign-ins', color: p.blue },
    { key: 'succeeded', label: 'Succeeded', color: p.green },
    { key: 'scans', label: 'Scans', color: p.amber },
  ];
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: rows.map((r) => Number(r[s.key] || 0)),
      borderColor: s.color,
      backgroundColor: `${s.color}2E`,
      borderWidth: 2,
      tension: 0.35,
      fill: false,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBackgroundColor: s.color,
    })),
  };
  const options = {
    maintainAspectRatio: false,
    animation: { ...ANIM, delay: (ctx) => ctx.dataIndex * 45 },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: p.grid },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, precision: 0 },
      },
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: p.ink, font: { size: 10 }, maxRotation: 0 },
      },
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: p.ink, font: { size: 10.5, weight: '500' }, boxWidth: 10, boxHeight: 10, padding: 12 },
      },
      tooltip: { ...tooltipBase(p) },
    },
  };
  return (
    <ChartFigure
      label="Activity by month — sign-ins, succeeded sign-ins, and scans"
      columns={['Month', ...series.map((s) => s.label)]}
      rows={rows.map((r, i) => [labels[i], ...series.map((s) => r[s.key] || 0)])}
      height={240}
    >
      <Line data={data} options={options} />
    </ChartFigure>
  );
}

/** Center-text plugin for the pass-rate doughnut. */
const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart, _args, opts) {
    if (!opts || !opts.text) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data[0]) return;
    const { x, y } = meta.data[0];
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 1.5rem ${ChartJS.defaults.font.family}`;
    ctx.fillStyle = opts.color;
    ctx.fillText(opts.text, x, y - 6);
    ctx.font = `500 0.66rem ${ChartJS.defaults.font.family}`;
    ctx.fillStyle = opts.subColor;
    ctx.fillText(opts.subtext || '', x, y + 16);
    ctx.restore();
  },
};

/** Pass/fail doughnut with the pass rate printed in the middle. */
export function PassDoughnut({ passing, failing }) {
  const p = palette();
  const total = passing + failing;
  const passRate = total ? Math.round((passing / total) * 100) : 0;
  const data = {
    labels: ['Passed', 'Below pass'],
    datasets: [{
      data: [passing, failing],
      backgroundColor: [p.green, p.red],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };
  const options = {
    maintainAspectRatio: false,
    cutout: '72%',
    animation: { animateRotate: true, animateScale: true, duration: 1300, easing: 'easeOutQuart' },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: p.ink, font: { size: 11, weight: '500' }, boxWidth: 10, boxHeight: 10, padding: 14 },
      },
      tooltip: {
        ...tooltipBase(p),
        callbacks: { label: (ctx) => ` ${ctx.raw} of ${total} sheets` },
      },
      centerText: { text: `${passRate}%`, subtext: 'pass rate', color: p.ink2, subColor: p.ink },
    },
  };
  return (
    <ChartFigure
      label={`Pass rate — ${passRate}% of ${total} scanned students passed`}
      columns={['Outcome', 'Students']}
      rows={[['Passed', passing], ['Below pass', failing]]}
      height={240}
    >
      <Doughnut data={data} options={options} plugins={[centerTextPlugin]} />
    </ChartFigure>
  );
}
