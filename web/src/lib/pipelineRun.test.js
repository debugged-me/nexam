import { describe, expect, it } from 'vitest';
import { selectPipelineJob, generationSummary, syllabusTopicGroups, draftTimeline, similaritySummary } from './pipelineRun.js';

describe('pipeline reports recorded work', () => {
  it('selects a requested historic run even while another task is active', () => {
    const jobs = [{ id: 'active', type: 'embed', status: 'running' }, { id: 'old', type: 'generate', status: 'done' }];
    expect(selectPipelineJob(jobs, 'old')?.id).toBe('old');
    expect(selectPipelineJob(jobs, null)?.id).toBe('active');
    expect(selectPipelineJob([], 'missing')).toBeNull();
    expect(selectPipelineJob(jobs, 'outside-recent-window')).toBeNull();
  });
  it('restores completed counts after refresh and keeps questions separate from cells', () => {
    const job = { status: 'done', progress: null, result: JSON.stringify({ generated: 7, adopted: 2, skippedCells: 1, slotsDone: 4, slotsTotal: 4, failedSlots: [{ count: 5, generated: 2 }] }) };
    expect(generationSummary(job)).toEqual({ drafted: 7, adopted: 2, coveredCells: 1, totalCells: 4, doneCells: 4, failedSlots: [{ count: 5, generated: 2 }], missingQuestions: 3 });
    expect(generationSummary(job, { progress: { drafted: 6, slotsDone: 3 } }).drafted).toBe(7);
  });
  it('does not invent totals for old runs and keeps unknown weeks unknown', () => {
    expect(generationSummary({ result: '{"generated":0}' }).totalCells).toBeNull();
    const groups = syllabusTopicGroups([{ id: 1, title: 'A', schedule: { label: 'Prelim', weekStart: 1, weekEnd: 5 } }, { id: 2, title: 'B', schedule: null }]);
    expect(groups).toHaveLength(2);
    expect(groups[1].weekStart).toBeUndefined();
    expect(groups[1].topics[0].title).toBe('B');
  });
  it('replays the writing timeline from saved timestamps in chronological order', () => {
    const drafts = [{ createdAt: '2026-10-15T10:02:00Z' }, { createdAt: '2026-10-15T10:01:00Z' }];
    expect(draftTimeline(drafts, '2026-10-15T10:00:00Z')).toEqual({
      points: [{ seconds: 0, count: 0 }, { seconds: 60, count: 1 }, { seconds: 120, count: 2 }], timed: 2, untimed: 0,
    });
  });
  it('does not invent writing times for live or legacy drafts with missing timestamps', () => {
    expect(draftTimeline([{}, { createdAt: 'invalid' }, { createdAt: '2026-10-15T09:00:00Z' }], '2026-10-15T10:00:00Z'))
      .toEqual({ points: [], timed: 0, untimed: 3 });
    expect(draftTimeline([{ createdAt: '2026-10-15T10:00:00Z' }], null).timed).toBe(0);
  });
  it('counts drafts saved together without inventing spacing between them', () => {
    expect(draftTimeline([{ createdAt: '2026-10-15T10:00:01Z' }, { createdAt: '2026-10-15T10:00:01Z' }], '2026-10-15T10:00:00Z').points)
      .toEqual([{ seconds: 0, count: 0 }, { seconds: 1, count: 2 }]);
  });
  it('separates real similarity results and never counts other runs', () => {
    const questions = [
      { id: 'a', similarity_flag: 'none', similarity_checked_at: '2026-10-16' },
      { id: 'b', similarity_flag: 'flagged', similarity_checked_at: '2026-10-16' },
      { id: 'c', similarity_flag: 'none', similarity_checked_at: null },
      { id: 'd', similarity_error: 'Provider unavailable' },
      { id: 'e', status: 'rejected' },
      { id: 'other-run', similarity_flag: 'none', similarity_checked_at: '2026-10-16' },
    ];
    expect(similaritySummary(['a', 'a', 'b', 'c', 'd', 'e', 'missing'], questions))
      .toEqual({ clear: 1, flagged: 1, pending: 1, failed: 1, rejected: 1, unavailable: 1, total: 6 });
  });
  it('does not treat missing check records or unknown flags as cleared', () => {
    expect(similaritySummary(['a'], [{ id: 'a', similarity_checked_at: '2026-10-16' }]).unavailable).toBe(1);
    expect(similaritySummary([], [{ id: 'a', similarity_flag: 'none', similarity_checked_at: '2026-10-16' }]).clear).toBe(0);
    expect(similaritySummary(['a'], [{ id: 'a', similarity_error: 'Failed', similarity_flag: 'none', similarity_checked_at: 'old' }]).failed).toBe(1);
  });
});
