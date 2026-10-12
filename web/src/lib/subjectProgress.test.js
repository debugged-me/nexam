import { describe, expect, it } from 'vitest';
import { attentionScore, nextStep, subjectStages } from './subjectProgress.js';

const base = { id: 's1', material_count: 0, material_ready: 0, material_pending: 0, tos_count: 0, tos_finalized: 0, finalized_tos_id: null, question_count: 0, draft_count: 0, approved_count: 0, exam_count: 0, exam_published: 0 };

describe('subjectStages', () => {
  it('starts with every stage to do', () => {
    expect(subjectStages(base).map((s) => s.state)).toEqual(['todo', 'todo', 'todo', 'todo']);
  });

  it('marks pending review as partial even when some are approved', () => {
    const q = subjectStages({ ...base, question_count: 12, draft_count: 4, approved_count: 8 })[2];
    expect(q.state).toBe('partial');
    expect(q.detail).toBe('4 to review · 8 approved');
  });
});

describe('nextStep', () => {
  it('walks the workflow in dependency order', () => {
    expect(nextStep(base).key).toBe('upload');
    expect(nextStep({ ...base, material_count: 1, material_pending: 1 }).key).toBe('processing');
    const ready = { ...base, material_count: 1, material_ready: 1 };
    expect(nextStep(ready).key).toBe('blueprint');
    expect(nextStep({ ...ready, tos_count: 1 }).key).toBe('finalize');
    const finalized = { ...ready, tos_count: 1, tos_finalized: 1, finalized_tos_id: 't9' };
    expect(nextStep(finalized)).toMatchObject({ key: 'generate', to: '/tos/t9' });
    expect(nextStep({ ...finalized, question_count: 3, draft_count: 3 })).toMatchObject({ key: 'review', label: 'Review 3 drafts' });
    const approved = { ...finalized, question_count: 3, approved_count: 3 };
    expect(nextStep(approved)).toMatchObject({ key: 'exam', to: '/exams/new?tos=t9' });
    expect(nextStep({ ...approved, exam_count: 1 }).key).toBe('publish');
    expect(nextStep({ ...approved, exam_count: 1, exam_published: 1 })).toMatchObject({ key: 'exams', done: true });
  });
});

describe('attentionScore', () => {
  it('ranks subjects with drafts above unfinished ones', () => {
    expect(attentionScore({ ...base, draft_count: 2 })).toBeGreaterThan(attentionScore(base));
  });
});
