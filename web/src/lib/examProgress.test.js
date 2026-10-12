import { describe, expect, it } from 'vitest';
import { examNextStep, examResults } from './examProgress.js';

const base = { id: 'e1', status: 'draft', question_count: 0, set_count_generated: 0, scan_count: 0, review_count: 0, avg_score: null };

describe('examNextStep', () => {
  it('follows the exam lifecycle rail', () => {
    expect(examNextStep(base).key).toBe('assemble');
    const assembled = { ...base, question_count: 30 };
    expect(examNextStep(assembled).key).toBe('sets');
    const sets = { ...assembled, set_count_generated: 2 };
    expect(examNextStep(sets)).toMatchObject({ key: 'publish', to: '/exams/e1' });
    const live = { ...sets, status: 'published' };
    expect(examNextStep(live).key).toBe('scan');
    expect(examNextStep({ ...live, scan_count: 40, review_count: 3 })).toMatchObject({ key: 'review', label: 'Confirm 3 scans', warn: true });
    expect(examNextStep({ ...live, scan_count: 40 })).toMatchObject({ key: 'results', to: '/analytics/exam/e1', done: true });
  });
});

describe('examResults', () => {
  it('is empty until a sheet is scanned', () => {
    expect(examResults(base)).toBeNull();
  });

  it('summarises scans against the pass mark', () => {
    expect(examResults({ ...base, scan_count: 1, avg_score: 80 })).toMatchObject({ scans: 1, avg: 80, passing: true, caption: '1 sheet' });
    expect(examResults({ ...base, scan_count: 12, avg_score: 61.5 })).toMatchObject({ passing: false, caption: '12 sheets' });
  });
});
