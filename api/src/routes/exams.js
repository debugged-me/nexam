/**
 * Exam generation routes — Set A/Set B, answer keys, TOS reports, PDFs.
 *
 * GET  /api/exams                     — list exams for the authenticated instructor
 * POST /api/exams/:id/generate-sets   — generate Set A and Set B PDFs
 * GET  /api/exams/:id/sets            — list generated sets
 * GET  /api/exams/:id/download/:type  — download a PDF (exam, answerkey, omr, tos-report)
 * GET  /api/exams/:id/export/:format  — export questions as GIFT or XML
 *
 * All routes require auth (JWT). Ownership is checked against
 * subjects.instructor_id == req.user.id.
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateExamPDF, generateAnswerKeyPDF, generateTOSReportPDF, STORAGE_DIR } from '../services/pdfService.js';
import { toGIFT, toCanvasXML } from '../services/lmsExport.js';
import { generateOMRSheet } from '../services/omrService.js';
import { buildTosMatrix, validateAlignedQuestions } from '../services/tosAlignment.js';

const router = Router();

const EXAM_FORMATS = ['print', 'digital'];
const EXAM_STATUSES = ['draft', 'published'];

const SUPPORTED_QUESTION_TYPES = ['mcq', 'true_false', 'matching', 'identification'];

async function planQuestionsForTos(tos, userId) {
  const [topics] = await pool.query(
    `SELECT * FROM tos_topics WHERE tos_id = :tosId ORDER BY sort_order ASC`,
    { tosId: tos.id }
  );
  const weights = typeof tos.bloom_weights === 'string'
    ? JSON.parse(tos.bloom_weights || '{}') : tos.bloom_weights;
  const { slots } = buildTosMatrix(topics, weights, Number(tos.total_items));
  const questions = [];
  const shortages = [];

  for (const slot of slots) {
    const [rows] = await pool.query(
      `SELECT q.* FROM questions q
       WHERE q.subject_id = :subjectId AND q.created_by = :userId
         AND q.status = 'active' AND q.type IN ('mcq','true_false','matching','identification')
         AND q.similarity_checked_at IS NOT NULL AND q.similarity_error IS NULL
         AND q.similarity_flag = 'none'
         AND q.topic = :topic AND q.bloom = :bloom
         AND (q.tos_id = :tosId OR EXISTS (
           SELECT 1 FROM question_tos qt WHERE qt.question_id = q.id AND qt.tos_id = :tosId
         ))
       ORDER BY RAND() LIMIT :needed`,
      {
        subjectId: tos.subject_id, userId, topic: slot.topic,
        bloom: slot.bloom, tosId: tos.id, needed: slot.count,
      }
    );
    if (rows.length !== slot.count) {
      shortages.push({ topic: slot.topic, bloom: slot.bloom, needed: slot.count, available: rows.length });
    }
    questions.push(...rows);
  }
  return { topics, weights, questions, shortages };
}

function circulationError(question) {
  if (question.status !== 'active') return 'contains a question that is not approved';
  if (!SUPPORTED_QUESTION_TYPES.includes(question.type)) return 'contains an unsupported question type';
  if (!question.similarity_checked_at || question.similarity_error || question.similarity_flag !== 'none') {
    return 'contains a question that has not passed similarity review';
  }
  return null;
}

async function validateExamAlignment(exam, questions) {
  if (!exam.tos_id) return { error: 'A finalized TOS blueprint is required.' };
  const [tosRows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: exam.tos_id });
  const tos = tosRows[0];
  if (!tos || tos.status !== 'finalized') return { error: 'The linked TOS must be finalized.' };

  const invalid = questions.flatMap((question) => {
    const reason = circulationError(question)
      || (!question.linked_to_tos && question.tos_id !== exam.tos_id
        ? 'is not linked to this exam TOS' : null);
    return reason ? [{ id: question.id, reason }] : [];
  });
  if (invalid.length) return { error: 'The exam contains questions that cannot circulate.', invalid };

  const [topics] = await pool.query(
    `SELECT * FROM tos_topics WHERE tos_id = :tosId ORDER BY sort_order ASC`,
    { tosId: tos.id }
  );
  let weights;
  try {
    weights = typeof tos.bloom_weights === 'string'
      ? JSON.parse(tos.bloom_weights || '{}') : tos.bloom_weights;
  } catch {
    return { error: 'The linked TOS has invalid Bloom weights.' };
  }
  try {
    const alignment = validateAlignedQuestions(questions, topics, weights, Number(tos.total_items));
    if (!alignment.ok) {
      return {
        error: 'The exam does not exactly match every TOS topic and Bloom allocation.',
        ...alignment,
      };
    }
  } catch (error) {
    return { error: error.message };
  }
  return { tos, topics, weights };
}

async function loadExamQuestions(examId, tosId) {
  const [questions] = await pool.query(
    `SELECT q.*, eq.sort_order,
            EXISTS(SELECT 1 FROM question_tos qt
                   WHERE qt.question_id = q.id AND qt.tos_id = :tosId) AS linked_to_tos
     FROM exam_questions eq
     JOIN questions q ON q.id = eq.question_id
     WHERE eq.exam_id = :examId
     ORDER BY eq.sort_order ASC`,
    { examId, tosId }
  );
  return questions;
}

/** GET /api/exams — list exams for the authenticated instructor. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [exams] = await pool.query(
      `SELECT e.id, e.title, e.subject_id, e.tos_id, s.name AS subject_name, s.code AS subject_code,
              e.status, e.set_count, e.format, e.duration_minutes, e.instructions,
              (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
              (SELECT COUNT(*) FROM exam_sets es WHERE es.exam_id = e.id) AS set_count_generated,
              e.created_at, e.updated_at
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE s.instructor_id = :userId
       ORDER BY e.created_at DESC`,
      { userId: req.user.id }
    );
    res.json({ exams });
  } catch (err) {
    next(err);
  }
});

/** POST /api/exams — create a new exam. */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, subject_id, tos_id, format, duration_minutes, instructions, status } = req.body || {};
    if (!title || !String(title).trim()) return res.status(422).json({ error: 'Title is required.' });
    if (!subject_id) return res.status(422).json({ error: 'Subject is required.' });
    if (!tos_id) return res.status(422).json({ error: 'A finalized TOS blueprint is required to build an exam.' });
    if (format !== undefined && !EXAM_FORMATS.includes(format)) {
      return res.status(422).json({ error: `Format must be one of: ${EXAM_FORMATS.join(', ')}.` });
    }
    if (status !== undefined && !EXAM_STATUSES.includes(status)) {
      return res.status(422).json({ error: `Status must be one of: ${EXAM_STATUSES.join(', ')}.` });
    }
    if (duration_minutes !== undefined && duration_minutes !== null &&
        (!Number.isInteger(Number(duration_minutes)) || Number(duration_minutes) <= 0 || Number(duration_minutes) > 600)) {
      return res.status(422).json({ error: 'Duration must be a positive integer (max 600 minutes).' });
    }

    // Verify subject ownership
    const [subjRows] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :uid`,
      { id: subject_id, uid: req.user.id }
    );
    if (!subjRows.length) return res.status(403).json({ error: 'Subject not found or not owned by you.' });

    // Verify TOS ownership if provided — and that it belongs to this subject
    let tos = null;
    if (tos_id) {
      const [tosRows] = await pool.query(
        `SELECT t.* FROM tos t JOIN subjects s ON s.id = t.subject_id
         WHERE t.id = :id AND s.instructor_id = :uid`,
        { id: tos_id, uid: req.user.id }
      );
      if (!tosRows.length) return res.status(403).json({ error: 'TOS not found or not owned by you.' });
      tos = tosRows[0];
      if (tos.subject_id !== subject_id) {
        return res.status(422).json({ error: 'The TOS blueprint must belong to the selected subject.' });
      }
      if (tos.status !== 'finalized') {
        return res.status(409).json({ error: 'Finalize the TOS before building an exam.' });
      }
    }

    const plan = await planQuestionsForTos(tos, req.user.id);
    if (plan.shortages.length) {
      return res.status(409).json({
        error: 'Not enough approved, similarity-cleared questions to satisfy every TOS topic and Bloom cell.',
        shortages: plan.shortages,
      });
    }

    const id = uuid();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO exams (id, subject_id, tos_id, title, format, set_count, duration_minutes, instructions, status, created_by, created_at, updated_at)
         VALUES (:id, :subject_id, :tos_id, :title, :format, 2, :duration_minutes, :instructions, :status, :uid, NOW(), NOW())`,
        {
          id, subject_id, tos_id, title: String(title).trim(), format: format || 'print',
          duration_minutes: duration_minutes || null, instructions: instructions || null,
          status: status || 'draft', uid: req.user.id,
        }
      );
      for (let i = 0; i < plan.questions.length; i++) {
        await conn.query(
          `INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (:eid, :qid, :ord)`,
          { eid: id, qid: plan.questions[i].id, ord: i + 1 }
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const [rows] = await pool.query(
      `SELECT e.*, s.name AS subject_name, s.code AS subject_code
       FROM exams e JOIN subjects s ON s.id = e.subject_id WHERE e.id = :id`,
      { id }
    );
    res.status(201).json({ exam: rows[0], shortages: [] });
  } catch (err) { next(err); }
});

/** GET /api/exams/:id — single exam with questions. */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [examRows] = await pool.query(
      `SELECT e.*, s.name AS subject_name, s.code AS subject_code
       FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :id AND s.instructor_id = :uid`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });
    const exam = examRows[0];

    const [questions] = await pool.query(
      `SELECT q.id, q.type, q.stem, q.options, q.answer, q.bloom, q.topic, q.status, eq.sort_order
       FROM exam_questions eq JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = :id ORDER BY eq.sort_order ASC`,
      { id: exam.id }
    );
    for (const q of questions) {
      if (q.options) { try { q.options = JSON.parse(q.options); } catch { q.options = []; } }
    }

    // Load TOS if linked
    let tos = null;
    if (exam.tos_id) {
      const [tosRows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: exam.tos_id });
      tos = tosRows[0];
      if (tos?.bloom_weights) { try { tos.bloom_weights = JSON.parse(tos.bloom_weights); } catch {} }
    }

    // Generated sets — the frontend uses this to decide whether to show
    // the Downloads section on load (not only right after generation).
    const [sets] = await pool.query(
      `SELECT id, set_label, pdf_path, answer_key_path, omr_sheet_path
       FROM exam_sets WHERE exam_id = :id ORDER BY set_label ASC`,
      { id: exam.id }
    );

    res.json({ exam, questions, tos, sets });
  } catch (err) { next(err); }
});

/** PUT /api/exams/:id — update exam. */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const [examRows] = await pool.query(
      `SELECT e.* FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :id AND s.instructor_id = :uid`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });
    const exam = examRows[0];

    const { title, format, duration_minutes, instructions, status } = req.body || {};
    if (format !== undefined && !EXAM_FORMATS.includes(format)) {
      return res.status(422).json({ error: `Format must be one of: ${EXAM_FORMATS.join(', ')}.` });
    }
    if (status !== undefined && !EXAM_STATUSES.includes(status)) {
      return res.status(422).json({ error: `Status must be one of: ${EXAM_STATUSES.join(', ')}.` });
    }
    if (duration_minutes !== undefined && duration_minutes !== null &&
        (!Number.isInteger(Number(duration_minutes)) || Number(duration_minutes) <= 0 || Number(duration_minutes) > 600)) {
      return res.status(422).json({ error: 'Duration must be a positive integer (max 600 minutes).' });
    }

    // Publishing guard: only a complete, finalized, review-cleared TOS exam may circulate.
    if (status === 'published') {
      const questions = await loadExamQuestions(exam.id, exam.tos_id);
      if (!questions.length) return res.status(422).json({ error: 'Cannot publish an exam with no questions.' });
      const alignment = await validateExamAlignment(exam, questions);
      if (alignment.error) return res.status(409).json(alignment);
    }

    await pool.query(
      `UPDATE exams SET title = :title, format = :format, set_count = :set_count,
                       duration_minutes = :duration_minutes, instructions = :instructions,
                       status = :status, updated_at = NOW() WHERE id = :id`,
      {
        id: exam.id,
        title: title ? String(title).trim() : exam.title,
        format: format || exam.format,
        set_count: 2,
        duration_minutes: duration_minutes !== undefined ? duration_minutes : exam.duration_minutes,
        instructions: instructions !== undefined ? instructions : exam.instructions,
        status: status || exam.status,
      }
    );
    const [rows] = await pool.query(`SELECT * FROM exams WHERE id = :id`, { id: exam.id });
    res.json({ exam: rows[0] });
  } catch (err) { next(err); }
});

/** DELETE /api/exams/:id — delete exam. */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :id AND s.instructor_id = :uid`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    await pool.query(`DELETE FROM exam_set_questions WHERE exam_set_id IN (SELECT id FROM exam_sets WHERE exam_id = :id)`, { id: req.params.id });
    await pool.query(`DELETE FROM exam_sets WHERE exam_id = :id`, { id: req.params.id });
    await pool.query(`DELETE FROM exam_questions WHERE exam_id = :id`, { id: req.params.id });
    await pool.query(`DELETE FROM exams WHERE id = :id`, { id: req.params.id });
    res.json({ message: 'Exam deleted.' });
  } catch (err) { next(err); }
});

/** POST /api/exams/:id/questions — attach questions to exam. */
router.post('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const [examRows] = await pool.query(
      `SELECT e.* FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :id AND s.instructor_id = :uid`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });
    const exam = examRows[0];

    const { question_ids } = req.body || {};
    if (!Array.isArray(question_ids) || !question_ids.length) {
      return res.status(400).json({ error: 'question_ids array is required.' });
    }

    // Verify all questions are owned by the user and are active
    const validIds = question_ids.map(String).filter((id) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    );
    if (!validIds.length) return res.status(400).json({ error: 'No valid question IDs.' });

    const [ownedRows] = await pool.query(
      `SELECT q.id FROM questions q
       WHERE q.id IN (:ids) AND q.created_by = :uid AND q.subject_id = :subjectId
         AND q.status = 'active' AND q.type IN ('mcq','true_false','matching','identification')
         AND q.similarity_checked_at IS NOT NULL AND q.similarity_error IS NULL
         AND q.similarity_flag = 'none'
         AND (q.tos_id = :tosId OR EXISTS (
           SELECT 1 FROM question_tos qt WHERE qt.question_id = q.id AND qt.tos_id = :tosId
         ))`,
      { ids: validIds, uid: req.user.id, subjectId: exam.subject_id, tosId: exam.tos_id }
    );
    const ownedIds = ownedRows.map((r) => r.id);

    // Get current max sort_order
    const [maxRows] = await pool.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM exam_questions WHERE exam_id = :id`,
      { id: exam.id }
    );
    let sortOrder = maxRows[0].max_order;

    // Remove existing attachments for these questions (avoid duplicates)
    await pool.query(
      `DELETE FROM exam_questions WHERE exam_id = :id AND question_id IN (:ids)`,
      { id: exam.id, ids: ownedIds }
    );

    let added = 0;
    for (const qid of ownedIds) {
      sortOrder++;
      await pool.query(
        `INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (:exam_id, :qid, :sort_order)`,
        { exam_id: exam.id, qid, sort_order: sortOrder }
      );
      added++;
    }

    res.status(201).json({ added, skipped: validIds.length - ownedIds.length });
  } catch (err) { next(err); }
});

/** DELETE /api/exams/:id/questions/:questionId — remove a question from exam. */
router.delete('/:id/questions/:questionId', requireAuth, async (req, res, next) => {
  try {
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :id AND s.instructor_id = :uid`,
      { id: req.params.id, uid: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    await pool.query(
      `DELETE FROM exam_questions WHERE exam_id = :id AND question_id = :qid`,
      { id: req.params.id, qid: req.params.questionId }
    );
    res.json({ message: 'Question removed from exam.' });
  } catch (err) { next(err); }
});

/** POST /api/exams/:id/generate-sets — generate Set A and Set B PDFs. */
router.post('/:id/generate-sets', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.id;

    // Load exam with ownership check
    const [examRows] = await pool.query(
      `SELECT e.*, s.name AS subject_name, s.code AS subject_code,
              s.instructor_id
       FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    const exam = examRows[0];
    if (!exam) return res.status(404).json({ error: 'Exam not found.' });

    // Load questions already attached to this exam
    const questions = await loadExamQuestions(examId, exam.tos_id);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions attached to this exam. Add questions first.' });
    }

    const alignment = await validateExamAlignment(exam, questions);
    if (alignment.error) return res.status(409).json(alignment);
    const { tos, topics, weights: bloomWeights } = alignment;
    const setCount = 2;

    // Phase 1: generate all PDF files first (slow, can't be rolled back — so
    // do it before opening the DB transaction). If PDF generation fails, no
    // DB rows were touched.
    const setPlans = [];
    for (let setIdx = 0; setIdx < setCount; setIdx++) {
      const setLabel = String.fromCharCode(65 + setIdx); // 'A', 'B'
      const setId = uuid();

      // For Set B, shuffle the question order (parallel structure, different order)
      let setQuestions = [...questions];
      if (setIdx > 0) {
        setQuestions = shuffleQuestions(setQuestions);
      }

      const examFilename = `exam_${examId}_set${setLabel}.pdf`;
      await generateExamPDF({
        examTitle: exam.title,
        subjectName: exam.subject_name,
        subjectCode: exam.subject_code,
        setLabel,
        durationMinutes: exam.duration_minutes,
        instructions: exam.instructions,
        questions: setQuestions,
        filename: examFilename,
      });

      const answerKeyFilename = `answerkey_${examId}_set${setLabel}.pdf`;
      await generateAnswerKeyPDF({
        examTitle: exam.title,
        setLabel,
        questions: setQuestions,
        filename: answerKeyFilename,
      });

      const omrFilename = `omr_${examId}_set${setLabel}.pdf`;
      await generateOMRSheet({
        examId,
        examSetId: setId,
        examTitle: exam.title,
        setLabel,
        questions: setQuestions,
        filename: omrFilename,
      });

      setPlans.push({ setId, setLabel, setQuestions, examFilename, answerKeyFilename, omrFilename });
    }

    // Phase 2: replace sets + set questions atomically.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `DELETE FROM exam_set_questions WHERE exam_set_id IN (SELECT id FROM exam_sets WHERE exam_id = ?)`,
        [examId]
      );
      await conn.query(`DELETE FROM exam_sets WHERE exam_id = ?`, [examId]);

      for (const plan of setPlans) {
        await conn.query(
          `INSERT INTO exam_sets (id, exam_id, set_label, pdf_path, answer_key_path, omr_sheet_path)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [plan.setId, examId, plan.setLabel, plan.examFilename, plan.answerKeyFilename, plan.omrFilename]
        );

        for (let i = 0; i < plan.setQuestions.length; i++) {
          await conn.query(
            `INSERT INTO exam_set_questions (id, exam_set_id, question_id, sort_order) VALUES (?, ?, ?, ?)`,
            [uuid(), plan.setId, plan.setQuestions[i].id, i + 1]
          );
        }
      }

      await conn.query(`UPDATE exams SET set_count = 2, updated_at = NOW() WHERE id = ?`, [examId]);

      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }

    const generatedSets = setPlans.map((p) => ({
      id: p.setId,
      setLabel: p.setLabel,
      pdfPath: p.examFilename,
      answerKeyPath: p.answerKeyFilename,
      omrSheetPath: p.omrFilename,
      questionCount: p.setQuestions.length,
    }));

    // Generate TOS report if TOS is linked
    let tosReportPath = null;
    if (tos) {
      const tosReportFilename = `tos_report_${examId}.pdf`;
      // Compute actual distribution from the exam questions
      const actualDist = {};
      for (const q of questions) {
        actualDist[q.bloom] = (actualDist[q.bloom] || 0) + 1;
      }
      const actualDistribution = Object.keys(bloomWeights).map((bloom) => ({
        bloom,
        planned: Math.round((bloomWeights[bloom] || 0) / 100 * tos.total_items),
        actual: actualDist[bloom] || 0,
      }));

      await generateTOSReportPDF({
        examTitle: exam.title,
        tos: { ...tos, bloom_weights: bloomWeights },
        topics,
        actualDistribution,
        filename: tosReportFilename,
      });
      tosReportPath = tosReportFilename;
    }

    res.status(201).json({
      examId,
      sets: generatedSets,
      tosReportPath,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/exams/:id/sets — list generated sets for an exam. */
router.get('/:id/sets', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.id;

    // Ownership check
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    const [sets] = await pool.query(
      `SELECT es.*, 
              (SELECT COUNT(*) FROM exam_set_questions esq WHERE esq.exam_set_id = es.id) AS question_count
       FROM exam_sets es
       WHERE es.exam_id = :examId
       ORDER BY es.set_label ASC`,
      { examId }
    );

    res.json({ sets });
  } catch (err) {
    next(err);
  }
});

/** GET /api/exams/:id/download/:type/:set — download a PDF. */
router.get('/:id/download/:type', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.id;
    const type = req.params.type; // 'exam', 'answerkey', 'tos-report'
    const setLabel = req.query.set; // 'A', 'B' — required for exam/answerkey

    // Ownership check
    const [examRows] = await pool.query(
      `SELECT e.id FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    let filename;
    if (type === 'tos-report') {
      const [sets] = await pool.query(`SELECT COUNT(*) AS cnt FROM exam_sets WHERE exam_id = :examId`, { examId });
      if (Number(sets[0].cnt) !== 2) {
        return res.status(404).json({ error: 'Generate the current Set A and Set B before downloading this report.' });
      }
      filename = `tos_report_${examId}.pdf`;
    } else if (type === 'exam' || type === 'answerkey' || type === 'omr') {
      if (!setLabel || !['A', 'B'].includes(setLabel)) {
        return res.status(400).json({ error: 'Set label A or B is required.' });
      }
      const column = type === 'exam' ? 'pdf_path' : type === 'answerkey' ? 'answer_key_path' : 'omr_sheet_path';
      const [sets] = await pool.query(
        `SELECT ${column} AS filename FROM exam_sets WHERE exam_id = :examId AND set_label = :setLabel`,
        { examId, setLabel }
      );
      if (!sets.length || !sets[0].filename) {
        return res.status(404).json({ error: 'File not found. Generate the current exam sets first.' });
      }
      filename = path.basename(sets[0].filename);
    } else {
      return res.status(400).json({ error: 'Invalid download type.' });
    }

    const filePath = path.join(STORAGE_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found. Generate the exam sets first.' });
    }

    res.download(filePath, filename);
  } catch (err) {
    next(err);
  }
});

/** Shuffle questions for Set B (parallel structure, different order). */
function shuffleQuestions(questions) {
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** GET /api/exams/:id/export/:format — export questions as GIFT or XML. */
router.get('/:id/export/:format', requireAuth, async (req, res, next) => {
  try {
    const examId = req.params.id;
    const format = req.params.format; // 'gift' or 'xml'

    // Ownership check
    const [examRows] = await pool.query(
      `SELECT e.* FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    // Load questions
    const questions = await loadExamQuestions(examId, examRows[0].tos_id);

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions to export.' });
    }
    const alignment = await validateExamAlignment(examRows[0], questions);
    if (alignment.error) return res.status(409).json(alignment);

    let content, contentType, filename;

    if (format === 'gift') {
      content = toGIFT(questions);
      contentType = 'text/plain; charset=utf-8';
      filename = `${examRows[0].title.replace(/[^a-z0-9]/gi, '_')}.gift`;
    } else if (format === 'xml') {
      content = toCanvasXML(questions);
      contentType = 'application/xml; charset=utf-8';
      filename = `${examRows[0].title.replace(/[^a-z0-9]/gi, '_')}.xml`;
    } else {
      return res.status(400).json({ error: 'Invalid format. Use "gift" or "xml".' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (err) {
    next(err);
  }
});

export default router;
