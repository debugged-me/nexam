export function jobJson(value) {
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value) || {}; } catch { return {}; }
}

export function selectPipelineJob(jobs, pickedId) {
  if (pickedId) return jobs.find((j) => j.id === pickedId) || null;
  return jobs.find((j) => ['queued', 'running'].includes(j.status)) || jobs[0] || null;
}

export function missingQuestionCount(failedSlots = []) {
  return failedSlots.reduce((sum, slot) => {
    const count = Number.isFinite(Number(slot?.count)) ? Number(slot.count) : 0;
    const generated = Number.isFinite(Number(slot?.generated)) ? Number(slot.generated) : 0;
    return sum + Math.max(0, count - generated);
  }, 0);
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
    missingQuestions: missingQuestionCount(failedSlots),
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

// A historical replay is not writing activity. Plot only server timestamps,
// never the time a draft happens to arrive in this browser.
export function draftTimeline(drafts = [], startedAt) {
  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  if (!Number.isFinite(start)) return { points: [], timed: 0, untimed: drafts.length };
  const times = drafts.map((draft) => draft.createdAt ? new Date(draft.createdAt).getTime() : NaN)
    .filter((time) => Number.isFinite(time) && time >= start).sort((a, b) => a - b);
  const points = times.length ? [{ seconds: 0, count: 0 }] : [];
  for (const [index, time] of times.entries()) {
    const seconds = (time - start) / 1000;
    if (points.at(-1)?.seconds === seconds) points[points.length - 1].count = index + 1;
    else points.push({ seconds, count: index + 1 });
  }
  return { points, timed: times.length, untimed: drafts.length - times.length };
}

// Current question records, scoped to this run's exact streamed IDs. A finished
// generation job says nothing about its later, asynchronous similarity checks.
export function similaritySummary(ids = [], questions = []) {
  const rows = new Map(questions.map((question) => [question.id, question]));
  const summary = { clear: 0, flagged: 0, pending: 0, failed: 0, rejected: 0, unavailable: 0, total: 0 };
  for (const id of new Set(ids)) {
    const question = rows.get(id);
    summary.total += 1;
    if (!question) summary.unavailable += 1;
    else if (question.status === 'rejected' || question.similarity_flag === 'rejected') summary.rejected += 1;
    else if (question.similarity_error) summary.failed += 1;
    else if (!question.similarity_checked_at) summary.pending += 1;
    else if (question.similarity_flag === 'flagged') summary.flagged += 1;
    else if (question.similarity_flag === 'none') summary.clear += 1;
    else summary.unavailable += 1;
  }
  return summary;
}
