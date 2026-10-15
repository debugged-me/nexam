import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { sourceHash } from '../src/services/syllabusBlueprint.js';

test('concurrent scan requests reuse active jobs and existing results but allow changed or deleted sources', async (t) => {
  const material = { id: 'material', subject_id: 'subject', created_by: 'owner', is_syllabus: 1, status: 'processed', content: 'Original syllabus content' };
  const jobs = [];
  const blueprints = new Map();
  let tail = Promise.resolve();
  const getConnection = async () => {
    let unlock;
    const release = () => { unlock?.(); unlock = null; };
    return {
      beginTransaction: async () => {}, commit: async () => release(), rollback: async () => release(), release,
      query: async (sql, p) => {
        if (/SELECT m\.\*/.test(sql)) {
          const previous = tail;
          tail = new Promise((resolve) => { unlock = resolve; });
          await previous;
          return [[...(p.id === material.id && p.uid === material.created_by ? [material] : [])]];
        }
        if (/FROM ai_jobs/.test(sql)) return [[...jobs].reverse().filter((j) => ['queued', 'running', 'done'].includes(j.status))];
        if (/FROM tos/.test(sql)) return [[...(blueprints.has(p.id) ? [blueprints.get(p.id)] : [])]];
        if (/INSERT INTO ai_jobs/.test(sql)) { jobs.push({ id: p.id, status: 'queued', payload: p.payload }); return [{ affectedRows: 1 }]; }
        assert.fail(sql);
      },
    };
  };
  t.mock.method(mysql, 'createPool', () => ({ getConnection }));
  const { queueSyllabusScan } = await import('../src/services/syllabusScan.js');
  const args = { materialId: 'material', userId: 'owner' };
  const concurrent = await Promise.all([queueSyllabusScan(args), queueSyllabusScan(args)]);
  assert.equal(jobs.length, 1);
  assert.equal(concurrent[0].jobId, concurrent[1].jobId);
  assert.equal(concurrent[1].reused, true);
  jobs[0].status = 'done'; jobs[0].result = JSON.stringify({ tosId: 'blueprint' });
  blueprints.set('blueprint', { id: 'blueprint', source_meta: JSON.stringify({ materialId: 'material', contentHash: sourceHash(material.content) }) });
  assert.equal((await queueSyllabusScan(args)).tosId, 'blueprint');
  assert.equal(jobs.length, 1);
  blueprints.clear();
  const recreated = await queueSyllabusScan(args);
  assert.equal(recreated.reused, false);
  assert.equal(jobs.length, 2);
  material.content = 'Revised syllabus content';
  assert.equal((await queueSyllabusScan(args)).reused, false);
  assert.equal(jobs.length, 3);
  assert.equal((await queueSyllabusScan({ ...args, tosId: 'separate-draft' })).reused, false);
  await assert.rejects(queueSyllabusScan({ ...args, userId: 'stranger' }), /owned by this instructor/);
  assert.equal(jobs.length, 4);
});
