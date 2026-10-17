import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool from '../src/config/db.js';
import {
  compareSyllabusCourse,
  extractSyllabusCourseTitle,
  generationReadiness,
  readinessFromChunks,
} from '../src/services/generationReadiness.js';

after(async () => {
  const conn = await pool.getConnection();
  conn.release();
  await pool.end();
});

test('a syllabus chunk never makes question generation ready', () => {
  assert.deepEqual(readinessFromChunks([
    { id: 's1', materialId: 'syllabus', is_syllabus: 1 },
  ]), {
    ready: false,
    scoped: true,
    lessonMaterials: 0,
    lessonChunks: 0,
    code: 'LESSON_EVIDENCE_REQUIRED',
  });
});

test('scoped supporting lesson chunks make generation ready', () => {
  assert.deepEqual(readinessFromChunks([
    { id: 's1', materialId: 'syllabus', is_syllabus: 1 },
    { id: 'l1', materialId: 'module-1', is_syllabus: 0 },
    { id: 'l2', materialId: 'module-1', is_syllabus: 0 },
  ]), {
    ready: true,
    scoped: true,
    lessonMaterials: 1,
    lessonChunks: 2,
    code: null,
  });
});

test('unscoped readiness uses only processed non-syllabus chunks from the owned subject', async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ lesson_materials: '2', lesson_chunks: '7' }]];
    },
  };
  const result = await generationReadiness({ subject_id: 'subject-1' }, 'user-1', null, db);
  assert.equal(result.ready, true);
  assert.equal(result.lessonMaterials, 2);
  assert.equal(result.lessonChunks, 7);
  assert.match(calls[0].sql, /m\.is_syllabus = 0/);
  assert.deepEqual(calls[0].params, { subjectId: 'subject-1', userId: 'user-1' });
});

test('course title extraction supports same-line and next-line syllabus labels', () => {
  assert.equal(extractSyllabusCourseTitle('Course Title: Physical Activities Toward Health and Fitness 3'), 'Physical Activities Toward Health and Fitness 3');
  assert.equal(extractSyllabusCourseTitle('Course Title\nDatabase Systems'), 'Database Systems');
});

test('course comparison flags the observed PATHFit versus IT subject mismatch', () => {
  const result = compareSyllabusCourse(
    'Course Title: Physical Activities Toward Health and Fitness 3',
    { code: 'TECH 1', name: 'Introduction to Information Technology' },
  );
  assert.equal(result.mismatch, true);
  assert.equal(result.syllabusCourseTitle, 'Physical Activities Toward Health and Fitness 3');
});

test('course comparison does not flag a matching course', () => {
  const result = compareSyllabusCourse(
    'Course Title: Database Management Systems',
    { code: 'IT 203', name: 'Database Management Systems' },
  );
  assert.equal(result.mismatch, false);
});
