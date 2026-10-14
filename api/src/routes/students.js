/**
 * Student routes — the roster that OMR scanning builds up automatically.
 *
 * GET   /api/students?q=&subject_id= — list the instructor roster with scan stats
 * PATCH /api/students/:id            — rename / renumber a student record
 * POST  /api/students/merge          — fold a duplicate record into the real one
 *
 * Students are created implicitly by POST /api/scans (findOrCreateStudent),
 * so typos and name variants accumulate over time. These routes give the
 * instructor the cleanup tools: search, rename, and merge. Names and numbers
 * are stored encrypted with HMAC blind indexes; exact-match dedup lives in
 * scans.js, fuzzy search here happens after decryption (the roster is small).
 */
import { Router } from 'express';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { blindIndex, protectText, unprotectText } from '../services/storageCrypto.js';

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_NAME = 200;
const MAX_NUMBER = 50;
const LIST_CAP = 200;

function reveal(row) {
  return {
    id: row.id,
    subject_id: row.subject_id,
    subject_code: row.subject_code || null,
    subject_name: row.subject_name || null,
    full_name: unprotectText(row.full_name) || 'Unknown',
    student_number: unprotectText(row.student_number) || null,
    scan_count: Number(row.scan_count || 0),
    needs_review: Number(row.needs_review || 0),
    last_scanned_at: row.last_scanned_at,
    created_at: row.created_at,
  };
}

/** GET /api/students — decrypted roster with scan stats, substring search. */
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const subjectId = String(req.query.subject_id || '').trim();
    const params = { uid: req.user.id };

    let sql = `
      SELECT st.id, st.subject_id, st.student_number, st.full_name, st.created_at,
             subj.code AS subject_code, subj.name AS subject_name,
             COUNT(sr.id) AS scan_count,
             COALESCE(SUM(sr.needs_review), 0) AS needs_review,
             MAX(sr.scanned_at) AS last_scanned_at
      FROM students st
      LEFT JOIN scan_results sr ON sr.student_id = st.id
      LEFT JOIN subjects subj ON subj.id = st.subject_id
      WHERE st.instructor_id = :uid
    `;
    if (subjectId && UUID_RE.test(subjectId)) {
      sql += ' AND st.subject_id = :subjectId';
      params.subjectId = subjectId;
    }
    sql += ' GROUP BY st.id, subj.code, subj.name LIMIT 2000';

    const [rows] = await pool.query(sql, params);
    let students = rows.map(reveal);
    if (q) {
      students = students.filter((s) =>
        s.full_name.toLowerCase().includes(q)
        || (s.student_number || '').toLowerCase().includes(q));
    }
    students.sort((a, b) =>
      String(b.last_scanned_at || '').localeCompare(String(a.last_scanned_at || ''))
      || a.full_name.localeCompare(b.full_name));
    res.json({ students: students.slice(0, LIST_CAP) });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/students/:id — rename or renumber a student.
 *
 * Body: { fullName?, studentNumber? } — at least one is required; an empty
 * studentNumber clears the number. The stored ciphertext and both blind
 * indexes are rewritten, and scan_results.student_name snapshots are
 * refreshed so reports show the corrected name.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(String(id))) {
      return res.status(400).json({ error: 'Valid student id is required.' });
    }
    const { fullName, studentNumber } = req.body || {};
    const name = fullName === undefined ? undefined : String(fullName).trim();
    const number = studentNumber === undefined ? undefined : String(studentNumber).trim();
    if (name === undefined && number === undefined) {
      return res.status(400).json({ error: 'Provide fullName or studentNumber.' });
    }
    if (name !== undefined && (!name || name.length > MAX_NAME)) {
      return res.status(400).json({ error: 'fullName must be 1–200 characters.' });
    }
    if (number !== undefined && number.length > MAX_NUMBER) {
      return res.status(400).json({ error: 'studentNumber must be 50 characters or fewer.' });
    }

    const [rows] = await pool.query(
      `SELECT id, full_name, student_number FROM students
       WHERE id = :id AND instructor_id = :uid`,
      { id, uid: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Student not found.' });
    const current = rows[0];

    const nextName = name !== undefined ? name : unprotectText(current.full_name);
    const nextNumber = number !== undefined ? (number || null)
      : unprotectText(current.student_number);

    await pool.query(
      `UPDATE students
       SET full_name = :name, full_name_hash = :nameHash,
           student_number = :num, student_number_hash = :numHash
       WHERE id = :id AND instructor_id = :uid`,
      {
        id, uid: req.user.id,
        name: protectText(nextName), nameHash: blindIndex(nextName),
        num: nextNumber ? protectText(nextNumber) : null,
        numHash: blindIndex(nextNumber || ''),
      }
    );
    // Scan rows carry a denormalized display name — refresh it so renamed
    // students show correctly in analytics and reports.
    await pool.query(
      `UPDATE scan_results SET student_name = :name WHERE student_id = :id`,
      { name: protectText(nextName), id }
    );

    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'student.update', targetType: 'student', targetId: id,
      detail: { nameChanged: name !== undefined, numberChanged: number !== undefined },
      ip: req.ip,
    });
    res.json({ ok: true, student: { id, full_name: nextName, student_number: nextNumber } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/students/merge — fold a duplicate record into the real one.
 *
 * Body: { sourceId, targetId }. Every scan on the source is reassigned to
 * the target (and takes the target display name), then the source row is
 * deleted. Runs in a single transaction.
 */
router.post('/merge', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { sourceId, targetId } = req.body || {};
    if (!UUID_RE.test(String(sourceId)) || !UUID_RE.test(String(targetId))) {
      return res.status(400).json({ error: 'sourceId and targetId are required.' });
    }
    if (sourceId === targetId) {
      return res.status(400).json({ error: 'Choose a different student to merge into.' });
    }

    const [rows] = await conn.query(
      `SELECT id, full_name FROM students
       WHERE instructor_id = :uid AND (id = :sourceId OR id = :targetId)`,
      { uid: req.user.id, sourceId, targetId }
    );
    const target = rows.find((r) => r.id === targetId);
    const source = rows.find((r) => r.id === sourceId);
    if (!target || !source) return res.status(404).json({ error: 'Student not found.' });

    await conn.beginTransaction();
    const [upd] = await conn.query(
      `UPDATE scan_results SET student_id = :targetId, student_name = :targetName
       WHERE student_id = :sourceId`,
      { targetId, targetName: target.full_name, sourceId }
    );
    await conn.query(`DELETE FROM students WHERE id = :sourceId`, { sourceId });
    await conn.commit();

    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'student.merge', targetType: 'student', targetId,
      detail: { mergedFrom: sourceId, scansMoved: upd.affectedRows },
      ip: req.ip,
    });
    res.json({ ok: true, moved: upd.affectedRows });
  } catch (err) {
    try { await conn.rollback(); } catch { /* not in a transaction */ }
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
