import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeFrame, syllabusPeriods, verifiedSchedule, validateSources, scopeKey, questionFitsScope } from '../src/services/assessmentScope.js';

const syllabus = `PART 3: COURSE OUTLINE
Time Frame: Prelim (Week 1- 5)
Introduction to Exercise Science and Fitness Principles
Time Frame: Midterm (Week 6- 10)
Resistance & Circuit Training
Time Frame: Pre-final (Week 11- 14)
Group Exercise Design
Time Frame: Finals (Week 15-18)
Comprehensive Exercise and Application`;

test('extracts the four period headings in the supplied syllabus format without inventing per-topic weeks', () => {
  assert.deepEqual(syllabusPeriods(syllabus).map(({ label, weekStart, weekEnd }) => ({ label, weekStart, weekEnd })), [
    { label: 'Prelim', weekStart: 1, weekEnd: 5 }, { label: 'Midterm', weekStart: 6, weekEnd: 10 },
    { label: 'Pre-final', weekStart: 11, weekEnd: 14 }, { label: 'Finals', weekStart: 15, weekEnd: 18 },
  ]);
  const schedule = verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Time Frame: Midterm (Week 6- 10)' }, syllabus, 'syllabus');
  assert.equal(schedule.weekStart, 6);
  assert.equal(schedule.weekEnd, 10);
  assert.equal(schedule.materialId, 'syllabus');
});

test('formatting noise in quoted evidence still verifies against the printed heading', () => {
  // The AI normalizes "Week 6- 10" to "Week 6-10"; the check must not reject it.
  const mid = verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Time Frame: Midterm (Week 6-10)' }, syllabus, 'm');
  assert.equal(mid.weekStart, 6);
  // Prefix dropped, plural Weeks, and label alone are all the same heading.
  assert.equal(verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Midterm (Weeks 6-10)' }, syllabus, 'm').weekStart, 6);
  assert.equal(verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Midterm' }, syllabus, 'm').weekStart, 6);
  // AI-composed titles verify via their printed head outside parentheses.
  const composed = verifiedSchedule({ topic: 'Resistance & Circuit Training (with bands)', schedule_evidence: 'Time Frame: Midterm (Week 6-10)' }, syllabus, 'm');
  assert.equal(composed.weekStart, 6);
  // Still closed: a bare label cannot rescue a topic absent from that period.
  assert.equal(verifiedSchedule({ topic: 'Group Exercise Design', schedule_evidence: 'Midterm' }, syllabus, 'm').weekStart, null);
});

test('missing weeks remain unknown and an assessment can use units alone', () => {
  assert.deepEqual(syllabusPeriods('Unit 1: Movement\nUnit 2: Fitness'), []);
  assert.deepEqual(parseTimeFrame({ label: 'Unit 1', weekStart: '', weekEnd: '' }), { version: 1, label: 'Unit 1', weekStart: null, weekEnd: null });
  assert.equal(syllabusPeriods('Time Frame: Prelim\nUnit 1: Movement')[0].weekStart, null);
  assert.equal(verifiedSchedule({ topic: 'Movement', schedule_evidence: 'Week 1' }, 'Unit 1: Movement', 'm'), null);
});

test('misassigned and invented schedules never acquire a verified week range', () => {
  const wrong = verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Time Frame: Prelim (Week 1- 5)' }, syllabus, 'm');
  assert.equal(wrong.weekStart, null);
  assert.equal(verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: 'Time Frame: Midterm (Week 7-12)' }, syllabus, 'm'), null);
  assert.equal(verifiedSchedule({ topic: 'Resistance & Circuit Training', schedule_evidence: syllabus }, syllabus, 'm').weekStart, null);
  assert.equal(syllabusPeriods('Time Frame: Midterm (Week 10-6)')[0].weekStart, null);
});

test('a quoted weekly topic row supports its stated week without a period heading', () => {
  const row = 'Weeks 2–3 | Movement and exercise | Apply safety principles';
  const schedule = verifiedSchedule({ topic: 'Movement and exercise', schedule_evidence: row }, row, 'm');
  assert.equal(schedule.weekStart, 2);
  assert.equal(schedule.weekEnd, 3);
});

test('rejects partial, fractional, reversed, and unreasonable ranges', () => {
  for (const [weekStart, weekEnd] of [[1, null], [null, 5], [5, 1], [0, 5], [1.5, 5], [1, 101], ['abc', 2]]) {
    assert.throws(() => parseTimeFrame({ label: 'Prelim', weekStart, weekEnd }), /both weeks/);
  }
  assert.equal(parseTimeFrame({ label: 'Cumulative Midterm', weekStart: 1, weekEnd: 10 }).weekEnd, 10);
});

const chunks = [{ id: 'c1', text: 'Prelim: Warm-up prepares the body for exercise. Midterm: Resistance training builds strength.' }];
const sources = [{ chunkId: 'c1', text: 'Warm-up prepares the body for exercise.' }];
test('allows an exact excerpt while excluding the later-period remainder of a chunk', () => {
  const allowed = validateSources(sources, chunks);
  assert.equal(allowed[0].text, sources[0].text);
  assert.equal(allowed[0].text.includes('Resistance'), false);
});

test('fails closed for deleted, foreign, edited, duplicated, and empty passages', () => {
  assert.throws(() => validateSources(sources, []), /unavailable/);
  assert.throws(() => validateSources([{ ...sources[0], chunkId: 'foreign' }], chunks), /unavailable/);
  assert.throws(() => validateSources([{ ...sources[0], text: 'Invented lesson content not present here.' }], chunks), /unavailable/);
  assert.throws(() => validateSources([...sources, ...sources], chunks), /once/);
  assert.throws(() => validateSources([], chunks), /Select/);
});

test('question reuse requires identical confirmed source coverage and period', () => {
  const scope = { label: 'Prelim', weekStart: 1, weekEnd: 5, sources };
  const key = scopeKey(scope);
  const tos = { assessment_scope: scope, scope_key: key };
  assert.equal(questionFitsScope({ scope_key: key }, tos), true);
  assert.equal(questionFitsScope({ scope_key: null }, tos), false);
  assert.equal(questionFitsScope({ scope_key: scopeKey({ ...scope, weekEnd: 10 }) }, tos), false);
  assert.equal(questionFitsScope({ scope_key: scopeKey({ ...scope, sources: [{ ...sources[0], text: chunks[0].text }] }) }, tos), false);
  assert.equal(questionFitsScope({}, { assessment_scope: null }), true);
  assert.equal(questionFitsScope({ scope_key: key }, { ...tos, scope_key: null }), false);
});
