import { describe, expect, it } from 'vitest';
import { examResults } from './examProgress.js';

const base = { id: 'e1', status: 'draft', question_count: 0, set_count_generated: 0, scan_count: 0, review_count: 0, avg_score: null };

describe('examResults', () => {
  it('is empty until a sheet is scanned', () => {
    expect(examResults(base)).toBeNull();
  });

  it('summarises scans against the pass mark', () => {
    expect(examResults({ ...base, scan_count: 1, avg_score: 80 })).toMatchObject({ scans: 1, avg: 80, passing: true, caption: '1 sheet' });
    expect(examResults({ ...base, scan_count: 12, avg_score: 61.5 })).toMatchObject({ passing: false, caption: '12 sheets' });
  });
});
