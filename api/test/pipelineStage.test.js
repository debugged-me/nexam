import test from 'node:test';
import assert from 'node:assert/strict';
import { pipelineStage } from '../src/services/pipelineStage.js';

const processed = { status: 'processed' };
const job = (status) => ({ status });
const draftTos = { status: 'draft' };
const finalTos = { status: 'finalized' };

test('extraction states come first', () => {
  assert.equal(pipelineStage({}), 'upload');
  assert.equal(pipelineStage({ syllabus: { status: 'pending' } }), 'extracting');
  assert.equal(pipelineStage({ syllabus: { status: 'processing' } }), 'extracting');
  assert.equal(pipelineStage({ syllabus: { status: 'failed' } }), 'extract_failed');
});

test('blueprint drafting and review never wait on vector indexing', () => {
  // syllabus_tos is enqueued before embed, so both can be pending at once.
  assert.equal(pipelineStage({ syllabus: processed, tosJob: job('running'), embedJob: job('queued') }), 'tos_generating');
  assert.equal(pipelineStage({ syllabus: processed, tosJob: job('done'), embedJob: job('running'), tos: draftTos }), 'tos_review');
  assert.equal(pipelineStage({ syllabus: processed, tosJob: job('done'), embedJob: job('failed'), tos: draftTos }), 'tos_review');
  assert.equal(pipelineStage({ syllabus: processed, tosJob: job('failed'), embedJob: job('done') }), 'tos_failed');
});

test('question generation waits for indexing and reports index failures', () => {
  const base = { syllabus: processed, tosJob: job('done'), tos: finalTos };
  assert.equal(pipelineStage({ ...base, embedJob: job('running') }), 'embedding');
  assert.equal(pipelineStage({ ...base, embedJob: job('failed') }), 'embed_failed');
  assert.equal(pipelineStage({ ...base, embedJob: job('done') }), 'ready_to_generate');
  assert.equal(pipelineStage({ ...base, embedJob: job('done'), generateJob: job('queued') }), 'question_generating');
  assert.equal(pipelineStage({ ...base, embedJob: job('done'), generateJob: job('failed') }), 'generate_failed');
});

test('a finished run without saved drafts is reported, not shown as an empty review', () => {
  const base = { syllabus: processed, tosJob: job('done'), embedJob: job('done'), tos: finalTos, generateJob: job('done') };
  assert.equal(pipelineStage({ ...base, questionStats: { draft: 0, approved: 0 } }), 'generate_short');
  assert.equal(pipelineStage({ ...base, questionStats: { draft: '2', approved: '0' } }), 'review');
  assert.equal(pipelineStage({ ...base, questionStats: { draft: 0, approved: 5 } }), 'exam_ready');
});

test('a syllabus without a blueprint job still reports indexing', () => {
  assert.equal(pipelineStage({ syllabus: processed, embedJob: job('running') }), 'embedding');
  assert.equal(pipelineStage({ syllabus: processed, embedJob: job('failed') }), 'embed_failed');
  assert.equal(pipelineStage({ syllabus: processed, embedJob: job('done') }), 'processed');
});
