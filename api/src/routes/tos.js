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
import { recalcTopicItemCounts } from '../services/tosTopics.js';
import { buildTosMatrix } from '../services/tosAlignment.js';
import { usableQuestions } from '../services/questionGrounding.js';
import { blueprintCoverage } from '../services/tosCoverage.js';
import { logAudit } from '../services/audit.js';
import { parseTimeFrame, validateSources, scopeKey, questionScopeSql } from '../services/assessmentScope.js';
import { sourceHash } from '../services/syllabusBlueprint.js';
import { readJson } from '../services/assessmentScope.js';
import { loadScopeChunks, ownedChunks } from '../services/assessmentScopeStore.js';
import {
  BLOOM_LEVELS,
  DEFAULT_OBJECTIVE_BLOOM,
  objectiveCreateBlockReason,
} from '../services/objectiveBlueprint.js';

const router = Router();
router.use(requireAuth);

const DEFAULT_BLOOM = DEFAULT_OBJECTIVE_BLOOM;

function requireDraft(tos, res) {
  if (tos.status === 'finalized') {
    res.status(409).json({ error: 'This TOS is finalized and locked. Create a new draft to make structural changes.' });
    return false;
  }
  return true;
}

/** Load a TOS and verify ownership via subject join. */
async function getOwned(id, userId) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tos t JOIN subjects s ON s.id = t.subject_id
     WHERE t.id = :id AND s.instructor_id = :uid LIMIT 1`,
    { id, uid: userId }
  );
  return rows[0] || null;
}

// recalcTopicItemCounts moved to services/tosTopics.js (imported above) so
// worker handlers can share it without a routes↔worker circular import.

/**
 * Parse instructional hours strictly. `Number(x) || 0` silently coerced 'abc'
 * or '3 hrs' to 0, which both loses the instructor's input behind a success
 * response and skews every sibling topic's item_count, since the split is a
 * share of the total hours. Returns { error } instead of guessing.
 */
function parseHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0 || hours > 10000 || Math.abs(hours * 100 - Math.round(hours * 100)) > 0.00001) {
    return { error: 'Instructional hours must be 0–10,000 with at most two decimal places.' };
  }
  return { hours };
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
              t.status, t.finalized_by, t.finalized_at,
              t.created_at, t.updated_at, s.name AS subject_name, s.code AS subject_code,
              (SELECT COUNT(*) FROM tos_topics tt WHERE tt.tos_id = t.id) AS topic_count
       FROM tos t JOIN subjects s ON s.id = t.subject_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    );

    // Items of each plan already banked, counted per topic × Bloom cell (a
    // surplus in one cell never covers another) — the "N of M banked" the
    // list shows, and the same figure the Generate button works from.
    const coverage = await blueprintCoverage(req.user.id, tosList);
    // Exams assembled from each blueprint, so the list can say what is next.
    const [examRows] = await pool.query(
      `SELECT e.tos_id, COUNT(*) AS n, SUM(e.status = 'published') AS published
       FROM exams e
       WHERE e.created_by = :uid AND e.tos_id IS NOT NULL
       GROUP BY e.tos_id`,
      { uid: req.user.id }
    );
    const examsByTos = new Map(examRows.map((r) => [r.tos_id, r]));
    for (const t of tosList) {
      const cov = coverage.get(t.id);
      t.banked = cov?.covered || 0;
      t.missing = cov ? cov.missing : Number(t.total_items) || 0;
      t.ready = cov?.ready || 0;
      t.exam_count = Number(examsByTos.get(t.id)?.n) || 0;
      t.published_count = Number(examsByTos.get(t.id)?.published) || 0;
    }

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

    // Per-cell question coverage — same matching rules as the generation
    // worker: live = not rejected, not similarity-rejected, linked via tos_id
    // or question_tos. Keyed "topic||bloom" so the matrix can show have/need.
    const [covCandidates] = await pool.query(
      `SELECT q.*
       FROM questions q
       WHERE q.subject_id = :subjectId AND q.created_by = :userId
         AND q.status <> 'rejected'
         AND (q.similarity_flag IS NULL OR q.similarity_flag <> 'rejected')
         AND ${questionScopeSql()}
         AND (q.tos_id = :tosId OR EXISTS (
           SELECT 1 FROM question_tos qt WHERE qt.question_id = q.id AND qt.tos_id = :tosId
         ))
       `,
      { subjectId: tos.subject_id, userId: req.user.id, tosId: tos.id }
    );
    const covRows = await usableQuestions(covCandidates);
    const coverage = {};
    for (const r of covRows) {
      const key = `${r.topic}||${r.bloom}`;
      const cell = coverage[key] || (coverage[key] = { live: 0, approved: 0 });
      cell.live += 1;
      // Same rule as exam assembly (ELIGIBLE_FOR_CELL in routes/exams.js).
      if (r.status === 'active' && r.similarity_flag === 'none' && r.similarity_checked_at && !r.similarity_error) cell.approved += 1;
    }

    // Usage — exams assembled from this blueprint and sheets scanned on
    // them, so the detail rail can show the full lifecycle without a
    // second request.
    const [usageRows] = await pool.query(
      `SELECT COUNT(DISTINCT e.id) AS exams, COUNT(sr.id) AS scans
       FROM exams e
       LEFT JOIN scan_results sr ON sr.exam_id = e.id
       WHERE e.tos_id = :id AND e.created_by = :uid`,
      { id: tos.id, uid: req.user.id }
    );
    const usage = { exams: Number(usageRows[0]?.exams) || 0, scans: Number(usageRows[0]?.scans) || 0 };

    // The exact topic × Bloom plan generation and assembly use, per topic id,
    // so the page draws the server matrix instead of re-deriving it (its own
    // rounding once disagreed by a few items). Null while the topic counts
    // don't yet add up to the total; the page then previews its own split.
    let plan = null;
    try {
      const { rows } = buildTosMatrix(topics, tos.bloom_weights, Number(tos.total_items));
      plan = Object.fromEntries(topics.map((t, i) => [t.id, rows[i]]));
    } catch { plan = null; }

    res.json({ tos, topics, coverage, usage, plan });
  } catch (err) { next(err); }
});

// Source text is private: both the blueprint and every material are owned.
router.get('/:id/scope-materials', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    const [materials] = await pool.query(
      `SELECT m.id, m.title, m.is_syllabus, m.chunk_count FROM materials m
       WHERE m.subject_id = :sid AND m.created_by = :uid AND m.status = 'processed'
       ORDER BY m.is_syllabus ASC, m.title ASC`,
      { sid: tos.subject_id, uid: req.user.id }
    );
    const materialId = req.query.materialId;
    let chunks = [];
    if (materialId) {
      if (!materials.some((m) => m.id === materialId)) return res.status(404).json({ error: 'Material not found.' });
      [chunks] = await pool.query(
        `SELECT id, ordinal, text FROM material_chunks
         WHERE material_id = :mid AND subject_id = :sid ORDER BY ordinal`,
        { mid: materialId, sid: tos.subject_id }
      );
    }
    res.json({ materials, chunks });
  } catch (err) { next(err); }
});

router.put('/:id/assessment-scope', async (req, res, next) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[tos]] = await conn.query(
      `SELECT t.* FROM tos t JOIN subjects s ON s.id = t.subject_id
       WHERE t.id = :id AND s.instructor_id = :uid FOR UPDATE`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!tos) { await conn.rollback(); return res.status(404).json({ error: 'TOS not found.' }); }
    if (tos.status !== 'draft') { await conn.rollback(); return res.status(409).json({ error: 'Finalized coverage is locked. Create a new blueprint to change it.' }); }
    const scope = parseTimeFrame(req.body);
    if (!scope.label) throw new Error('Name the assessment, for example Prelim or Selected units.');
    if (req.body.confirmed !== true) throw new Error('Confirm the selected topics and passages belong to this assessment.');
    const [topics] = await conn.query(`SELECT id FROM tos_topics WHERE tos_id = :id`, { id: tos.id });
    const selected = req.body.topicIds;
    if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length
      || selected.some((id) => !topics.some((t) => t.id === id))) throw new Error('Select topics from this blueprint.');
    const sources = req.body.sources;
    if (!Array.isArray(sources) || sources.length > 100) throw new Error('Select up to 100 supporting passages.');
    const chunks = await ownedChunks(tos.subject_id, req.user.id, sources.map((s) => s?.chunkId).filter(Boolean), conn);
    scope.sources = validateSources(sources, chunks);
    scope.confirmed = true;
    scope.confirmedBy = req.user.id;
    scope.confirmedAt = new Date().toISOString();
    const sourceMeta = readJson(tos.source_meta);
    if (sourceMeta && selected.length < topics.length) {
      sourceMeta.courseHours = null;
      sourceMeta.warnings = [...new Set([...(sourceMeta.warnings || []), 'Coverage contains selected topics. Confirm hours for this subset.'])];
      await conn.query(`UPDATE tos SET source_meta = :meta WHERE id = :id`, { meta: JSON.stringify(sourceMeta), id: tos.id });
    }
    await conn.query(`DELETE FROM tos_topics WHERE tos_id = :id AND id NOT IN (:selected)`, { id: tos.id, selected });
    await conn.query(
      `UPDATE tos SET assessment_scope = :scope, scope_key = :key, updated_at = NOW() WHERE id = :id`,
      { scope: JSON.stringify(scope), key: scopeKey(scope), id: tos.id }
    );
    await recalcTopicItemCounts(tos.id, conn);
    await conn.commit();
    res.json({ message: 'Assessment coverage saved.' });
  } catch (err) {
    if (conn) await conn.rollback();
    if (!err.code) return res.status(422).json({ error: err.message });
    next(err);
  } finally { conn?.release(); }
});

// ── Topic suggestions ────────────────────────────────
// Topics the instructor already has — from the subject's question bank and
// from sibling blueprints (the PRELIM blueprint's topics reuse well for
// MIDTERM). One-click fills the topics table; hours default to 3.
router.get('/:id/topic-suggestions', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const [existing] = await pool.query(
      `SELECT LOWER(TRIM(title)) AS t FROM tos_topics WHERE tos_id = :id`, { id: tos.id }
    );
    const taken = new Set(existing.map((r) => r.t));

    // Bank-derived: topics this subject's questions already use, with counts.
    const [bankRows] = await pool.query(
      `SELECT q.topic AS title, COUNT(*) AS question_count
       FROM questions q
       WHERE q.subject_id = :sid AND q.created_by = :uid
         AND q.topic IS NOT NULL AND q.topic != ''
       GROUP BY q.topic ORDER BY question_count DESC LIMIT 30`,
      { sid: tos.subject_id, uid: req.user.id }
    );
    const bank = bankRows
      .filter((r) => !taken.has(String(r.title).trim().toLowerCase()))
      .map((r) => ({ title: r.title, question_count: Number(r.question_count) }));

    // Blueprint-derived: topics from other TOS in the same subject, copied
    // with their hours + outcomes intact.
    const [sibRows] = await pool.query(
      `SELECT tt.title, tt.instructional_hours, tt.learning_outcomes, t.title AS blueprint_title
       FROM tos_topics tt JOIN tos t ON t.id = tt.tos_id
       WHERE t.subject_id = :sid AND t.id != :tid
       ORDER BY t.created_at DESC, tt.sort_order ASC`,
      { sid: tos.subject_id, tid: tos.id }
    );
    const seen = new Set(taken);
    const blueprints = [];
    for (const r of sibRows) {
      const key = String(r.title).trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      blueprints.push({
        title: r.title,
        instructional_hours: Number(r.instructional_hours) || 0,
        learning_outcomes: r.learning_outcomes,
        blueprint_title: r.blueprint_title,
      });
    }

    // Whether a processed syllabus exists for auto-fill (hides the button
    // up front instead of failing on click).
    const [sylRows] = await pool.query(
      `SELECT id FROM materials
       WHERE subject_id = :sid AND created_by = :uid AND is_syllabus = 1 AND status = 'processed'
       ORDER BY created_at DESC LIMIT 1`,
      { sid: tos.subject_id, uid: req.user.id }
    );

    res.json({ bank, blueprints, hasSyllabus: sylRows.length > 0 });
  } catch (err) { next(err); }
});

// ── Update ───────────────────────────────────────────
router.put('/:id', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (!requireDraft(tos, res)) return;

    const v = validate({ ...req.body, subject_id: req.body.subject_id || tos.subject_id });
    if (v.error) return res.status(422).json({ error: v.error });

    // If subject_id changed, verify ownership of the new subject
    if (req.body.subject_id && req.body.subject_id !== tos.subject_id) {
      if (tos.assessment_scope) return res.status(409).json({ error: 'Create a new blueprint to change the subject of an assessment with selected sources.' });
      const [subjRows] = await pool.query(
        `SELECT id FROM subjects WHERE id = :id AND instructor_id = :uid`,
        { id: req.body.subject_id, uid: req.user.id }
      );
      if (!subjRows.length) return res.status(403).json({ error: 'Subject not owned by you.' });
    }

    const nextTotalItems = Number(req.body.total_items || tos.total_items);

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

    // Unconditional: saving a blueprint is the self-heal for per-topic counts the syllabus
    // worker left non-proportional (syllabus_tos.js floors the last topic at 1).
    // Gating it on a total_items change would silently drop that repair.
    await recalcTopicItemCounts(tos.id);

    const [rows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: tos.id });
    rows[0].bloom_weights = JSON.parse(rows[0].bloom_weights);
    res.json({ tos: rows[0] });
  } catch (err) { next(err); }
});

// ── Finalize ──────────────────────────────────────────
router.post('/:id/finalize', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (tos.status === 'finalized') return res.json({ tos, message: 'TOS is already finalized.' });

    try { await loadScopeChunks(tos, req.user.id); }
    catch (err) { return res.status(422).json({ error: err.message }); }

    await recalcTopicItemCounts(tos.id);
    const [topics] = await pool.query(
      `SELECT id, title, instructional_hours, learning_outcomes, item_count
       FROM tos_topics WHERE tos_id = :id ORDER BY sort_order ASC`,
      { id: tos.id }
    );
    if (!topics.length) return res.status(422).json({ error: 'Add at least one topic before finalizing the TOS.' });
    if (topics.some((t) => Number(t.instructional_hours) <= 0)) {
      return res.status(422).json({ error: 'Every topic needs a positive number of instructional hours.' });
    }
    const sourceMeta = readJson(tos.source_meta);
    if (sourceMeta) {
      if (req.body?.confirmAssumptions !== true) return res.status(422).json({ error: 'Confirm the syllabus topics, proposed hours, item count and Bloom allocation before finalizing.' });
      const [[material]] = await pool.query(`SELECT content FROM materials WHERE id = :id AND subject_id = :sid AND created_by = :uid`, { id: sourceMeta.materialId, sid: tos.subject_id, uid: req.user.id });
      if (!material || sourceHash(material.content) !== sourceMeta.contentHash) return res.status(422).json({ error: 'The source syllabus changed or was removed. Scan the current syllabus before finalizing.' });
      const sum = topics.reduce((n, t) => n + Number(t.instructional_hours), 0);
      if (sourceMeta.courseHours && Math.abs(sum - sourceMeta.courseHours.value) > 0.005) return res.status(422).json({ error: `Topic hours must total the ${sourceMeta.courseHours.value} hours stated in the syllabus (currently ${sum.toFixed(2)}). Derive a separate blueprint for a subset of the course.` });
    }
    const normalizedTitles = topics.map((topic) => String(topic.title).trim().toLowerCase());
    if (new Set(normalizedTitles).size !== normalizedTitles.length) {
      return res.status(422).json({ error: 'Topic titles must be unique before the TOS can be finalized.' });
    }
    const allocated = topics.reduce((sum, t) => sum + Number(t.item_count || 0), 0);
    if (allocated !== Number(tos.total_items)) {
      return res.status(422).json({ error: `Topic allocations total ${allocated}, but the TOS requires ${tos.total_items}.` });
    }
    const weights = typeof tos.bloom_weights === 'string'
      ? JSON.parse(tos.bloom_weights || '{}') : (tos.bloom_weights || {});
    const weightTotal = BLOOM_LEVELS.reduce((sum, level) => sum + Number(weights[level] || 0), 0);
    if (Math.abs(weightTotal - 100) > 0.001) {
      return res.status(422).json({ error: 'Bloom taxonomy weights must total exactly 100%.' });
    }
    const createBlock = objectiveCreateBlockReason(weights);
    if (createBlock) return res.status(422).json({ error: createBlock });

    const [finalized] = await pool.query(
      `UPDATE tos SET status = 'finalized', finalized_by = :uid,
                      finalized_at = NOW(), updated_at = NOW()
       WHERE id = :id AND status = 'draft' AND scope_key <=> :scopeKey`,
      { id: tos.id, uid: req.user.id, scopeKey: tos.scope_key || null }
    );
    if (!finalized.affectedRows) return res.status(409).json({ error: 'Blueprint coverage changed. Reload and review it before finalizing.' });
    const [rows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: tos.id });
    rows[0].bloom_weights = JSON.parse(rows[0].bloom_weights || '{}');
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'tos.finalize', targetType: 'tos', targetId: tos.id, ip: req.ip,
    });
    res.json({ tos: rows[0], message: 'TOS finalized. Question generation is now enabled.' });
  } catch (err) { next(err); }
});

// ── Derive a new draft blueprint from selected topics ─
// Copies the subject, item total and Bloom weights; copies only the chosen
// topic rows. Used for per-period blueprints (Prelim, Midterm, Finals).
router.post('/:id/derive', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    const topicIds = Array.isArray(req.body?.topicIds) ? req.body.topicIds.map(String) : [];
    if (!topicIds.length) return res.status(422).json({ error: 'Select at least one topic.' });

    const [topics] = await pool.query(
      `SELECT id, title, instructional_hours, learning_outcomes, sort_order, schedule
       FROM tos_topics WHERE tos_id = :id AND id IN (:topicIds) ORDER BY sort_order ASC`,
      { id: tos.id, topicIds }
    );
    if (!topics.length) return res.status(422).json({ error: 'Selected topics not found in this blueprint.' });

    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(422).json({ error: 'A title is required for the new blueprint.' });
    if (title.length > 255) return res.status(422).json({ error: 'Title is too long.' });

    let frame;
    try { frame = parseTimeFrame(req.body.assessmentScope || { label: title.slice(0, 100) }); }
    catch (err) { return res.status(422).json({ error: err.message }); }

    const parentSource = readJson(tos.source_meta);
    const derivedSource = parentSource ? { ...parentSource, courseHours: null, parentTosId: tos.id, warnings: [...new Set([...(parentSource.warnings || []), 'This blueprint contains selected topics. Confirm hours for this subset.'])] } : null;
    const newId = uuid();
    await pool.query(
      `INSERT INTO tos (id, subject_id, title, total_items, bloom_weights, assessment_scope, source_meta, created_at, updated_at)
       VALUES (:id, :subjectId, :title, :totalItems, :weights, :scope, :sourceMeta, NOW(), NOW())`,
      {
        id: newId,
        sourceMeta: derivedSource ? JSON.stringify(derivedSource) : null,
        scope: JSON.stringify({ ...frame, sources: [], confirmed: false }),
        subjectId: tos.subject_id,
        title,
        totalItems: Number(tos.total_items),
        weights: typeof tos.bloom_weights === 'string' ? tos.bloom_weights : JSON.stringify(tos.bloom_weights || {}),
      }
    );

    let order = 0;
    for (const topic of topics) {
      order += 1;
      await pool.query(
        `INSERT INTO tos_topics (id, tos_id, title, instructional_hours, learning_outcomes, item_count, sort_order, schedule)
         VALUES (:id, :tosId, :title, :hours, :outcomes, 0, :order, :schedule)`,
        {
          id: uuid(), tosId: newId, schedule: topic.schedule || null,
          title: topic.title,
          hours: Number(topic.instructional_hours) || 0,
          outcomes: typeof topic.learning_outcomes === 'string'
            ? topic.learning_outcomes
            : JSON.stringify(topic.learning_outcomes || []),
          order,
        }
      );
    }
    await recalcTopicItemCounts(newId);

    const [rows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: newId });
    const derived = rows[0];
    if (derived?.bloom_weights && typeof derived.bloom_weights === 'string') {
      derived.bloom_weights = JSON.parse(derived.bloom_weights);
    }
    res.status(201).json({ tos: derived, topicsCopied: topics.length });
  } catch (err) { next(err); }
});

// ── Bulk delete topics (draft only) ───────────────────
router.post('/:id/topics/bulk-delete', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (!requireDraft(tos, res)) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length) return res.json({ deleted: 0 });
    const [result] = await pool.query(
      `DELETE FROM tos_topics WHERE tos_id = :id AND id IN (:ids)`,
      { id: tos.id, ids }
    );
    await recalcTopicItemCounts(tos.id);
    res.json({ deleted: result.affectedRows });
  } catch (err) { next(err); }
});

// ── Delete ───────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });

    // Finalized blueprints stay deletable only when nothing references them.
    // With zero linked exams/questions they're dead weight; with links they
    // remain the audit anchor those records point back to.
    if (tos.status === 'finalized') {
      const [refs] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM exams e WHERE e.tos_id = :id) AS exams,
           (SELECT COUNT(*) FROM questions q WHERE q.tos_id = :id AND q.status <> 'rejected') +
           (SELECT COUNT(*) FROM question_tos qt WHERE qt.tos_id = :id) AS questions`,
        { id: tos.id }
      );
      const nExams = Number(refs[0]?.exams) || 0;
      const nQuestions = Number(refs[0]?.questions) || 0;
      if (nExams || nQuestions) {
        const parts = [];
        if (nExams) parts.push(`${nExams} exam${nExams === 1 ? '' : 's'}`);
        if (nQuestions) parts.push(`${nQuestions} question link${nQuestions === 1 ? '' : 's'}`);
        return res.status(409).json({
          error: `This finalized blueprint still has ${parts.join(' and ')} pointing at it — delete those first, or keep the blueprint for records.`,
        });
      }
    }

    await pool.query(`DELETE FROM tos_topics WHERE tos_id = :id`, { id: tos.id });
    await pool.query(`DELETE FROM tos WHERE id = :id`, { id: tos.id });
    logAudit({
      actorId: req.user.id, actorEmail: req.user.email,
      action: 'tos.delete', targetType: 'tos', targetId: tos.id, ip: req.ip,
    });
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
       WHERE t.id IN (:ids) AND s.instructor_id = :uid AND t.status = 'draft'`,
      { ids: validIds, uid: req.user.id }
    );
    if (result.affectedRows > 0) {
      logAudit({
        actorId: req.user.id, actorEmail: req.user.email,
        action: 'tos.bulk_delete', targetType: 'tos',
        detail: { deleted: result.affectedRows, requested: validIds.length }, ip: req.ip,
      });
    }
    res.json({ deleted: result.affectedRows });
  } catch (err) { next(err); }
});

// ── Add topic ─────────────────────────────────────────
router.post('/:id/topics', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (!requireDraft(tos, res)) return;

    const { title, instructional_hours, learning_outcomes, item_count } = req.body || {};
    if (!title || !String(title).trim()) return res.status(422).json({ error: 'Topic title is required.' });
    // Validated the same way as PUT below — the two topic routes must agree.
    const parsedHours = instructional_hours === undefined ? { hours: 0 } : parseHours(instructional_hours);
    if (parsedHours.error) return res.status(422).json({ error: parsedHours.error });

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
        hours: parsedHours.hours,
        outcomes: normalizeOutcomes(learning_outcomes),
        item_count: Number(item_count) || 0,
        sort_order: maxRows[0].max_order + 1,
      }
    );

    await pool.query(`UPDATE tos SET scope_key = NULL WHERE id = :id AND assessment_scope IS NOT NULL`, { id: tos.id });

    // Any item_count sent by the client is only a seed — counts are derived from
    // instructional hours, so re-read the row after the recalc normalizes it.
    await recalcTopicItemCounts(tos.id);

    const [rows] = await pool.query(`SELECT * FROM tos_topics WHERE id = :id`, { id: topicId });
    res.status(201).json({ topic: rows[0] });
  } catch (err) { next(err); }
});

// ── Reorder topics (draft only) ───────────────────────
// Must be registered before PUT /:id/topics/:topicId — "reorder" would
// otherwise be captured as a topicId.
router.put('/:id/topics/reorder', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (!requireDraft(tos, res)) return;

    const { orderedIds } = req.body || {};
    const [owned] = await pool.query(
      `SELECT id FROM tos_topics WHERE tos_id = :id`, { id: tos.id }
    );
    const valid = new Set(owned.map((r) => r.id));
    if (!Array.isArray(orderedIds)
      || orderedIds.length !== valid.size
      || orderedIds.some((id) => !valid.has(id))) {
      return res.status(422).json({ error: 'orderedIds must contain every topic id exactly once.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < orderedIds.length; i++) {
        await conn.query(
          `UPDATE tos_topics SET sort_order = :ord WHERE id = :tid AND tos_id = :tosId`,
          { ord: i + 1, tid: orderedIds[i], tosId: tos.id }
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.json({ message: 'Topic order updated.' });
  } catch (err) { next(err); }
});

// ── Update topic ──────────────────────────────────────
router.put('/:id/topics/:topicId', async (req, res, next) => {
  try {
    const tos = await getOwned(req.params.id, req.user.id);
    if (!tos) return res.status(404).json({ error: 'TOS not found.' });
    if (!requireDraft(tos, res)) return;

    const [existing] = await pool.query(
      `SELECT * FROM tos_topics WHERE id = :topicId AND tos_id = :tosId LIMIT 1`,
      { topicId: req.params.topicId, tosId: tos.id }
    );
    if (!existing.length) return res.status(404).json({ error: 'Topic not found.' });

    const { title, instructional_hours, learning_outcomes } = req.body || {};
    const sets = [];
    const params = { topicId: existing[0].id, tosId: tos.id };

    if (title !== undefined) {
      if (title === null || !String(title).trim()) return res.status(422).json({ error: 'Topic title is required.' });
      sets.push('title = :title');
      params.title = String(title).trim();
    }
    let hoursChanged = false;
    if (instructional_hours !== undefined) {
      const parsed = parseHours(instructional_hours);
      if (parsed.error) return res.status(422).json({ error: parsed.error });
      const { hours } = parsed;
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

    await pool.query(`UPDATE tos SET scope_key = NULL WHERE id = :id AND assessment_scope IS NOT NULL`, { id: tos.id });

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
    if (!requireDraft(tos, res)) return;

    await pool.query(
      `DELETE FROM tos_topics WHERE id = :topicId AND tos_id = :tosId`,
      { topicId: req.params.topicId, tosId: tos.id }
    );
    await recalcTopicItemCounts(tos.id);
    res.json({ message: 'Topic removed.' });
  } catch (err) { next(err); }
});

export default router;
