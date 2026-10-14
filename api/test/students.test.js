import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import express from 'express';
import jwt from 'jsonwebtoken';

process.env.DATA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');

const { protectText } = await import('../src/services/storageCrypto.js');

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333'; // foreign instructor
const SC1 = 'aaaaaaaa-1111-4111-8111-111111111111';
const SC2 = 'bbbbbbbb-2222-4222-8222-222222222222';
const SC3 = 'cccccccc-3333-4333-8333-333333333333';

/**
 * In-memory store. The router module binds pool.query at import time, so a
 * single module-scope store + shared query function serves every test —
 * boot() resets the data between cases.
 */
let students = [];
let scans = [];

function resetStore() {
  students = [
    { id: S1, instructor_id: 'owner', subject_id: 'subj-1', full_name: protectText('Maria Santos'), student_number: protectText('2024-001'), created_at: '2024-01-01' },
    { id: S2, instructor_id: 'owner', subject_id: null, full_name: protectText('Maria  Santos'), student_number: null, created_at: '2024-01-02' },
    { id: S3, instructor_id: 'other', subject_id: null, full_name: protectText('Eve Foreign'), student_number: protectText('999'), created_at: '2024-01-03' },
  ];
  scans = [
    { id: SC1, student_id: S1, student_name: protectText('Maria Santos'), needs_review: 0, scanned_at: '2024-02-01' },
    { id: SC2, student_id: S2, student_name: protectText('Maria  Santos'), needs_review: 1, scanned_at: '2024-02-02' },
    { id: SC3, student_id: S3, student_name: protectText('Eve Foreign'), needs_review: 0, scanned_at: '2024-02-03' },
  ];
}

const query = async (sql, p) => {
  if (/FROM students st\s+LEFT JOIN scan_results/.test(sql)) {
    assert.equal(p.uid, 'owner'); // every list call must be instructor-scoped
    const mine = students.filter((s) => s.instructor_id === 'owner'
      && (!p.subjectId || s.subject_id === p.subjectId));
    return [mine.map((s) => ({
      ...s,
      subject_code: s.subject_id ? 'PE 3' : null,
      subject_name: s.subject_id ? 'Physical Education' : null,
      scan_count: scans.filter((x) => x.student_id === s.id).length,
      needs_review: scans.filter((x) => x.student_id === s.id && x.needs_review).length,
      last_scanned_at: scans.filter((x) => x.student_id === s.id).map((x) => x.scanned_at).sort().pop() || null,
    }))];
  }
  if (/SELECT id, full_name, student_number FROM students/.test(sql)) {
    return [students.filter((s) => s.id === p.id && s.instructor_id === p.uid)];
  }
  if (/SELECT id, full_name FROM students/.test(sql)) {
    return [students.filter((s) => s.instructor_id === p.uid && (s.id === p.sourceId || s.id === p.targetId))];
  }
  if (/UPDATE students/.test(sql)) {
    const st = students.find((s) => s.id === p.id && s.instructor_id === p.uid);
    if (st) { st.full_name = p.name; st.student_number = p.num; }
    return [{ affectedRows: st ? 1 : 0 }];
  }
  if (/UPDATE scan_results SET student_id/.test(sql)) {
    let n = 0;
    for (const sc of scans) {
      if (sc.student_id === p.sourceId) { sc.student_id = p.targetId; sc.student_name = p.targetName; n++; }
    }
    return [{ affectedRows: n }];
  }
  if (/UPDATE scan_results SET student_name/.test(sql)) {
    for (const sc of scans) if (sc.student_id === p.id) sc.student_name = p.name;
    return [{ affectedRows: 1 }];
  }
  if (/DELETE FROM students/.test(sql)) {
    const i = students.findIndex((s) => s.id === p.sourceId);
    if (i >= 0) students.splice(i, 1);
    return [{ affectedRows: i >= 0 ? 1 : 0 }];
  }
  if (/INSERT INTO audit_log|INSERT INTO audit_logs/.test(sql)) return [{}];
  assert.fail(`Unexpected SQL: ${sql}`);
};

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
  env.jwt.secret = 'students-test-secret';
  t.after(() => { env.jwt.secret = oldSecret; });

  const { default: router } = await import('../src/routes/students.js');
  const app = express();
  app.use(express.json());
  app.use('/students', router);
  app.use((err, req, res, _next) => res.status(500).json({ error: err.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const token = (id) => jwt.sign({ id, role: 'instructor', email: `${id}@example.invalid` }, env.jwt.secret);
  const request = async (path, method = 'GET', body, user = 'owner') => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/students${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${token(user)}` } : {}) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  return { request };
}

test('GET /students returns only the instructor roster, decrypted, searchable', async (t) => {
  const { request } = await boot(t);
  const all = await request('/');
  assert.equal(all.status, 200);
  assert.equal(all.body.students.length, 2); // S3 belongs to another instructor
  const names = all.body.students.map((s) => s.full_name).sort();
  assert.deepEqual(names, ['Maria  Santos', 'Maria Santos']);
  assert.equal(all.body.students.find((s) => s.id === S1).scan_count, 1);
  assert.equal(all.body.students.find((s) => s.id === S1).subject_code, 'PE 3');

  const filtered = await request('/?q=001');
  assert.equal(filtered.body.students.length, 1);
  assert.equal(filtered.body.students[0].student_number, '2024-001');

  assert.equal((await request('/', 'GET', undefined, null)).status, 401);
});

test('PATCH /students/:id renames, rehashes, and refreshes scan snapshots', async (t) => {
  const { request } = await boot(t);

  assert.equal((await request(`/${S1}`, 'PATCH', {})).status, 400);
  assert.equal((await request('/not-a-uuid', 'PATCH', { fullName: 'X' })).status, 400);
  assert.equal((await request(`/${S3}`, 'PATCH', { fullName: 'X' })).status, 404); // foreign row

  const ok = await request(`/${S2}`, 'PATCH', { fullName: 'Maria Santos', studentNumber: '2024-001' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.student.full_name, 'Maria Santos');
  const scan = scans.find((x) => x.id === SC2);
  assert.equal(scan.student_name.startsWith('nexam:v1:'), true); // re-encrypted
});

test('POST /students/merge reassigns scans under the target identity', async (t) => {
  const { request } = await boot(t);

  assert.equal((await request('/merge', 'POST', { sourceId: S1, targetId: S1 })).status, 400);
  assert.equal((await request('/merge', 'POST', { sourceId: S3, targetId: S1 })).status, 404); // foreign source
  assert.equal((await request('/merge', 'POST', { sourceId: S1, targetId: S3 })).status, 404); // foreign target

  const ok = await request('/merge', 'POST', { sourceId: S2, targetId: S1 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.moved, 1);
  assert.equal(scans.find((x) => x.id === SC2).student_id, S1);
  assert.equal(students.some((s) => s.id === S2), false); // source gone
  assert.equal(students.length, 2); // S1 + foreign S3
});
