/**
 * AI status + job routes.
 *
 * GET  /api/ai/status              — which providers are configured, worker info.
 * GET  /api/ai/jobs                — recent jobs for the authenticated user.
 * GET  /api/ai/jobs/:id            — single job status (for polling).
 * GET  /api/ai/jobs/:id/stream     — live SSE feed (progress + drafts).
 * POST /api/ai/syllabus-tos        — enqueue syllabus→TOS generation.
 * POST /api/ai/generate-questions  — enqueue RAG question generation (Phase 4).
 *
 * All routes require auth (JWT). React and Flutter call these with the Bearer
 * token from /api/auth/login.
 */
import { Router } from 'express';
import { parseTimeFrame } from '../services/assessmentScope.js';
import { loadScopeChunks } from '../services/assessmentScopeStore.js';
import { generationReadiness } from '../services/generationReadiness.js';
import aiProvider from '../services/aiProvider.js';
import jobs from '../services/jobs.js';
import { pipelineStage } from '../services/pipelineStage.js';
import { queueSyllabusScan } from '../services/syllabusScan.js';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { publishJobEvent, subscribeJobEvents } from '../services/jobEvents.js';

const router = Router();

/** GET /api/ai/status — provider configuration + worker handler list. */
router.get('/status', requireAuth, async (_req, res, next) => {
  try {
    res.json({
      providers: await aiProvider.status(),
      worker: {
        pollInterval: true,
        concurrency: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai/jobs — recent jobs for the authenticated user. */
router.get('/jobs', requireAuth, async (req, res, next) => {
  try {
    const [rows, activeCount] = await Promise.all([
      jobs.recentByUser(req.user.id, 50),
      jobs.countActive(req.user.id),
    ]);
    res.json({ jobs: rows, activeCount });
  } catch (err) {
    next(err);
  }
});

/** GET /api/ai/jobs/:id — single job status (for UI polling). */
router.get('/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await jobs.getById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    // Ownership check — user can only see their own jobs.
    if (job.user_id && job.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    res.json({ job });
  } catch (err) {
    next(err);
  }
});

/** Parse a JSON column that may already be an object. */
function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

/** Draft shape sent over the stream — mirrors what the generate handler publishes. */
function streamDraft(row) {
  const meta = parseJson(row.generation_meta);
  const options = parseJson(row.options);
  return {
    id: row.id,
    type: row.type,
    stem: row.stem,
    options: Array.isArray(options) ? options : [],
    answer: row.answer,
    topic: row.topic,
    bloom: row.bloom,
    createdAt: row.created_at,
    grounding: meta?.grounding === 'knowledge' ? 'knowledge' : 'grounded',
    evidence: typeof meta?.evidence === 'string' ? meta.evidence : null,
  };
}

const TERMINAL_JOB = new Set(['done', 'failed', 'cancelled']);
const STREAM_POLL_MS = 2500;
const STREAM_PING_MS = 15000;     // well under nginx's 120s proxy_read_timeout
const MAX_STREAMS_PER_USER = 6;
const openStreams = new Map();    // userId -> open stream count

/**
 * GET /api/ai/jobs/:id/stream — Server-Sent Events feed for one job.
 *
 * Events: `state` (status/progress/result), `drafts` (questions a generate
 * run has stored, each sent once), `end` (terminal — the server closes).
 * The worker pushes through the in-process job bus; a timer re-reads the
 * row as a safety net. Clients authenticate with the normal Bearer header
 * (fetch + ReadableStream), never a query token.
 */
router.get('/jobs/:id/stream', requireAuth, async (req, res, next) => {
  const userId = req.user.id;
  let job;
  try {
    job = await jobs.getById(req.params.id);
  } catch (err) {
    return next(err);
  }
  // Strict ownership — the stream carries draft content.
  if (!job || job.user_id !== userId) return res.status(404).json({ error: 'Job not found.' });
  if ((openStreams.get(userId) || 0) >= MAX_STREAMS_PER_USER) {
    return res.status(429).json({ error: 'Too many live job streams are open. Close a tab and try again.' });
  }
  openStreams.set(userId, (openStreams.get(userId) || 0) + 1);

  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // nginx: flush each event instead of buffering
  });
  res.flushHeaders();

  const payload = parseJson(job.payload) || {};
  const sentDrafts = new Set();
  let lastState = '';
  let lastDraftKey = '';
  let closed = false;
  let syncing = false;

  const send = (event, data) => {
    if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const pushDrafts = (items) => {
    const fresh = (items || []).filter((d) => d?.id && !sentDrafts.has(d.id));
    fresh.forEach((d) => sentDrafts.add(d.id));
    if (fresh.length) send('drafts', { items: fresh });
  };

  const sendState = (row, progress = parseJson(row.progress)) => {
    const state = {
      status: row.status,
      progress,
      error: row.error || null,
      result: TERMINAL_JOB.has(row.status) ? parseJson(row.result) : null,
    };
    const key = JSON.stringify(state);
    if (key !== lastState) { lastState = key; send('state', state); }
  };

  // Drafts this run already stored — a late open or a reconnect still sees
  // everything, not just what arrives after it connected.
  const loadDrafts = async (row) => {
    if (row.type !== 'generate' || !payload.tosId || !row.started_at) return;
    const [rows] = await pool.query(
      `SELECT id, type, stem, options, answer, topic, bloom, generation_meta, created_at
       FROM questions
       WHERE tos_id = :tosId AND created_by = :uid AND source = 'ai'
         AND (JSON_UNQUOTE(JSON_EXTRACT(generation_meta, '$.jobId')) = :jobId
           OR (JSON_EXTRACT(generation_meta, '$.jobId') IS NULL AND created_at >= :since
             AND (:until IS NULL OR created_at <= :until)))
       ORDER BY created_at ASC
       LIMIT 500`,
      { tosId: payload.tosId, uid: userId, jobId: row.id, since: row.started_at, until: row.finished_at || null }
    );
    pushDrafts(rows.map(streamDraft));
  };

  let timer = null;
  let ping = null;
  let unsubscribe = () => {};
  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    clearInterval(ping);
    unsubscribe();
    openStreams.set(userId, Math.max(0, (openStreams.get(userId) || 1) - 1));
    if (!openStreams.get(userId)) openStreams.delete(userId);
    res.end();
  };

  const sync = async () => {
    if (closed || syncing) return;
    syncing = true;
    try {
      const row = await jobs.getById(job.id);
      if (!row) { send('end', { status: 'missing' }); finish(); return; }
      job = row;
      // Re-query drafts only when the row moved (a slot finished or the
      // status changed) — the bus normally delivers them first anyway.
      const draftKey = `${row.status}|${typeof row.progress === 'string' ? row.progress : JSON.stringify(row.progress)}`;
      if (draftKey !== lastDraftKey) {
        lastDraftKey = draftKey;
        await loadDrafts(row);
      }
      sendState(row);
      if (TERMINAL_JOB.has(row.status)) { send('end', { status: row.status }); finish(); }
    } catch (err) {
      console.error(`[ai] job stream ${job.id} sync failed:`, err.message);
    } finally {
      syncing = false;
    }
  };

  unsubscribe = subscribeJobEvents(job.id, (event) => {
    if (event.kind === 'drafts') pushDrafts(event.items);
    else if (event.kind === 'progress') sendState({ ...job, status: 'running' }, event.progress);
    else sync();
  });
  req.on('close', finish);
  timer = setInterval(sync, STREAM_POLL_MS);
  ping = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, STREAM_PING_MS);
  sync();
});

/**
 * POST /api/ai/jobs/:id/cancel — stop a queued or running job.
 * Queued jobs are never claimed (the worker only takes status='queued'); a
 * running job flips to 'cancelled' and cooperative handlers stop at their
 * next checkpoint, keeping whatever they already produced.
 */
router.post('/jobs/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    const job = await jobs.getById(req.params.id);
    if (!job || (job.user_id && job.user_id !== req.user.id)) {
      return res.status(404).json({ error: 'Job not found.' });
    }
    if (job.status !== 'queued' && job.status !== 'running') {
      return res.status(409).json({
        error: `This task is already ${job.status === 'done' ? 'finished' : job.status}.`,
      });
    }
    const [r] = await pool.query(
      `UPDATE ai_jobs SET status = 'cancelled', progress = NULL, finished_at = NOW()
       WHERE id = :id AND status IN ('queued', 'running')`,
      { id: job.id }
    );
    publishJobEvent(job.id, { kind: 'status' });
    res.json({ cancelled: r.affectedRows > 0, status: 'cancelled' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/syllabus-tos — enqueue syllabus→TOS auto-generation. */
router.post('/syllabus-tos', requireAuth, rateLimit({ name: 'ai-syllabus', max: 6, windowSec: 300 }), async (req, res, next) => {
  try {
    let { materialId, tosId } = req.body;
    let assessmentScope;
    try { assessmentScope = req.body.assessmentScope ? parseTimeFrame(req.body.assessmentScope) : null; }
    catch (err) { return res.status(422).json({ error: err.message }); }

    // When tosId is given, extracted topics fill that draft blueprint instead
    // of creating a new one. Verify ownership + draft state + same subject.
    let tos = null;
    if (tosId) {
      const [tosRows] = await pool.query(
        `SELECT t.id, t.subject_id, t.status FROM tos t
         JOIN subjects s ON s.id = t.subject_id
         WHERE t.id = :id AND s.instructor_id = :uid`,
        { id: tosId, uid: req.user.id }
      );
      if (!tosRows.length) return res.status(404).json({ error: 'TOS not found.' });
      tos = tosRows[0];
      if (tos.status === 'finalized') {
        return res.status(409).json({ error: 'This TOS is finalized and locked.' });
      }
    }

    // No materialId? Default to the subject's most recent processed syllabus.
    if (!materialId && tos) {
      const [mrows] = await pool.query(
        `SELECT id FROM materials
         WHERE subject_id = :sid AND created_by = :uid AND is_syllabus = 1 AND status = 'processed'
         ORDER BY created_at DESC LIMIT 1`,
        { sid: tos.subject_id, uid: req.user.id }
      );
      materialId = mrows[0]?.id || null;
    }
    if (!materialId) return res.status(400).json({ error: 'materialId is required.' });

    // Ownership check — the material must belong to the user.
    const [rows] = await pool.query(
      `SELECT id, subject_id, is_syllabus, status FROM materials WHERE id = :id AND created_by = :userId`,
      { id: materialId, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });
    const m = rows[0];
    if (!m.is_syllabus) return res.status(400).json({ error: 'This material is not marked as a syllabus.' });
    if (m.status !== 'processed') return res.status(400).json({ error: `Syllabus must be processed first (current: ${m.status}).` });
    if (tos && m.subject_id !== tos.subject_id) {
      return res.status(422).json({ error: 'The syllabus belongs to a different subject than this blueprint.' });
    }

    const scan = await queueSyllabusScan({ materialId, userId: req.user.id, tosId: tos?.id || null, assessmentScope });
    res.status(scan.status === 'done' ? 200 : 202).json(scan);
  } catch (err) {
    next(err);
  }
});

/** POST /api/ai/generate-questions — enqueue RAG question generation (Phase 4). */
router.post('/generate-questions', requireAuth, rateLimit({ name: 'ai-generate', max: 10, windowSec: 300 }), async (req, res, next) => {
  try {
    const { tosId } = req.body;
    if (!tosId) return res.status(400).json({ error: 'tosId is required.' });

    // Ownership check — the TOS must belong to a subject owned by the user.
    const [rows] = await pool.query(
      `SELECT t.id, t.subject_id, t.status, t.assessment_scope, t.scope_key
       FROM tos t
       JOIN subjects s ON s.id = t.subject_id
       WHERE t.id = :tosId AND s.instructor_id = :userId`,
      { tosId, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'TOS not found or not owned by you.' });
    if (rows[0].status !== 'finalized') {
      return res.status(409).json({
        error: 'Finalize the TOS after reviewing its topics, hours, outcomes, and Bloom distribution before generating questions.',
      });
    }
    let scopedChunks;
    try { scopedChunks = await loadScopeChunks(rows[0], req.user.id); }
    catch (err) { return res.status(422).json({ error: err.message }); }
    const readiness = await generationReadiness(rows[0], req.user.id, scopedChunks);
    if (!readiness.ready) {
      return res.status(422).json({
        error: 'Upload processed supporting lesson materials before generating questions. The syllabus plans the blueprint but is not answer evidence.',
        code: readiness.code,
        readiness,
        action: {
          label: 'Upload supporting lessons',
          href: `/materials?upload=1&subject_id=${encodeURIComponent(rows[0].subject_id)}`,
        },
      });
    }

    // A second run for the same blueprint only makes a parallel batch of
    // duplicates. Generating a different blueprint at the same time is fine —
    // the worker runs jobs concurrently.
    if (await jobs.hasActiveJob('generate', (p) => p?.tosId === tosId)) {
      return res.status(409).json({
        error: 'A generation run for this blueprint is already in progress — watch Background work while it finishes.',
      });
    }

    const jobId = await jobs.enqueue({
      type: 'generate',
      payload: { tosId, userId: req.user.id },
      userId: req.user.id,
      subjectId: rows[0].subject_id,
    });

    res.status(202).json({ jobId, status: 'queued' });
  } catch (err) {
    next(err);
  }
});

export default router;

/**
 * GET /api/ai/pipeline/:subjectId — aggregated pipeline status for the wizard.
 * Returns the state of each stage: syllabus upload → extract → embed → TOS →
 * question generation → approval → exam.
 */
router.get('/pipeline/:subjectId', requireAuth, async (req, res, next) => {
  try {
    const { subjectId } = req.params;

    // Ownership check
    const [subj] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :userId`,
      { id: subjectId, userId: req.user.id }
    );
    if (!subj.length) return res.status(404).json({ error: 'Subject not found.' });

    // 1. Syllabus material
    const [syllabusRows] = await pool.query(
      `SELECT id, title, status, source_type, chunk_count, is_syllabus,
              created_at, error
       FROM materials
       WHERE subject_id = :id AND is_syllabus = 1
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const syllabus = syllabusRows[0] || null;

    // 2. Recent jobs for this subject (extract, embed, syllabus_tos, generate)
    const [jobRows] = await pool.query(
      `SELECT id, type, status, error, created_at, started_at, finished_at, result,
              JSON_UNQUOTE(JSON_EXTRACT(payload, '$.materialId')) AS material_id
       FROM ai_jobs
       WHERE subject_id = :id
       ORDER BY created_at DESC
       LIMIT 20`,
      { id: subjectId }
    );

    // Find the latest job of each type
    const latestJob = (type) => jobRows.find((j) => j.type === type) || null;
    const extractJob = latestJob('extract');
    const embedJob = latestJob('embed');
    const tosJob = latestJob('syllabus_tos');
    const generateJob = latestJob('generate');

    // 3. TOS created from this subject
    const [tosRows] = await pool.query(
      `SELECT id, title, total_items, status, finalized_at, created_at
       FROM tos WHERE subject_id = :id
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const tos = tosRows[0] || null;

    // 4. Questions for this subject
    const [qStats] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS approved,
         SUM(CASE WHEN similarity_flag = 'rejected' THEN 1 ELSE 0 END) AS rejected
       FROM questions WHERE subject_id = :id`,
      { id: subjectId }
    );
    const questionStats = qStats[0] || { total: 0, draft: 0, approved: 0, rejected: 0 };

    // 5. Exams for this subject
    const [examRows] = await pool.query(
      `SELECT id, title, status, created_at
       FROM exams WHERE subject_id = :id
       ORDER BY created_at DESC LIMIT 1`,
      { id: subjectId }
    );
    const exam = examRows[0] || null;

    const stage = pipelineStage({ syllabus, embedJob, tosJob, generateJob, tos, questionStats });

    // Show instructors a friendly error, never raw provider JSON.
    const friendly = (j) => (j && j.error
      ? { ...j, error: jobs.friendlyJobError(j.error, j.finished_at || j.started_at || j.created_at) }
      : j);

    res.json({
      subjectId,
      stage,
      syllabus: friendly(syllabus),
      jobs: {
        extract: friendly(extractJob),
        embed: friendly(embedJob),
        tos: friendly(tosJob),
        generate: friendly(generateJob),
      },
      tos,
      questions: {
        total: Number(questionStats.total),
        draft: Number(questionStats.draft),
        approved: Number(questionStats.approved),
        rejected: Number(questionStats.rejected),
      },
      exam,
    });
  } catch (err) {
    next(err);
  }
});
