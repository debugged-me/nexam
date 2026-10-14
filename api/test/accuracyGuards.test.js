import test, { after } from 'node:test';
import pool from '../src/config/db.js';
after(async () => { await pool.end(); });
import assert from 'node:assert/strict';
import { chunk } from '../src/services/chunker.js';
import { docxHtmlToText } from '../src/services/extractors.js';
import { prepareSyllabusBlueprint, statedCourseHours } from '../src/services/syllabusBlueprint.js';
import { isValidGeneratedQuestion } from '../src/services/generationValidation.js';
import {
  acceptedReview, makeQualityProof, qualityBlockReason, reviewQuestion, instructionalBlockReason,
  canonicalDraft, parseReview, reviewKnowledgeQuestion, isKnowledgeQuestion,
  solvedMatchesKey, checksSatisfied, independentChecks, solveBlind,
} from '../src/services/questionQuality.js';

// A writer plus agreeing blind solvers on other models, as generation records them.
const writer = { provider: 'gemini', model: 'gemini-flash' };
const groundedChecks = [{ provider: 'groq', model: 'qwen', answer: 'agreed', agreed: true }];
const knowledgeChecks = [...groundedChecks, { provider: 'ollama', model: 'gemma', answer: 'agreed', agreed: true }];
import { runPool } from '../src/services/aiProvider.js';

test('chunking preserves every word, punctuation and unfinished tail within bounded windows', () => {
  const text = 'An abbreviation e.g. https://school.test/a.b\n\n' + Array.from({ length: 1700 }, (_, i) => `word${i}`).join(' ') + '\nlast unpunctuated topic';
  const chunks = chunk(text, { chunkSizeTokens: 100, overlapTokens: 20 });
  assert.ok(chunks.length > 10);
  for (const c of chunks) { assert.equal(c.text, text.slice(c.startOffset, c.endOffset)); assert.ok(c.tokenCount <= 100); }
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i].startOffset < chunks[i - 1].endOffset);
  assert.equal(chunks.at(-1).endOffset, text.length);
  for (const word of text.matchAll(/\S+/g)) assert.ok(chunks.some((c) => c.startOffset <= word.index && c.endOffset >= word.index + word[0].length));
});

test('zero overlap is honored and a one-word window always advances', () => {
  assert.deepEqual(chunk('a b c', { chunkSizeTokens: 1, overlapTokens: 999 }).map((c) => c.text), ['a', 'b', 'c']);
  const chunks = chunk('a b c d e f', { chunkSizeTokens: 4, overlapTokens: 0 });
  assert.deepEqual(chunks.map((c) => c.text), ['a b c', 'd e f']);
});

test('merged DOCX headers do not shift outcome statements into Bloom labels', () => {
  const text = docxHtmlToText('<table><tr><td colspan="2">Course Learning Outcomes</td><td>Bloom Level</td><td>PLO</td></tr><tr><td>CLO1</td><td>Explain global change.</td><td>Understanding</td><td>PLO5</td></tr></table>');
  assert.match(text, /Course Learning Outcomes: Explain global change\./);
  assert.match(text, /Bloom Level: Understanding/);
  assert.doesNotMatch(text, /Bloom Level: Explain/);
});

test('full-width merged schedule rows remain recognizable headings', () => {
  const text = docxHtmlToText('<table><tr><td>ILO</td><td>Topics</td><td>Resources</td></tr><tr><td colspan="3">Time Frame: Prelim (Week 1-5)</td></tr><tr><td>Explain systems</td><td>Topic One</td><td>Book</td></tr></table>');
  assert.match(text, /(?:^|\n)Time Frame: Prelim/);
  const p = prepareSyllabusBlueprint({ topics: [] }, text, 'material');
  assert.equal(p.topics[0].schedule.label, 'Prelim');
});

test('vertical merges retain content without inventing column attribution', () => {
  const text = docxHtmlToText('<table><tr><td>A</td><td>B</td><td>C</td></tr><tr><td rowspan="2">First</td><td>Second</td><td>Third</td></tr><tr><td>Fourth</td><td>Fifth</td></tr></table>');
  for (const value of ['First', 'Second', 'Third', 'Fourth', 'Fifth']) assert.ok(text.includes(value));
  assert.doesNotMatch(text, /A: Fourth/);
});

const syllabus = `Course Title | Demonstration\n54 hours per semester\nTime Frame: Prelim (Week 1-5)\nILO: Explain systems\nTopics: - Topic One\n- Topic Two\nAssessment Task: Quiz\nTime Frame: Final (Week 6-18)\nILO: Evaluate systems\nTopics: - Topic Three\n- Topic Four\nResources: A reference`;
test('source outline restores omitted topics and keeps all periods; hours reconcile exactly', () => {
  const p = prepareSyllabusBlueprint({ topics: [{ topic: 'Topic One', instructional_hours: 3 }] }, syllabus, 'material');
  assert.equal(p.topics.length, 4);
  assert.deepEqual(p.topics.map((t) => t.schedule.label), ['Prelim', 'Prelim', 'Final', 'Final']);
  assert.deepEqual(p.topics.map((t) => t.instructional_hours), [7.5, 7.5, 19.5, 19.5]);
  assert.equal(p.sourceMeta.courseHours.value, 54);
  assert.equal(p.sourceMeta.hoursBasis, 'estimated_by_period_weeks');
});

test('unknown hours and weeks remain unknown; invented outcomes and hours are discarded', () => {
  const p = prepareSyllabusBlueprint({ topics: [{ topic: 'Topic One', instructional_hours: 3, learning_outcomes: ['Invented outcome'], schedule_evidence: 'Week 1-5' }] }, 'Topic One is listed here.', 'material');
  assert.equal(p.topics[0].instructional_hours, 0);
  assert.equal(p.topics[0].schedule, null);
  assert.deepEqual(p.topics[0].learning_outcomes, []);
  assert.equal(p.sourceMeta.courseHours, null);
  assert.equal(statedCourseHours('3 units, 3 hours/week'), null);
  assert.equal(statedCourseHours('54 hours per semester; 60 hours per semester'), null);
});

test('explicit topic hours require associated verbatim numeric evidence', () => {
  const text = 'Topic One | Hours: 4\nTopic Two | Hours: 2';
  const p = prepareSyllabusBlueprint({ topics: [
    { topic: 'Topic One', instructional_hours: 4, hours_evidence: 'Topic One | Hours: 4' },
    { topic: 'Topic Two', instructional_hours: 9, hours_evidence: 'Topic Two | Hours: 2' },
  ] }, text, 'material');
  assert.deepEqual(p.topics.map((t) => t.instructional_hours), [4, 0]);
});

test('invented topics never enter the blueprint; they are listed, and nothing verifiable fails closed', () => {
  assert.throws(() => prepareSyllabusBlueprint({ topics: [{ topic: 'Invented Science' }] }, 'Physics only.', 'material'), /No course topic could be verified/);
  const p = prepareSyllabusBlueprint({ topics: [{ topic: 'Physics' }, { topic: 'Invented Science' }] }, 'Physics only.', 'material');
  assert.deepEqual(p.topics.map((t) => t.topic), ['Physics']);
  assert.ok(p.sourceMeta.warnings.some((w) => w.includes('"Invented Science"') && /left out/.test(w)));
});

test('AI topic titles tolerate case, dash and quote variants and parent — sub-item names', () => {
  const text = 'WEEK 1-2 Introduction to Programming\nWEEK 3 Variables – Data Types\nWEEK 4 Larong Task\n Patintero\nWEEK 5 “Smart” Devices';
  const p = prepareSyllabusBlueprint({ topics: [
    { topic: 'introduction to programming' }, { topic: 'Variables - Data Types' },
    { topic: 'Larong Task — Patintero' }, { topic: '"Smart" Devices' },
  ] }, text, 'material');
  // Case-only differences take the syllabus spelling.
  assert.deepEqual(p.topics.map((t) => t.topic), ['Introduction to Programming', 'Variables - Data Types', 'Larong Task — Patintero', '"Smart" Devices']);
});

test('a "Unit 1: …" topic line does not end the outline; repeated section labels do', () => {
  const text = 'Time Frame: Prelim (Week 1-9)\nTopics: Unit 1: Foundations\nUnit 2: Larong Pinoy\n– Patintero\nAssessment Task: Quiz\nTime Frame: Finals (Week 10-18)\nTopics: 1. Dance\nAssessment Task: Recital';
  const { topics } = prepareSyllabusBlueprint({ topics: [] }, text, 'material');
  assert.deepEqual(topics.map((t) => t.topic), ['Unit 1: Foundations', 'Unit 2: Larong Pinoy', 'Patintero', 'Dance']);
  assert.deepEqual(topics.map((t) => t.schedule.label), ['Prelim', 'Prelim', 'Prelim', 'Finals']);
});

const evidence = 'Velorium changes to violet at 42 degrees Celsius.';
const question = { type: 'mcq', stem: 'At what temperature does Velorium change to violet?', options: ['10 C', '42 C', '99 C'], answer: '42 C', explanation: 'The source states 42 degrees Celsius.', topic: 'Velorium', bloom: 'remember', evidence };
const review = { answerSupported: true, unambiguous: true, typeValid: true, topicRelevant: true, instructionalContent: true, actualBloom: 'remember', reason: 'The answer is stated.' };
const chunks = [{ id: 'chunk', text: evidence }];
const reviewed = () => ({ ...question, source: 'ai', generation_meta: { chunkIds: ['chunk'], evidence, quality: makeQualityProof(question, chunks, review, { provider: 'fixture', model: 'fixture' }, { writer, checks: groundedChecks }) } });

test('quality proof accepts unchanged question and source, blocks edits and stale evidence', () => {
  const q = reviewed();
  assert.equal(qualityBlockReason(q, chunks), null);
  for (const change of [{ answer: '99 C' }, { bloom: 'analyze' }, { topic: 'Different topic' }, { explanation: 'Outside fact' }]) assert.ok(qualityBlockReason({ ...q, ...change }, chunks));
  assert.ok(qualityBlockReason(q, []));
  assert.ok(qualityBlockReason(q, [{ id: 'chunk', text: evidence + ' Changed.' }]));
  assert.ok(qualityBlockReason({ ...q, generation_meta: { chunkIds: ['chunk'], evidence } }, chunks));
});

test('separate review rejects unsupported answers, administrative trivia and Bloom inflation', () => {
  for (const flag of ['answerSupported', 'unambiguous', 'typeValid', 'topicRelevant', 'instructionalContent']) assert.equal(acceptedReview({ ...review, [flag]: false }, 'remember'), false);
  assert.equal(acceptedReview({ ...review, actualBloom: 'remember' }, 'analyze'), false);
  assert.equal(acceptedReview({ ...review, actualBloom: 'create' }, 'create'), false);
  assert.equal(acceptedReview({ ...review, answerSupported: 'true' }, 'remember'), false);
});

test('invalid reviewer output and outages never produce a quality proof', async () => {
  await assert.rejects(reviewQuestion(question, evidence, async () => ({ text: 'not JSON' })), /invalid JSON/);
  await assert.rejects(reviewQuestion(question, evidence, async () => { throw new Error('unavailable'); }), /unavailable/);
});

test('format guards reject essay identification, nonexistent matching options and cross-chunk quotes', () => {
  assert.equal(isValidGeneratedQuestion({ ...question, type: 'identification', stem: 'Justify why Velorium changes colour.', answer: 'Because of the temperature.' }, evidence), false);
  assert.equal(isValidGeneratedQuestion({ ...question, type: 'matching', options: ['A', 'B'], answer: 'D,E' }, evidence), false);
  assert.equal(isValidGeneratedQuestion(question, ['Velorium changes to violet', 'at 42 degrees Celsius.']), false);
  assert.equal(isValidGeneratedQuestion(question, [evidence]), true);
});

test('spending cap HTTP 400 rotates to the next credential', async () => {
  const tried = [];
  const result = await runPool('fixture', [{ key: 'capped' }, { key: 'healthy' }], async ({ key }) => {
    tried.push(key);
    if (key === 'capped') throw Object.assign(new Error('blocked_api_access: spending limit reached'), { status: 400 });
    return 'ok';
  });
  assert.equal(result, 'ok'); assert.deepEqual(tried, ['capped', 'healthy']);
});

 test('a stalled credential times out and the next credential completes', async () => {
  let aborted = false;
  const value = await runPool('timeout-fixture', [{ key: 'stalled' }, { key: 'next' }], async ({ key }, signal) => {
    if (key === 'next') return 'available';
    signal.addEventListener('abort', () => { aborted = true; });
    return new Promise(() => {});
  }, { timeoutMs: 20 });
  assert.equal(value, 'available'); assert.equal(aborted, true);
});

test('administrative lookup and bare outline citations fail even when AI review approves', () => {
  const outline = [{ id: 'outline', text: 'Topics: - Introduction to Contemporary World\n- Definition and Scope of Globalization\nAssessment Task: Quiz' }];
  const q = { ...question, stem: 'Which topic is listed under the Introduction to Contemporary World unit in the course outline?', evidence: '- Definition and Scope of Globalization' };
  assert.ok(instructionalBlockReason(q, outline));
  assert.ok(instructionalBlockReason({ ...q, stem: 'Which definition is associated with globalization?' }, outline));
  assert.equal(instructionalBlockReason(question, chunks), null);
});

// Mirrors the INSERT in generate.js: what the questions table holds for a draft.
const stored = (q, meta) => ({
  ...q, source: 'ai', options: q.options ? JSON.stringify(q.options) : null,
  answer: q.answer || null, explanation: q.explanation || null, topic: q.topic || null,
  generation_meta: JSON.stringify(meta),
});

test('every question type keeps a valid proof after the database round trip', () => {
  const ev = 'Velorium changes to violet at 42 degrees Celsius and melts at 900 degrees.';
  const src = [{ id: 'c1', text: ev }];
  const drafts = [
    { type: 'mcq', stem: 'At what temperature does Velorium turn violet?', options: ['A) 10 C', 'B) 42 C', 'C) 99 C', ''], answer: 'B) 42 C' },
    { type: 'true_false', stem: 'Velorium turns violet at 99 degrees.', options: ['True', 'False'], answer: false },
    { type: 'true_false', stem: 'Velorium turns violet at 42 degrees.', answer: 't' },
    { type: 'matching', stem: '1. Violet  2. Melting', options: ['A) 42 C', 'B) 900 C'], answer: '1-A, 2-B' },
    { type: 'identification', stem: 'Which substance turns violet at 42 C?', answer: ' Velorium ' },
  ];
  for (const raw of drafts) {
    const draft = { ...raw, explanation: undefined, topic: 'Velorium', bloom: 'remember', evidence: ev };
    assert.equal(isValidGeneratedQuestion(draft, [ev]), true, raw.type);
    const q = canonicalDraft(draft);
    const quality = makeQualityProof(q, src, review, { provider: 'fixture', model: 'fixture' }, { writer, checks: groundedChecks });
    const row = stored(q, { chunkIds: ['c1'], evidence: ev, quality });
    assert.equal(qualityBlockReason(row, src), null, `${raw.type} ${JSON.stringify(raw.answer)}`);
  }
  // A JSON boolean false must become an answer key, never NULL.
  assert.equal(canonicalDraft({ ...drafts[1], bloom: 'remember' }).answer, 'False');
  assert.equal(canonicalDraft({ ...drafts[1], bloom: 'remember' }).options, null);
});

const knowledgeReview = { answerCorrect: true, unambiguous: true, typeValid: true, topicRelevant: true, instructionalContent: true, actualBloom: 'remember', reason: 'Well established.' };
const knowledgeDraft = canonicalDraft({ type: 'mcq', stem: 'Which organization administers global trade rules?', options: ['A) WTO', 'B) WHO', 'C) UNESCO', 'D) ILO'], answer: 'A) WTO', explanation: 'The World Trade Organization administers multilateral trade agreements.', topic: 'Global Organizations', bloom: 'remember' });

test('knowledge-mode drafts are labelled, need no source, and are bound to their reviewed content', () => {
  assert.equal(isValidGeneratedQuestion({ ...knowledgeDraft }, null, { requireEvidence: false }), true);
  assert.equal(isValidGeneratedQuestion({ ...knowledgeDraft, explanation: '' }, null, { requireEvidence: false }), false);
  const quality = makeQualityProof(knowledgeDraft, [], knowledgeReview, { provider: 'groq', model: 'x' }, { mode: 'knowledge', writer, checks: knowledgeChecks });
  const row = stored(knowledgeDraft, { grounding: 'knowledge', chunkIds: [], quality });
  assert.equal(isKnowledgeQuestion(row), true);
  assert.equal(qualityBlockReason(row, []), null);
  assert.match(qualityBlockReason({ ...row, answer: 'B) WHO' }, []), /changed after its quality review/);
  // A grounded-mode proof cannot be relabelled as knowledge, nor the reverse.
  assert.ok(qualityBlockReason({ ...row, generation_meta: JSON.stringify({ chunkIds: [], quality }) }, []));
  // The fact-check must confirm the answer; source-support flags do not count.
  assert.equal(acceptedReview({ ...knowledgeReview, answerCorrect: false }, 'remember', 'knowledge'), false);
  assert.equal(acceptedReview({ ...review }, 'remember', 'knowledge'), false);
});

test('reviewer output is parsed strictly but tolerates fences, prose and label case', async () => {
  assert.equal(parseReview('```json\n{"actualBloom":"Remember ","answerSupported":true}\n```').actualBloom, 'remember');
  assert.equal(parseReview('Here is my review: {"actualBloom":"apply"} Thanks.').actualBloom, 'apply');
  assert.throws(() => parseReview('no json here'), /invalid JSON/);
  assert.throws(() => parseReview('[1,2]'), /invalid JSON/);
  let opts;
  const result = await reviewKnowledgeQuestion(knowledgeDraft, { course: 'TCW', topic: 'Global Organizations', outcomes: [] },
    async (system, prompt, o) => { opts = o; assert.doesNotMatch(prompt, /"bloom"/); return { text: JSON.stringify(knowledgeReview), provider: 'gemini', model: 'g' }; },
    { avoidProvider: 'groq' });
  assert.equal(result.review.answerCorrect, true);
  assert.equal(opts.avoidProvider, 'groq');
});

test('pools without a timeout never abort long calls such as embedding batches', async () => {
  const value = await runPool('no-timeout-fixture', [{ key: 'slow' }], async (_target, signal) => {
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(signal.aborted, false);
    return 'done';
  });
  assert.equal(value, 'done');
});

test('an invalid key (HTTP 400 API_KEY_INVALID) rotates to the next key instead of failing generation', async () => {
  const tried = [];
  const value = await runPool('invalid-key-fixture', [{ key: 'pasted-wrong' }, { key: 'valid' }], async ({ key }) => {
    tried.push(key);
    if (key === 'pasted-wrong') throw Object.assign(new Error('[400 Bad Request] API key not valid. Please pass a valid API key. [{"reason":"API_KEY_INVALID"}]'), { status: 400 });
    return 'ok';
  });
  assert.equal(value, 'ok');
  assert.deepEqual(tried, ['pasted-wrong', 'valid']);
  // A genuine bad request still fails fast — it would fail on every key.
  await assert.rejects(runPool('bad-request-fixture', [{ key: 'a' }, { key: 'b' }], async () => {
    throw Object.assign(new Error('Invalid JSON payload received.'), { status: 400 });
  }), /Invalid JSON payload/);
});

test('blind answers are compared per question type; unsure or different answers never count', () => {
  const mcq = { type: 'mcq', options: ['A) WTO', 'B) WHO', 'C) UN'], answer: 'A) WTO' };
  assert.equal(solvedMatchesKey(mcq, 'A'), true);
  assert.equal(solvedMatchesKey(mcq, 'WTO'), true);
  assert.equal(solvedMatchesKey(mcq, 'B'), false);
  assert.equal(solvedMatchesKey(mcq, 'UNDETERMINED'), false);
  assert.equal(solvedMatchesKey({ type: 'true_false', answer: 'False' }, 'false'), true);
  assert.equal(solvedMatchesKey({ type: 'true_false', answer: 'False' }, 'True'), false);
  assert.equal(solvedMatchesKey({ type: 'matching', answer: '1-B, 2-A' }, '1-B,2-A'), true);
  assert.equal(solvedMatchesKey({ type: 'matching', answer: '1-B, 2-A' }, '1-A, 2-B'), false);
  const id = (key, got) => solvedMatchesKey({ type: 'identification', answer: key }, got);
  assert.equal(id('World Trade Organization', 'WTO'), true);
  assert.equal(id('World Trade Organization (WTO)', 'world trade organization'), true);
  assert.equal(id('World Trade Organization', 'World Tourism Organization'), false);
});

test('proofs need distinct blind solvers other than the writer, one on another provider', () => {
  assert.equal(checksSatisfied({ writer, checks: groundedChecks }, 'grounded'), true);
  assert.equal(checksSatisfied({ writer, checks: groundedChecks }, 'knowledge'), false); // knowledge needs two
  assert.equal(checksSatisfied({ writer, checks: knowledgeChecks }, 'knowledge'), true);
  assert.equal(checksSatisfied({ writer, checks: [{ ...writer, agreed: true }] }, 'grounded'), false); // the writer cannot check itself
  assert.equal(checksSatisfied({ writer, checks: [groundedChecks[0], groundedChecks[0]] }, 'knowledge'), false); // same model twice
  assert.equal(checksSatisfied({ writer, checks: [{ provider: 'gemini', model: 'other', agreed: true }] }, 'grounded'), false); // needs another provider
  assert.equal(checksSatisfied({ writer, checks: [{ ...groundedChecks[0], agreed: false }] }, 'grounded'), false);
  // A version-1 proof (no blind solves) no longer verifies.
  const q = { ...knowledgeDraft, source: 'ai', options: JSON.stringify(knowledgeDraft.options) };
  const quality = makeQualityProof(knowledgeDraft, [], knowledgeReview, { provider: 'groq', model: 'x' }, { mode: 'knowledge', writer, checks: knowledgeChecks });
  assert.match(qualityBlockReason({ ...q, generation_meta: JSON.stringify({ grounding: 'knowledge', chunkIds: [], quality: { ...quality, version: 1 } }) }, []), /blind-solve/);
  assert.match(qualityBlockReason({ ...q, generation_meta: JSON.stringify({ grounding: 'knowledge', chunkIds: [], quality: { ...quality, checks: knowledgeChecks.slice(0, 1) } }) }, []), /blind-solve/);
});

test('blind solvers never see the key, avoid the writer, and a disagreement holds the draft', async () => {
  const calls = [];
  const fake = (answers) => async (system, prompt, opts) => {
    calls.push({ prompt, opts });
    const [provider, model, answer] = answers.shift();
    return { text: JSON.stringify({ answer, reason: 'r' }), provider, model };
  };
  const checks = await independentChecks(knowledgeDraft, { mode: 'knowledge', writer },
    fake([['groq', 'qwen', 'A'], ['ollama', 'gemma', 'WTO']]));
  assert.equal(checks.length, 2);
  for (const c of calls) {
    assert.doesNotMatch(c.prompt, /"answer":"A\) WTO"|explanation/);
    assert.ok(c.opts.excludeModels.includes('gemini:gemini-flash'));
  }
  assert.ok(calls[1].opts.excludeModels.includes('groq:qwen'));
  await assert.rejects(independentChecks(knowledgeDraft, { mode: 'knowledge', writer }, fake([['groq', 'qwen', 'B']])), /without seeing the key/);
  await assert.rejects(independentChecks(knowledgeDraft, { mode: 'knowledge', writer }, async () => { throw Object.assign(new Error('down'), { status: 503 }); }), /held, not accepted/);
  // Grounded solving gets the source; knowledge solving does not.
  let seen = '';
  await solveBlind(knowledgeDraft, { mode: 'grounded', context: 'SOURCE TEXT' }, async (s, p) => { seen = p; return { text: '{"answer":"A","reason":"r"}', provider: 'groq', model: 'qwen' }; });
  assert.match(seen, /SOURCE TEXT/);
});

test('indented DOCX sub-items keep their parent context and replace the parent row', () => {
  const html = '<table><tr><td>ILO</td><td>Topics</td><td>Resources</td></tr><tr><td colspan="3">Time Frame: Prelim (Week 1-5)</td></tr>'
    + '<tr><td><p>Play Larong Pinoy</p><p>Know its benefits</p></td><td><ul><li>Different recreational games</li><li>Larong Task</li><li>Patintero</li><li>Dodge Ball</li></ul></td><td>Book</td></tr></table>';
  const listItems = [
    { text: 'Different recreational games', indent: 720, ilvl: 0 }, { text: 'Larong Task', indent: 720, ilvl: 0 },
    { text: 'Patintero', indent: 1440, ilvl: 0 }, { text: 'Dodge Ball', indent: 1440, ilvl: 0 },
  ];
  const text = docxHtmlToText(html, { listItems });
  assert.match(text, /\n {2}- Patintero/);
  const { topics } = prepareSyllabusBlueprint({ topics: [] }, text, 'material');
  assert.deepEqual(topics.map((t) => t.topic), ['Different recreational games', 'Larong Task — Patintero', 'Larong Task — Dodge Ball']);
  // Every line of the ILO cell is an outcome, bulleted or not.
  assert.deepEqual(topics[0].learning_outcomes, ['Play Larong Pinoy', 'Know its benefits']);
  // Without nesting data the items stay flat (older behaviour, nothing lost).
  assert.equal(prepareSyllabusBlueprint({ topics: [] }, docxHtmlToText(html), 'material').topics.length, 4);
});

test('AI-listed sub-items replace their parent, and case fixes prefer outline lines over prose', () => {
  const text = 'Course description: students explore global citizenship today.\nTopics:\n- Global Citizenship\n- Folk dances\n  - Polka';
  const p = prepareSyllabusBlueprint({ topics: [
    { topic: 'global citizenship' }, { topic: 'Folk dances' }, { topic: 'Folk dances — Polka' },
  ] }, text, 'material');
  assert.deepEqual(p.topics.map((t) => t.topic), ['Global Citizenship', 'Folk dances — Polka']);
});
