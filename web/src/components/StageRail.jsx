/**
 * StageRail — compact pipeline steps for "work in flight" surfaces.
 *
 *   <StageRail steps={[
 *     { label: 'Banked', sub: '40 of 50', state: 'done' },
 *     { label: 'Finalized', state: 'current' },
 *     { label: 'Scanned', state: 'todo' },
 *   ]} />
 *
 * Turns a record's lifecycle (blueprint → banked → finalized → exam →
 * scanned) into a readable rail instead of a row of badges. `done` gets a
 * check, `current` gets the accent ring, `todo` stays muted.
 */
import { Check } from 'lucide-react';

export default function StageRail({ steps = [] }) {
  return (
    <ol className="stage-rail">
      {steps.map((s, i) => (
        <li
          key={s.label}
          className={`stage-step is-${s.state || 'todo'}`}
          aria-current={s.state === 'current' ? 'step' : undefined}
        >
          <span className="stage-dot" aria-hidden="true">
            {s.state === 'done' ? <Check size={11} /> : i + 1}
          </span>
          <span className="stage-text">
            <span className="stage-label">{s.label}</span>
            {s.sub && <span className="stage-sub">{s.sub}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
