import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.DATA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');

const { protectText } = await import('../src/services/storageCrypto.js');

const EXAM = '44444444-4444-4444-8444-444444444444';
const SET_A = '55555555-5555-4555-8555-555555555555';
const STUDENT = '66666666-6666-4666-8666-666666666666';
const QUESTION = '77777777-7777-4777-8777-777777777777';
const PRIOR_SCAN = '88888888-8888-4888-8888-888888888888';

/**
 * Same module-scope store pattern as students.test.js — the router binds
 * pool.query at first import, so one shared fake DB serves every test.
 */
let scans;
let scanAnswers;
let students;
let insertedScans;
let deletedScanIds;

const SNAPSHOT_QUESTIONS = [
  { id: QUESTION, type: 'mcq', answer: 'Paris', options: JSON.stringify(['Mumbai', 'Paris', 'London']), sort_order: 1, snapshot_version: 1 },
];

function resetStore() {
  scans = [];
  scanAnswers = [];
  insertedScans = [];
  deletedScanIds = [];
  students = [
    { id: STUDENT, instructor_id: 'owner', subject_id: 'subj-1', full_name: protectText('Maria Santos'), student_number: protectText('2024-001') },
  ];
}

const query = async (sql, p) => {
  // Ownership: exam belongs to this instructor.
  if (/FROM exams e\s+JOIN subjects s/.test(sql)) {
    assert.equal(p.userId ?? p.uid, 'owner');
    return [[{ id: EXAM, subject_id: 'subj-1' }]];
  }
  // clientScanId idempotency replay.
  if (/SELECT id FROM scan_results WHERE scanned_by/.test(sql)) {
    return [scans.filter((s) => s.client_scan_id === p.cid).map((s) => ({ id: s.id }))];
  }
  // Stored-result reload after a retry hits the dedup path.
  if (/SELECT id, exam_id, exam_set_id, student_name, total_items/.test(sql)) {
    return [scans.filter((s) => s.id === p.scanId)];
  }
  // Set resolution: explicit examSetId.
  if (/SELECT id FROM exam_sets WHERE id/.test(sql)) {
    return [[{ id: SET_A }]];
  }
  if (/FROM exam_set_questions esq\s+LEFT JOIN questions/.test(sql)) {
    assert.match(sql, /snapshot_version/);
    assert.match(sql, /question_answer/);
    return [SNAPSHOT_QUESTIONS];
  }
  // findOrCreateStudent — student_number blind index first.
  if (/FROM students\s+WHERE instructor_id = :uid AND student_number_hash/.test(sql)) {
    return [students.filter((s) => s.student_number === p.numberHash || p.numberHash == null ? false : blindEq(s.student_number, p.numberHash)).map((s) => ({ id: s.id }))];
  }
  if (/FROM students\s+WHERE instructor_id = :uid AND full_name_hash/.test(sql)) {
    return [[]];
  }
  if (/INSERT INTO students/.test(sql)) {
    students.push({ id: p.id, instructor_id: 'owner', subject_id: p.subjectId, full_name: p.name, student_number: p.num });
    return [{}];
  }
  // Duplicate guard — prior scans for this exam + student.
  if (/SELECT id, score, scanned_at FROM scan_results\s+WHERE exam_id = :examId AND student_id/.test(sql)) {
    return [scans.filter((s) => s.exam_id === p.examId && s.student_id === p.studentId)
      .map((s) => ({ id: s.id, score: s.score, scanned_at: s.scanned_at }))];
  }
  if (/DELETE FROM scan_results WHERE exam_id/.test(sql)) {
    const doomed = scans.filter((s) => s.exam_id === p.examId && s.student_id === p.studentId);
    deletedScanIds.push(...doomed.map((s) => s.id));
    scans = scans.filter((s) => !(s.exam_id === p.examId && s.student_id === p.studentId));
    return [{ affectedRows: doomed.length }];
  }
  if (/INSERT INTO scan_results/.test(sql)) {
    const row = {
      id: p.id, exam_id: p.examId, exam_set_id: p.examSetId, student_id: p.studentId,
      student_name: p.studentName, total_items: p.totalItems, correct_count: p.correctCount,
      score: p.score, needs_review: p.needsReview, client_scan_id: p.clientScanId,
      scanned_at: '2024-03-01T00:00:00Z',
    };
    scans.push(row);
    insertedScans.push(row);
    return [{}];
  }
  if (/INSERT INTO scan_answers/.test(sql)) {
    scanAnswers.push({ scan_result_id: p.scanId, item_number: p.itemNumber, marked_answer: p.markedAnswer });
    return [{}];
  }
  // loadStoredScanResult per-item reload (dedup replay path).
  if (/FROM scan_answers sa/.test(sql)) {
    return [scanAnswers.filter((a) => a.scan_result_id === p.scanId)
      .map((a) => ({ item_number: a.item_number, marked_answer: a.marked_answer, correct_answer: 'B', is_correct: 1, ambiguous: 0, type: 'mcq' }))];
  }
  if (/INSERT INTO audit_logs/.test(sql)) return [{}];
  assert.fail(`Unexpected SQL: ${sql}`);
};

// The store keeps ciphertext in student_number; the blind index the route
// computes is a keyed hash — compare by hashing the plain fixture value.
import { blindIndex, unprotectText } from '../src/services/storageCrypto.js';
function blindEq(encrypted, hash) {
  return blindIndex(unprotectText(encrypted)) === hash;
}

async function boot(t) {
  resetStore();
  t.mock.method(mysql, 'createPool', () => ({
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  }));

  const { default: env } = await import('../src/config/env.js');
  const oldSecret = env.jwt.secret;
  env.jwt.secret = 'scans-test-secret';
  t.after(() => { env.jwt.secret = oldSecret; });

  const { default: router } = await import('../src/routes/scans.js');
  const app = express();
  app.use(express.json());
  app.use('/scans', router);
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: err.message, code: err.code }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = jwt.sign({ id: 'owner', role: 'instructor', email: 'owner@example.invalid' }, env.jwt.secret);
  const post = async (body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/scans`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { post };
}

const SUBMIT = {
  examId: EXAM,
  examSetId: SET_A,
  studentName: 'Maria Santos',
  studentNumber: '2024-001',
  answers: [{ itemNumber: 1, markedAnswer: 'B', ambiguous: false }],
};

test('a first scan scores against the frozen set snapshot', async (t) => {
  const { post } = await boot(t);
  const res = await post({ ...SUBMIT, clientScanId: 'scan-key-0001' });
  assert.equal(res.status, 201);
  assert.equal(res.body.correctCount, 1); // B == Paris
  assert.equal(res.body.score, 100);
  assert.equal(insertedScans.length, 1);
  assert.equal(insertedScans[0].student_id, STUDENT); // matched by number
});

test('a second scan for the same student+exam is a conflict, not a duplicate row', async (t) => {
  const { post } = await boot(t);
  scans.push({
    id: PRIOR_SCAN, exam_id: EXAM, student_id: STUDENT, score: '80.00',
    needs_review: 0, client_scan_id: 'earlier-key', scanned_at: '2024-02-01T00:00:00Z',
  });

  const res = await post({ ...SUBMIT, clientScanId: 'scan-key-0002' });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'DUPLICATE_SCAN');
  assert.equal(res.body.existing.scanIds[0], PRIOR_SCAN);
  assert.equal(insertedScans.length, 0); // nothing written
  assert.equal(scans.length, 1); // prior untouched
});

test('replaceExisting deletes the prior scan and records the new one', async (t) => {
  const { post } = await boot(t);
  scans.push({
    id: PRIOR_SCAN, exam_id: EXAM, student_id: STUDENT, score: '80.00',
    needs_review: 0, client_scan_id: 'earlier-key', scanned_at: '2024-02-01T00:00:00Z',
  });

  const res = await post({ ...SUBMIT, clientScanId: 'scan-key-0003', replaceExisting: true });
  assert.equal(res.status, 201);
  assert.deepEqual(deletedScanIds, [PRIOR_SCAN]);
  assert.equal(insertedScans.length, 1);
  assert.equal(scans.length, 1);
  assert.notEqual(scans[0].id, PRIOR_SCAN);
});

test('same clientScanId retries replay the stored result, never a duplicate', async (t) => {
  const { post } = await boot(t);
  const first = await post({ ...SUBMIT, clientScanId: 'scan-key-0004' });
  assert.equal(first.status, 201);
  const second = await post({ ...SUBMIT, clientScanId: 'scan-key-0004' });
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(second.body.id, first.body.id);
  assert.equal(insertedScans.length, 1);
});
