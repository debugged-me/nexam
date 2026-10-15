export function jobJson(value) {
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

export function selectPipelineJob(jobs, pickedId) {
  if (pickedId) return jobs.find((j) => j.id === pickedId) || null;
  return jobs.find((j) => ['queued', 'running'].includes(j.status)) || jobs[0] || null;
}

export function generationSummary(job, feed = {}) {
  const result = feed.result || jobJson(job?.result);
  const progress = feed.progress || jobJson(job?.progress);
  const failedSlots = Array.isArray(result.failedSlots) ? result.failedSlots : [];
  const number = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const known = (v) => v == null ? null : number(v);
  return {
    drafted: number(result.generated ?? progress.drafted ?? feed.drafts?.length),
    adopted: number(result.adopted ?? progress.adopted),
    coveredCells: number(result.skippedCells ?? progress.skipped),
    totalCells: known(result.slotsTotal ?? progress.slotsTotal),
    doneCells: known(result.slotsDone ?? progress.slotsDone),
    failedSlots,
    missingQuestions: failedSlots.reduce((sum, s) => sum + Math.max(0, number(s.count) - number(s.generated)), 0),
  };
}

export function syllabusTopicGroups(topics = []) {
  const groups = new Map();
  for (const topic of topics) {
    const s = jobJson(topic.schedule);
    const label = s.label || 'Schedule not stated';
    const key = JSON.stringify([label, s.weekStart || null, s.weekEnd || null]);
    if (!groups.has(key)) groups.set(key, { key, label, weekStart: s.weekStart, weekEnd: s.weekEnd, topics: [] });
    groups.get(key).topics.push(topic);
  }
  return [...groups.values()];
}
