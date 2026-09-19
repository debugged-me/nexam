/**
 * Question routes — full CRUD, approval workflow, similarity review.
 *
 *   GET    /api/questions                — list (filterable by subject/bloom/type/status)
 *   POST   /api/questions                — create (manual entry)
 *   GET    /api/questions/:id            — single
 *   PUT    /api/questions/:id            — update
 *   DELETE /api/questions/:id             — delete
 *   POST   /api/questions/:id/approve     — draft → active (records approver)
 *   POST   /api/questions/:id/reject      — delete a draft
 *   POST   /api/questions/bulk-approve   — approve many drafts
 *   POST   /api/questions/bulk-delete     — delete many
 *   POST   /api/questions/import          — parse GIFT/XML, create drafts
 *   GET    /api/questions/:id/similarity  — view similarity matches
 *   POST   /api/questions/:id/similarity/decide — record keep/reject decision
 *
 * All routes are scoped by created_by = req.user.id (IDOR protection).
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseGIFT, parseCanvasXML } from '../services/lmsExport.js';
import { enqueue } from '../services/jobs.js';
import { indexQuestionIfActive, removeQuestionFromIndex } from '../services/questionIndex.js';

const router = Router();
router.use(requireAuth);

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const QUESTION_TYPES = ['mcq', 'true_false', 'matching', 'identification'];
// 'rejected' is a soft-delete status set via the reject endpoints; PUT may
// also set it explicitly. Only draft/active questions may enter exams.
const STATUSES = ['draft', 'active', 'rejected'];
const LIST_STATUSES = STATUSES;

/** Load a question and verify ownership. */
async function getOwned(id, userId) {
  const [rows] = await pool.query(
    `SELECT * FROM questions WHERE id = :id AND created_by = :uid LIMIT 1`,
    { id, uid: userId }
  );
  return rows[0] || null;
}

/** Validate question fields. Returns { error } or { data }. */
function validate(body) {
  const { subject_id, type, stem, bloom, status, options, answer } = body || {};
  if (!subject_id) return { error: 'Subject is required.' };
  if (!type || !QUESTION_TYPES.includes(type)) return { error: 'Invalid question type.' };
  if (!stem || !String(stem).trim()) return { error: 'Question stem is required.' };
  if (String(stem).length > 10000) return { error: 'Stem is too long.' };
  if (bloom && !BLOOM_LEVELS.includes(bloom)) return { error: 'Invalid Bloom level.' };
  if (status && !STATUSES.includes(status)) return { error: 'Invalid status.' };

  // MCQ needs ≥2 options and a matching answer
  if (type === 'mcq') {
    const opts = Array.isArray(options) ? options : [];
    if (opts.length < 2) return { error: 'Multiple-choice questions need at least two options.' };
    if (!answer || !opts.includes(answer)) return { error: 'Answer must match one of the options.' };
  }
  // true_false needs True or False
  if (type === 'true_false' && answer && !['True', 'False'].includes(answer)) {
    return { error: 'Answer must be "True" or "False".' };
  }
  return { ok: true };
}

// ── List ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { subject_id, bloom, type, status, tos_id } = req.query;
    const params = { uid: req.user.id };
    const where = ['q.created_by = :uid'];

    if (subject_id) { where.push('q.subject_id = :subject_id'); params.subject_id = subject_id; }
    if (bloom && BLOOM_LEVELS.includes(bloom)) { where.push('q.bloom = :bloom'); params.bloom = bloom; }
    if (type && QUESTION_TYPES.includes(type)) { where.push('q.type = :type'); params.type = type; }
    if (status && LIST_STATUSES.includes(status)) { where.push('q.status = :status'); params.status = status; }
    if (tos_id) { where.push('q.tos_id = :tos_id'); params.tos_id = tos_id; }

    const [questions] = await pool.query(
      `SELECT q.id, q.subject_id, q.tos_id, q.topic, q.bloom, q.ai_predicted_bloom,
              q.type, q.stem, q.options, q.answer, q.explanation,
              q.similarity_flag, q.similarity_score, q.source, q.status,
              q.approved_by, q.approved_at, q.created_at, q.updated_at,
              s.name AS subject_name, s.code AS subject_code
       FROM questions q
       LEFT JOIN subjects s ON s.id = q.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY q.created_at DESC`,
      params
    );

    // Parse options JSON for each question
    for (const q of questions) {
      if (q.options) {
        try { q.options = JSON.parse(q.options); } catch { q.options = []; }
      } else {
        q.options = [];
      }
    }

    res.json({ questions });
  } catch (err) {
    next(err);
  }
});

// ── Create ───────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const v = validate(req.body);
    if (v.error) return res.status(422).json({ error: v.error });

    // Verify subject ownership
    const [subjRows] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :uid`,
      { id: req.body.subject_id, uid: req.user.id }
    );
    if (!subjRows.length) return res.status(403).json({ error: 'Subject not found or not owned by you.' });

    const id = uuid();
    const optionsJson = req.body.type === 'mcq' && Array.isArray(req.body.options)
      ? JSON.stringify(req.body.options) : null;

    await pool.query(
      `INSERT INTO questions
       (id, subject_id, tos_id, topic, bloom, type, stem, options, answer, explanation,
        status, source, created_by, created_at, updated_at)
       VALUES (:id, :subject_id, :tos_id, :topic, :bloom, :type, :stem, :options, :answer,
               :explanation, :status, 'manual', :uid, NOW(), NOW())`,
      {
        id,
        subject_id: req.body.subject_id,
        tos_id: req.body.tos_id || null,
        topic: req.body.topic || null,
        bloom: req.body.bloom || null,
        type: req.body.type,
        stem: String(req.body.stem).trim(),
        options: optionsJson,
        answer: req.body.answer || null,
        explanation: req.body.explanation || null,
        status: req.body.status || 'draft',
        uid: req.user.id,
      }
    );

    // Manual questions get the same similarity check as AI/imported ones —
    // a duplicate is a duplicate regardless of provenance.
    try {
      await enqueue({
        type: 'similarity',
        payload: { questionId: id, userId: req.user.id },
        userId: req.user.id,
        subjectId: req.body.subject_id,
      });
    } catch { /* job queue failure must not fail the create */ }

    const [rows] = await pool.query(`SELECT * FROM questions WHERE id = :id`, { id });
    const q = rows[0];
    if (q.options) { try { q.options = JSON.parse(q.options); } catch { q.options = []; } }
    res.status(201).json({ question: q });
  } catch (err) {
    next(err);
  }
});

// ── Single ───────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });
    if (q.options) { try { q.options = JSON.parse(q.options); } catch { q.options = []; } }
    res.json({ question: q });
  } catch (err) { next(err); }
});

// ── Update ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });

    const v = validate({ ...req.body, subject_id: req.body.subject_id || q.subject_id });
    if (v.error) return res.status(422).json({ error: v.error });

    const optionsJson = req.body.type === 'mcq' && Array.isArray(req.body.options)
      ? JSON.stringify(req.body.options) : null;

    const newStatus = req.body.status || q.status;
    // A direct status→active transition is an approval — record who/when.
    const approving = q.status !== 'active' && newStatus === 'active';

    await pool.query(
      `UPDATE questions SET
         subject_id = :subject_id, tos_id = :tos_id, topic = :topic, bloom = :bloom,
         type = :type, stem = :stem, options = :options, answer = :answer,
         explanation = :explanation, status = :status,
         approved_by = :approvedBy, approved_at = :approvedAt, updated_at = NOW()
       WHERE id = :id`,
      {
        id: q.id,
        subject_id: req.body.subject_id || q.subject_id,
        tos_id: req.body.tos_id || null,
        topic: req.body.topic || null,
        bloom: req.body.bloom || null,
        type: req.body.type || q.type,
        stem: String(req.body.stem || q.stem).trim(),
        options: optionsJson,
        answer: req.body.answer || null,
        explanation: req.body.explanation || null,
        status: newStatus,
        approvedBy: approving ? req.user.id : q.approved_by,
        approvedAt: approving ? new Date() : q.approved_at,
      }
    );

    const [rows] = await pool.query(`SELECT * FROM questions WHERE id = :id`, { id: q.id });
    const updated = rows[0];

    // Keep the vector index + similarity state in sync with the lifecycle.
    const contentChanged =
      updated.stem !== q.stem || updated.options !== q.options ||
      updated.answer !== q.answer || updated.type !== q.type;
    if (approving || (contentChanged && updated.status === 'active')) {
      await indexQuestionIfActive(updated);
    }
    if (contentChanged) {
      try {
        await enqueue({
          type: 'similarity',
          payload: { questionId: q.id, userId: req.user.id },
          userId: req.user.id,
          subjectId: updated.subject_id,
        });
      } catch { /* non-fatal */ }
    }
    if (newStatus === 'rejected' && q.status !== 'rejected') {
      await removeQuestionFromIndex(updated.subject_id, q.id);
    }

    if (updated.options) { try { updated.options = JSON.parse(updated.options); } catch { updated.options = []; } }
    res.json({ question: updated });
  } catch (err) { next(err); }
});

// ── Delete ───────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });

    await pool.query(
      `DELETE FROM similarity_results WHERE question_id = :id OR similar_question_id = :id`,
      { id: q.id }
    );
    await pool.query(`DELETE FROM questions WHERE id = :id`, { id: q.id });
    await removeQuestionFromIndex(q.subject_id, q.id);

    res.json({ message: 'Question deleted.' });
  } catch (err) { next(err); }
});

// ── Approve (draft → active) ─────────────────────────
router.post('/:id/approve', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });
    if (q.status === 'active') return res.json({ message: 'Already approved.' });

    await pool.query(
      `UPDATE questions SET status = 'active', approved_by = :uid, approved_at = NOW(), updated_at = NOW()
       WHERE id = :id`,
      { id: q.id, uid: req.user.id }
    );

    // Approved questions enter the similarity index.
    await indexQuestionIfActive({ ...q, status: 'active' });

    res.json({ message: 'Question approved.', status: 'active' });
  } catch (err) { next(err); }
});

// ── Reject (soft-delete: status → 'rejected') ────────
router.post('/:id/reject', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });

    await pool.query(
      `UPDATE questions SET status = 'rejected', similarity_flag = 'rejected', updated_at = NOW()
       WHERE id = :id`,
      { id: q.id }
    );
    await removeQuestionFromIndex(q.subject_id, q.id);

    res.json({ message: 'Question rejected.', status: 'rejected' });
  } catch (err) { next(err); }
});

// ── Bulk approve ─────────────────────────────────────
router.post('/bulk-approve', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const validIds = ids.map(String).filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    if (!validIds.length) return res.json({ approved: 0 });

    const [result] = await pool.query(
      `UPDATE questions SET status = 'active', approved_by = :uid, approved_at = NOW(), updated_at = NOW()
       WHERE id IN (:ids) AND created_by = :uid AND status = 'draft'`,
      { ids: validIds, uid: req.user.id }
    );

    // Index the newly-active questions (best-effort, non-blocking order).
    if (result.affectedRows > 0) {
      const [active] = await pool.query(
        `SELECT * FROM questions WHERE id IN (:ids) AND created_by = :uid AND status = 'active'`,
        { ids: validIds, uid: req.user.id }
      );
      for (const q of active) await indexQuestionIfActive(q);
    }

    res.json({ approved: result.affectedRows });
  } catch (err) { next(err); }
});

// ── Bulk delete ──────────────────────────────────────
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const validIds = ids.map(String).filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    if (!validIds.length) return res.json({ deleted: 0 });

    const [owned] = await pool.query(
      `SELECT id, subject_id FROM questions WHERE id IN (:ids) AND created_by = :uid`,
      { ids: validIds, uid: req.user.id }
    );

    await pool.query(
      `DELETE FROM similarity_results
       WHERE question_id IN (:ids) OR similar_question_id IN (:ids)`,
      { ids: validIds }
    );
    const [result] = await pool.query(
      `DELETE FROM questions WHERE id IN (:ids) AND created_by = :uid`,
      { ids: validIds, uid: req.user.id }
    );

    for (const q of owned) await removeQuestionFromIndex(q.subject_id, q.id);

    res.json({ deleted: result.affectedRows });
  } catch (err) { next(err); }
});

// ── Similarity review ────────────────────────────────
router.get('/:id/similarity', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });

    const [matches] = await pool.query(
      `SELECT sr.id AS result_id, sr.score, sr.decision, sr.decided_at,
              q2.id AS match_id, q2.stem AS match_stem, q2.type AS match_type,
              q2.bloom AS match_bloom, q2.status AS match_status, q2.topic AS match_topic
       FROM similarity_results sr
       LEFT JOIN questions q2 ON q2.id = sr.similar_question_id
       WHERE sr.question_id = :qid
       ORDER BY sr.score DESC`,
      { qid: q.id }
    );

    if (q.options) { try { q.options = JSON.parse(q.options); } catch { q.options = []; } }
    res.json({ question: q, matches });
  } catch (err) { next(err); }
});

router.post('/:id/similarity/decide', async (req, res, next) => {
  try {
    const q = await getOwned(req.params.id, req.user.id);
    if (!q) return res.status(404).json({ error: 'Question not found.' });

    const { decision } = req.body || {};
    if (!['keep', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "keep" or "reject".' });
    }

    await pool.query(
      `UPDATE similarity_results SET decision = :decision, decided_by = :uid, decided_at = NOW()
       WHERE question_id = :qid`,
      { decision, uid: req.user.id, qid: q.id }
    );

    if (decision === 'reject') {
      // Soft-reject: take the question out of circulation (and the index),
      // keep the row so AI-evaluation metrics count the rejection.
      await pool.query(
        `UPDATE questions SET status = 'rejected', similarity_flag = 'rejected', updated_at = NOW()
         WHERE id = :id`,
        { id: q.id }
      );
      await removeQuestionFromIndex(q.subject_id, q.id);
    } else {
      await pool.query(
        `UPDATE questions SET similarity_flag = 'none', updated_at = NOW() WHERE id = :id`,
        { id: q.id }
      );
    }

    res.json({ message: 'Decision recorded.', decision });
  } catch (err) { next(err); }
});

// ── Import GIFT/XML ──────────────────────────────────
router.post('/import', async (req, res, next) => {
  try {
    const { format, content, subjectId, bloom, topic } = req.body;
    if (!format || !['gift', 'xml'].includes(format)) {
      return res.status(400).json({ error: 'Format must be "gift" or "xml".' });
    }
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Content is too short to parse.' });
    }
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required.' });

    const [subjectRows] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :uid`,
      { id: subjectId, uid: req.user.id }
    );
    if (!subjectRows.length) return res.status(403).json({ error: 'Subject not found or not owned by you.' });

    let questions;
    try {
      questions = format === 'gift' ? parseGIFT(content) : parseCanvasXML(content);
    } catch (err) {
      return res.status(400).json({ error: `Failed to parse ${format.toUpperCase()}: ${err.message}` });
    }
    if (!questions?.length) return res.status(400).json({ error: `No questions could be parsed.` });

    const defaultBloom = bloom || 'remember';
    const inserted = [];
    for (const q of questions) {
      const id = uuid();
      const optionsJson = q.options ? JSON.stringify(q.options) : null;
      await pool.query(
        `INSERT INTO questions
         (id, subject_id, stem, type, options, answer, bloom, topic, status, source, created_by, created_at, updated_at)
         VALUES (:id, :subjectId, :stem, :type, :options, :answer, :bloom, :topic, 'draft', 'import', :uid, NOW(), NOW())`,
        { id, subjectId, stem: q.stem, type: q.type, options: optionsJson, answer: q.answer || '',
          bloom: q.bloom || defaultBloom, topic: q.topic || topic || null, uid: req.user.id }
      );
      inserted.push({ id, type: q.type, stem: q.stem.slice(0, 80) });

      // Imported questions get similarity-checked like manual/AI ones.
      try {
        await enqueue({
          type: 'similarity',
          payload: { questionId: id, userId: req.user.id },
          userId: req.user.id,
          subjectId,
        });
      } catch { /* non-fatal */ }
    }
    res.status(201).json({ imported: inserted.length, questions: inserted });
  } catch (err) { next(err); }
});

export default router;
