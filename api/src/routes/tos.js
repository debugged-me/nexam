/**
 * TOS (Table of Specifications) API routes — CRUD + topics + Bloom weights.
 *
 *   GET    /api/tos                 — list (filterable by subject_id)
 *   POST   /api/tos                 — create
 *   GET    /api/tos/:id              — single (with topics)
 *   PUT    /api/tos/:id              — update
 *   DELETE /api/tos/:id              — delete
 *   POST   /api/tos/:id/topics       — add topic
 *   PUT    /api/tos/:id/topics/:topicId — update topic
 *   DELETE /api/tos/:id/topics/:topicId — delete topic
 *   POST   /api/tos/bulk-delete      — delete many
 *
 * TOS ownership is derived via subject_id → subjects.instructor_id.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = Router();
router.use(requireAuth);

const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const DEFAULT_BLOOM = { remember: 15, understand: 20, apply: 20, analyze: 20, evaluate: 15, create: 10 };

/** Load a TOS and verify ownership via subject join. */
async function getOwned(id, userId) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tos t JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = :id AND s.instructor_id = :uid LIMIT 1`,
    { id, uid: userId }
  );
  return rows[0] || null;
}

/**
 * Recalculate tos_topics.item_count from instructional_hours —
 * item allocation is proportional to hours (largest remainder so the
 * counts sum exactly to tos.total_items). Runs after any topic
 * add/update/delete or total_items change.
 */
async function recalcTopicItemCounts(tosId) {
  const [tosRows] = await pool.query(
    `SELECT total_items FROM tos WHERE id = :id`, { id: tosId }
  );
  if (!tosRows.length) return;
  const totalItems = Number(tosRows[0].total_items) || 0;

  const [topics] = await pool.query(
    `SELECT id, instructional_hours FROM tos_topics WHERE tos_id = :id ORDER BY sort_order ASC`,
    { id: tosId }
  );
  if (!topics.length) return;

  // Clamp at 0 so a stray negative hour can never produce a negative item_count.
  const hoursOf = (t) => Math.max(0, Number(t.instructional_hours) || 0);
  const totalHours = topics.reduce((s, t) => s + hoursOf(t), 0);
  const counts = {};
  const remainders = [];
  let allocated = 0;

  for (const t of topics) {
    // No hours recorded yet (every topic defaults to 0) — an even split beats a divide-by-zero NaN.
    const share = totalHours > 0 ? hoursOf(t) / totalHours : 1 / topics.length;
    const exact = share * totalItems;
    const whole = Math.floor(exact);
    counts[t.id] = whole;
    remainders.push({ id: t.id, remainder: exact - whole });
    allocated += whole;
  }
  remainders.sort((a, b) => b.remainder - a.remainder);
  for (const { id } of remainders) {
    if (allocated >= totalItems) break;
    counts[id]++;
    allocated++;
  }

  for (const t of topics) {
    await pool.query(
      `UPDATE tos_topics SET item_count = :n WHERE id = :id`,
      { n: counts[t.id], id: t.id }
    );
  }
}

/** Normalize learning_outcomes input (array | JSON string | text) to JSON. */
function normalizeOutcomes(value) {
  if (value == null || value === '') return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'string') {
    try { JSON.parse(value); return value; } catch { return JSON.stringify([value]); }
  }
  return null;
}

/** Validate TOS fields. Returns { error } or { ok }. */
function validate(body) {
  const { title, subject_id, total_items, bloom_weights } = body || {};
  if (!title || !String(title).trim()) return { error: 'Title is required.' };
  if (!subject_id) return { error: 'Subject is required.' };
  if (!total_items || !Number.isInteger(Number(total_items)) || Number(total_items) <= 0) {
    return { error: 'Total items must be a positive integer.' };
  }
  if (bloom_weights) {
    const total = BLOOM_LEVELS.reduce((sum, k) => sum + (Number(bloom_weights[k]) || 0), 0);
    if (total !== 100) return { error: `Bloom weights must total 100% (currently ${total}%).` };
    for (const k of BLOOM_LEVELS) {
      const v = Number(bloom_weights[k]) || 0;
      if (v < 0 || v > 100) return { error: `Bloom weight for ${k} must be 0–100.` };
    }
  }
  return { ok: true };
}

// ── List ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { subject_id } = req.query;
    const params = { uid: req.user.id };
    const where = ['s.instructor_id = :uid'];
    if (subject_id) { where.push('t.subject_id = :subject_id'); params.subject_id = subject_id; }

    const [tosList] = await pool.query(
      `SELECT t.id, t.subject_id, t.title, t.total_items, t.bloom_weights,
              t.created_at, t.updated_at, s.name AS subject_name, s.code AS subject_code
       FROM tos t JOIN subjects s ON s.id = t.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    );

    // Parse bloom_weights JSON
    for (const t of tosList) {
      if (t.bloom_weights) {
        try { t.bloom_weights = JSON.parse(t.bloom_weights); } catch { t.bloom_weights = DEFAULT_BLOOM; }
      } else {
        t.bloom_weights = DEFAULT_BLOOM;
      }
    }

    res.json({ tos: tosList });
  } catch (err) { next(err); }
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
    const bloom = req.body.bloom_weights || DEFAULT_BLOOM;
    await pool.query(
      `INSERT INTO tos (id, subject_id, title, total_items, bloom_weights, created_at, updated_at)
       VALUES (:id, :subject_id, :title, :total_items, :bloom_weights, NOW(), NOW())`,
      {
        id,
        subject_id: req.body.subject_id,
        title: String(req.body.title).trim(),
        total_items: Number(req.body.total_items),
        bloom_weights: JSON.stringify(bloom),
      }
    );

    const [rows] = await pool.query(
      `SELECT t.*, s.name AS subject_name, s.code AS subject_code
       FROM tos t JOIN subjects s ON s.id = t.subject_id WHERE t.id = :id`,
      { id }
    );
    const tos = rows[0];
    tos.bloom_weights = JSON.parse(tos.bloom_weights);
    res.status(201).json({ tos });
  } catch (err) { next(err); }
});

// ── Single (with topics) ──────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const [topics] = await pool.query(
      `SELECT * FROM tos_topics WHERE tos_id = :id ORDER BY sort_order ASC`,
      { id: tos.id }
    );

    // Subject info
    const [subjRows] = await pool.query(
      `SELECT name, code FROM subjects WHERE id = :id`, { id: tos.subject_id }
    );
    tos.subject_name = subjRows[0]?.name;
    tos.subject_code = subjRows[0]?.code;
    tos.bloom_weights = tos.bloom_weights ? JSON.parse(tos.bloom_weights) : DEFAULT_BLOOM;

    res.json({ tos, topics });
  } catch (err) { next(err); }
});

// ── Update ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const v = validate({ ...req.body, subject_id: req.body.subject_id || tos.subject_id });
    if (v.error) return res.status(422).json({ error: v.error });

    // If subject_id changed, verify ownership of the new subject
    if (req.body.subject_id && req.body.subject_id !== tos.subject_id) {
      const [subjRows] = await pool.query(
        `SELECT id FROM subjects WHERE id = :id AND instructor_id = :uid`,
        { id: req.body.subject_id, uid: req.user.id }
      );
      if (!subjRows.length) return res.status(403).json({ error: 'Subject not owned by you.' });
    }

    const nextTotalItems = Number(req.body.total_items || tos.total_items);
    const totalItemsChanged = nextTotalItems !== Number(tos.total_items);

    const existingWeights = typeof tos.bloom_weights === 'string'
      ? JSON.parse(tos.bloom_weights || 'null') : tos.bloom_weights;
    const bloom = req.body.bloom_weights || existingWeights || DEFAULT_BLOOM;
    await pool.query(
      `UPDATE tos SET subject_id = :subject_id, title = :title, total_items = :total_items,
                     bloom_weights = :bloom_weights, updated_at = NOW() WHERE id = :id`,
      {
        id: tos.id,
        subject_id: req.body.subject_id || tos.subject_id,
        title: String(req.body.title || tos.title).trim(),
        total_items: nextTotalItems,
        bloom_weights: JSON.stringify(bloom),
      }
    );

    // Only the item budget invalidates the per-topic split — re-derive when it moves.
    if (totalItemsChanged) await recalcTopicItemCounts(tos.id);

    const [rows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: tos.id });
    rows[0].bloom_weights = JSON.parse(rows[0].bloom_weights);
    res.json({ tos: rows[0] });
  } catch (err) { next(err); }
});

// ── Delete ───────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    await pool.query(`DELETE FROM tos_topics WHERE tos_id = :id`, { id: tos.id });
    await pool.query(`DELETE FROM tos WHERE id = :id`, { id: tos.id });
    res.json({ message: 'TOS deleted.' });
  } catch (err) { next(err); }
});

// ── Bulk delete ───────────────────────────────────────
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const validIds = ids.map(String).filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    if (!validIds.length) return res.json({ deleted: 0 });

    // Re-derive ownership via subject join
    const [result] = await pool.query(
      `DELETE t FROM tos t JOIN subjects s ON s.id = t.subject_id
       WHERE t.id IN (:ids) AND s.instructor_id = :uid`,
      { ids: validIds, uid: req.user.id }
    );
    res.json({ deleted: result.affectedRows });
  } catch (err) { next(err); }
});

// ── Add topic ─────────────────────────────────────────
router.post('/:id/topics', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const { title, instructional_hours, learning_outcomes, item_count } = req.body || {};
    if (!title || !String(title).trim()) return res.status(422).json({ error: 'Topic title is required.' });

    // Determine next sort_order
    const [maxRows] = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM tos_topics WHERE tos_id = :id`,
      { id: tos.id }
    );

    const topicId = uuid();
    await pool.query(
      `INSERT INTO tos_topics (id, tos_id, title, instructional_hours, learning_outcomes, item_count, sort_order)
       VALUES (:id, :tos_id, :title, :hours, :outcomes, :item_count, :sort_order)`,
      {
        id: topicId,
        tos_id: tos.id,
        title: String(title).trim(),
        hours: Number(instructional_hours) || 0,
        outcomes: normalizeOutcomes(learning_outcomes),
        item_count: Number(item_count) || 0,
        sort_order: maxRows[0].max_order + 1,
      }
    );

    // Any item_count sent by the client is only a seed — counts are derived from
    // instructional hours, so re-read the row after the recalc normalizes it.
    await recalcTopicItemCounts(tos.id);

    const [rows] = await pool.query(`SELECT * FROM tos_topics WHERE id = :id`, { id: topicId });
    res.status(201).json({ topic: rows[0] });
  } catch (err) { next(err); }
});

// ── Update topic ──────────────────────────────────────
router.put('/:id/topics/:topicId', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const [existing] = await pool.query(
      `SELECT * FROM tos_topics WHERE id = :topicId AND tos_id = :tosId LIMIT 1`,
      { topicId: req.params.topicId, tosId: tos.id }
    );
    if (!existing.length) return res.status(404).json({ error: 'Topic not found.' });

    const { title, instructional_hours, learning_outcomes } = req.body || {};
    const sets = [];
    const params = { topicId: existing[0].id, tosId: tos.id };

    if (title !== undefined) {
      if (!String(title).trim()) return res.status(422).json({ error: 'Topic title is required.' });
      sets.push('title = :title');
      params.title = String(title).trim();
    }
    let hoursChanged = false;
    if (instructional_hours !== undefined) {
      const hours = Number(instructional_hours) || 0;
      if (hours < 0) return res.status(422).json({ error: 'Instructional hours cannot be negative.' });
      hoursChanged = hours !== Number(existing[0].instructional_hours);
      sets.push('instructional_hours = :hours');
      params.hours = hours;
    }
    if (learning_outcomes !== undefined) {
      sets.push('learning_outcomes = :outcomes');
      params.outcomes = normalizeOutcomes(learning_outcomes);
    }
    if (!sets.length) return res.status(422).json({ error: 'Nothing to update.' });

    await pool.query(
      `UPDATE tos_topics SET ${sets.join(', ')} WHERE id = :topicId AND tos_id = :tosId`,
      params
    );

    // Hours drive the proportional split — re-derive every sibling's item_count.
    if (hoursChanged) await recalcTopicItemCounts(tos.id);

    const [rows] = await pool.query(`SELECT * FROM tos_topics WHERE id = :id`, { id: existing[0].id });
    res.json({ topic: rows[0] });
  } catch (err) { next(err); }
});

// ── Delete topic ──────────────────────────────────────
router.delete('/:id/topics/:topicId', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    await pool.query(
      `DELETE FROM tos_topics WHERE id = :topicId AND tos_id = :tosId`,
      { topicId: req.params.topicId, tosId: tos.id }
    );
    await recalcTopicItemCounts(tos.id);
    res.json({ message: 'Topic removed.' });
  } catch (err) { next(err); }
});

export default router;
