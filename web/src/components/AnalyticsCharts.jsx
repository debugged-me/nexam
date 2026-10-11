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
  Filler, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line, Radar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
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
      backgroundColor: `${p.green}1F`,
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
