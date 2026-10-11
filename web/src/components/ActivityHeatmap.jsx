/**
 * ActivityHeatmap — GitHub-style contribution grid over the dashboard
 * activity series (questions + exams created per day).
 *
 * Rows are days of the week, columns are weeks ending today. Cell color is a
 * five-step accent ramp by daily count; leading pad cells align the first
 * day to its weekday row. Title tooltips carry the exact counts; an sr-only
 * table keeps the totals readable without the picture.
 */
export default function ActivityHeatmap({ series = [], weeks = 26 }) {
  const days = series.slice(-weeks * 7);
  if (!days.length) return null;
  const max = Math.max(1, ...days.map((d) => (d.q || 0) + (d.e || 0)));
  const first = new Date(`${days[0].d}T00:00:00`);
  const pad = Number.isNaN(first.getTime()) ? 0 : first.getDay();
  const cells = [...Array(pad).fill(null), ...days];

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img"
        aria-label={`Activity over the last ${days.length} days — ${days.reduce((s, d) => s + (d.q || 0), 0)} questions and ${days.reduce((s, d) => s + (d.e || 0), 0)} exams created`}>
        {cells.map((d, i) => {
          const n = d ? (d.q || 0) + (d.e || 0) : 0;
          const level = !d ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
          return (
            <span
              key={d ? d.d : `pad-${i}`}
              className="heat-cell"
              data-level={level}
              title={d ? `${d.l} — ${n || 'no'} activit${n === 1 ? 'y' : 'ies'} (${d.q || 0} questions · ${d.e || 0} exams)` : undefined}
            />
          );
        })}
      </div>
      <div className="heatmap-legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => <span key={l} className="heat-cell" data-level={l} />)}
        <span>More</span>
      </div>
    </div>
  );
}
