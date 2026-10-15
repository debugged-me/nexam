import { describe, expect, it } from 'vitest';
import { selectPipelineJob, generationSummary, syllabusTopicGroups } from './pipelineRun.js';

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
});
