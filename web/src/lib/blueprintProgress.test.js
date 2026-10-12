import { describe, expect, it } from 'vitest';
import { blueprintCoverage, blueprintNextStep, bloomMix, coverageCaption } from './blueprintProgress.js';

const base = { id: 't1', subject_id: 's1', status: 'finalized', topic_count: 4, total_items: 50, banked: 0, missing: 50, ready: 0, exam_count: 0 };

describe('blueprintCoverage', () => {
  it('splits covered items into ready and pending', () => {
    const cov = blueprintCoverage({ ...base, banked: 40, missing: 10, ready: 30 });
    expect(cov).toMatchObject({ total: 50, covered: 40, ready: 30, pending: 10, missing: 10, state: 'short' });
    expect(coverageCaption(cov)).toBe('10 to generate');
  });

  it('reports review once nothing is missing but drafts remain', () => {
    const cov = blueprintCoverage({ ...base, banked: 50, missing: 0, ready: 46 });
    expect(cov.state).toBe('review');
    expect(coverageCaption(cov)).toBe('4 to approve');
  });

  it('treats a blueprint without topics as unplanned', () => {
    expect(blueprintCoverage({ ...base, topic_count: 0 }).state).toBe('none');
  });

  it('never lets ready exceed covered', () => {
    expect(blueprintCoverage({ ...base, banked: 10, missing: 40, ready: 99 }).ready).toBe(10);
  });
});

describe('blueprintNextStep', () => {
  it('walks topics → finalize → generate → approve → build → done', () => {
    expect(blueprintNextStep({ ...base, topic_count: 0 }).key).toBe('topics');
    expect(blueprintNextStep({ ...base, status: 'draft' }).key).toBe('finalize');
    expect(blueprintNextStep({ ...base, banked: 32, missing: 18, ready: 32 }))
      .toMatchObject({ key: 'generate', label: 'Generate 18', to: '/tos/t1' });
    expect(blueprintNextStep({ ...base, banked: 50, missing: 0, ready: 47 }))
      .toMatchObject({ key: 'review', label: 'Approve 3', to: '/questions/review?subject_id=s1' });
    const full = { ...base, banked: 50, missing: 0, ready: 50 };
    expect(blueprintNextStep(full)).toMatchObject({ key: 'exam', to: '/exams/new?tos=t1' });
    expect(blueprintNextStep({ ...full, exam_count: 2 })).toMatchObject({ key: 'exams', label: '2 exams built', done: true });
  });
});

describe('bloomMix', () => {
  it('keeps the six levels in order with their weights', () => {
    const mix = bloomMix({ remember: 15, understand: 20, apply: 20, analyze: 20, evaluate: 15, create: 10 });
    expect(mix.map((m) => m.pct)).toEqual([15, 20, 20, 20, 15, 10]);
    expect(mix[5]).toMatchObject({ key: 'create', level: 6 });
  });
});
