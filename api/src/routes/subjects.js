/**
 * Subjects API routes — CRUD for instructor subjects.
 *
 *   GET    /api/subjects          — list (with question/TOS/exam counts)
 *   POST   /api/subjects          — create
 *   GET    /api/subjects/:id       — single (with counts)
 *   PUT    /api/subjects/:id       — update
 *   DELETE /api/subjects/:id       — delete one
 *   POST   /api/subjects/bulk-delete — delete many (ids[])
 *
 * All routes are scoped to the authenticated instructor via subjects.instructor_id.
 * IDOR protection: every read/write re-derives ownership from the DB.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = Router();
router.use(requireAuth);

/** Validate subject fields. Returns an error string or null. */
function validate(body) {
  const { name, code, description } = body || {};
  if (!name || !String(name).trim()) return 'Subject name is required.';
  if (String(name).length > 255) return 'Subject name must be 255 characters or fewer.';
  if (code && String(code).length > 50) return 'Code must be 50 characters or fewer.';
  if (description && String(description).length > 5000) return 'Description must be 5000 characters or fewer.';
  return null;
}

/** Load a subject and verify ownership. Returns the row or null. */
async function getOwned(id, userId) {
  const [rows] = await pool.query(
    `SELECT * FROM subjects WHERE id = :id AND instructor_id = :uid LIMIT 1`,
    { id, uid: userId }
  );
  return rows[0] || null;
}

// ── List ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const [subjects] = await pool.query(
      `SELECT id, name, code, description, created_at
       FROM subjects WHERE instructor_id = :uid
       ORDER BY created_at DESC`,
      { uid: req.user.id }
    );

    // Grouped counts (one query each, not per-row).
    const [qCounts] = await pool.query(
      `SELECT subject_id, COUNT(*) AS n FROM questions WHERE created_by = :uid GROUP BY subject_id`,
      { uid: req.user.id }
    );
    const [tCounts] = await pool.query(
      `SELECT t.subject_id, COUNT(*) AS n FROM tos t
       JOIN subjects s ON s.id = t.subject_id WHERE s.instructor_id = :uid GROUP BY t.subject_id`,
      { uid: req.user.id }
    );
    const [eCounts] = await pool.query(
      `SELECT subject_id, COUNT(*) AS n FROM exams WHERE created_by = :uid GROUP BY subject_id`,
      { uid: req.user.id }
    );

    const qMap = {}, tMap = {}, eMap = {};
    for (const r of qCounts) qMap[r.subject_id] = r.n;
    for (const r of tCounts) tMap[r.subject_id] = r.n;
    for (const r of eCounts) eMap[r.subject_id] = r.n;

    for (const s of subjects) {
      s.question_count = qMap[s.id] || 0;
      s.tos_count = tMap[s.id] || 0;
      s.exam_count = eMap[s.id] || 0;
    }

    res.json({ subjects });
  } catch (err) {
    next(err);
  }
});

// ── Create ───────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const err = validate(req.body);
    if (err) return res.status(422).json({ error: err });

    const id = uuid();
    await pool.query(
      `INSERT INTO subjects (id, instructor_id, name, code, description)
       VALUES (:id, :uid, :name, :code, :description)`,
      {
        id,
        uid: req.user.id,
        name: String(req.body.name).trim(),
        code: req.body.code ? String(req.body.code).trim() : null,
        description: req.body.description ? String(req.body.description).trim() : null,
      }
    );

    const [rows] = await pool.query(
      `SELECT id, name, code, description, created_at FROM subjects WHERE id = :id`,
      { id }
    );
    res.status(201).json({ subject: { ...rows[0], question_count: 0, tos_count: 0, exam_count: 0 } });
  } catch (err) {
    next(err);
  }
});

// ── Single ───────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const subject = await getOwned(req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const [qCount] = await pool.query(
      `SELECT COUNT(*) AS n FROM questions WHERE subject_id = :id AND created_by = :uid`,
      { id: subject.id, uid: req.user.id }
    );
    const [tCount] = await pool.query(
      `SELECT COUNT(*) AS n FROM tos WHERE subject_id = :id`,
      { id: subject.id }
    );
    const [eCount] = await pool.query(
      `SELECT COUNT(*) AS n FROM exams WHERE subject_id = :id AND created_by = :uid`,
      { id: subject.id, uid: req.user.id }
    );

    res.json({
      subject: {
        id: subject.id, name: subject.name, code: subject.code,
        description: subject.description, created_at: subject.created_at,
        question_count: qCount[0].n,
        tos_count: tCount[0].n,
        exam_count: eCount[0].n,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Update ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const subject = await getOwned(req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    const err = validate(req.body);
    if (err) return res.status(422).json({ error: err });

    await pool.query(
      `UPDATE subjects SET name = :name, code = :code, description = :description WHERE id = :id`,
      {
        id: subject.id,
        name: String(req.body.name).trim(),
        code: req.body.code ? String(req.body.code).trim() : null,
        description: req.body.description ? String(req.body.description).trim() : null,
      }
    );

    const [rows] = await pool.query(
      `SELECT id, name, code, description, created_at FROM subjects WHERE id = :id`,
      { id: subject.id }
    );
    res.json({ subject: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ── Delete one ───────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const subject = await getOwned(req.params.id, req.user.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found.' });

    await pool.query(`DELETE FROM subjects WHERE id = :id`, { id: subject.id });
    res.json({ message: 'Subject deleted.' });
  } catch (err) {
    next(err);
  }
});

// ── Bulk delete ───────────────────────────────────────
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    // Validate UUID format; re-derive ownership in the query itself so a
    // forged id is a silent no-op (never trust client ids).
    const validIds = ids
      .map(String)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    if (!validIds.length) return res.json({ deleted: 0 });

    const [result] = await pool.query(
      `DELETE FROM subjects WHERE id IN (:ids) AND instructor_id = :uid`,
      { ids: validIds, uid: req.user.id }
    );
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    next(err);
  }
});

export default router;
