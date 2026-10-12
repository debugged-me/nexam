import { useId } from 'react';

export default function AssessmentTimeFrame({ value, onChange }) {
  const id = useId();
  const field = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return <div className="assessment-timeframe">
    <div className="form-group">
      <label className="form-label" htmlFor={`${id}-label`}>Assessment / period</label>
      <input id={`${id}-label`} className="form-control" maxLength={100} value={value.label || ''}
        placeholder="e.g. Prelim, Midterm, Unit 1 assessment" onChange={field('label')} />
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor={`${id}-start`}>From week <span className="text-muted">(optional)</span></label>
      <input id={`${id}-start`} className="form-control" type="number" min={1} max={100} step={1}
        value={value.weekStart ?? ''} onChange={field('weekStart')} />
    </div>
    <div className="form-group">
      <label className="form-label" htmlFor={`${id}-end`}>Through week <span className="text-muted">(optional)</span></label>
      <input id={`${id}-end`} className="form-control" type="number" min={value.weekStart || 1} max={100} step={1}
        value={value.weekEnd ?? ''} onChange={field('weekEnd')} />
    </div>
    <p className="form-hint assessment-timeframe-help">No weeks in the syllabus? Leave both blank and choose coverage by topic or unit. For a cumulative exam, include the earlier weeks and topics too.</p>
  </div>;
}
