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
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { generateExamPDF, generateAnswerKeyPDF, generateTOSReportPDF, STORAGE_DIR } from '../services/pdfService.js';
import { toGIFT, toCanvasXML } from '../services/lmsExport.js';
import { generateOMRSheet } from '../services/omrService.js';

const router = Router();

/** GET /api/exams — list exams for the authenticated instructor. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [exams] = await pool.query(
      `SELECT e.id, e.title, e.subject_id, s.name AS subject_name,
              e.status, e.set_count, e.format, e.duration_minutes,
              (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
              (SELECT COUNT(*) FROM exam_sets es WHERE es.exam_id = e.id) AS set_item_count
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

    // Load TOS if linked
    let tos = null;
    if (exam.tos_id) {
      const [tosRows] = await pool.query(`SELECT * FROM tos WHERE id = :id`, { id: exam.tos_id });
      tos = tosRows[0];
    }

    // Load questions already attached to this exam
    const [questions] = await pool.query(
      `SELECT q.*, eq.sort_order
       FROM exam_questions eq
       JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = :examId
       ORDER BY eq.sort_order ASC`,
      { examId }
    );

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions attached to this exam. Add questions first.' });
    }

    // Load TOS topics if TOS exists
    let topics = [];
    if (tos) {
      const [topicRows] = await pool.query(
        `SELECT * FROM tos_topics WHERE tos_id = :tosId ORDER BY sort_order ASC`,
        { tosId: tos.id }
      );
      topics = topicRows;
    }

    // Delete old sets if regenerating
    await pool.query(`DELETE FROM exam_set_questions WHERE exam_set_id IN (SELECT id FROM exam_sets WHERE exam_id = :examId)`, { examId });
    await pool.query(`DELETE FROM exam_sets WHERE exam_id = :examId`, { examId });

    const setCount = Math.min(Math.max(parseInt(req.body.setCount, 10) || exam.set_count || 1, 1), 2);
    const generatedSets = [];

    for (let setIdx = 0; setIdx < setCount; setIdx++) {
      const setLabel = String.fromCharCode(65 + setIdx); // 'A', 'B'
      const setId = uuid();

      // For Set B, shuffle the question order (parallel structure, different order)
      let setQuestions = [...questions];
      if (setIdx > 0) {
        setQuestions = shuffleQuestions(setQuestions);
      }

      // Generate exam PDF
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

      // Generate answer key PDF
      const answerKeyFilename = `answerkey_${examId}_set${setLabel}.pdf`;
      await generateAnswerKeyPDF({
        examTitle: exam.title,
        setLabel,
        questions: setQuestions,
        filename: answerKeyFilename,
      });

      // Generate OMR answer sheet
      const omrFilename = `omr_${examId}_set${setLabel}.pdf`;
      await generateOMRSheet({
        examId,
        examTitle: exam.title,
        setLabel,
        questions: setQuestions,
        filename: omrFilename,
      });

      // Store the exam set
      await pool.query(
        `INSERT INTO exam_sets (id, exam_id, set_label, pdf_path, answer_key_path, omr_sheet_path)
         VALUES (:id, :examId, :setLabel, :pdfPath, :answerKeyPath, :omrPath)`,
        {
          id: setId,
          examId,
          setLabel,
          pdfPath: examFilename,
          answerKeyPath: answerKeyFilename,
          omrPath: omrFilename,
        }
      );

      // Store set questions
      for (let i = 0; i < setQuestions.length; i++) {
        await pool.query(
          `INSERT INTO exam_set_questions (id, exam_set_id, question_id, sort_order)
           VALUES (:id, :examSetId, :questionId, :sortOrder)`,
          {
            id: uuid(),
            examSetId: setId,
            questionId: setQuestions[i].id,
            sortOrder: i + 1,
          }
        );
      }

      generatedSets.push({
        id: setId,
        setLabel,
        pdfPath: examFilename,
        answerKeyPath: answerKeyFilename,
        omrSheetPath: omrFilename,
        questionCount: setQuestions.length,
      });
    }

    // Generate TOS report if TOS is linked
    let tosReportPath = null;
    if (tos) {
      const tosReportFilename = `tos_report_${examId}.pdf`;
      const bloomWeights = JSON.parse(tos.bloom_weights || '{}');

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
      filename = `tos_report_${examId}.pdf`;
    } else if (type === 'exam' || type === 'answerkey' || type === 'omr') {
      if (!setLabel) return res.status(400).json({ error: 'Set label is required.' });
      const prefix = type === 'exam' ? 'exam' : type === 'answerkey' ? 'answerkey' : 'omr';
      filename = `${prefix}_${examId}_set${setLabel}.pdf`;
    } else {
      return res.status(400).json({ error: 'Invalid download type.' });
    }

    const filePath = `${STORAGE_DIR}/${filename}`;
    const fs = await import('fs');
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
      `SELECT e.id, e.title FROM exams e
       JOIN subjects s ON s.id = e.subject_id
       WHERE e.id = :examId AND s.instructor_id = :userId`,
      { examId, userId: req.user.id }
    );
    if (!examRows.length) return res.status(404).json({ error: 'Exam not found.' });

    // Load questions
    const [questions] = await pool.query(
      `SELECT q.* FROM exam_questions eq
       JOIN questions q ON q.id = eq.question_id
       WHERE eq.exam_id = :examId
       ORDER BY eq.sort_order ASC`,
      { examId }
    );

    if (questions.length === 0) {
      return res.status(400).json({ error: 'No questions to export.' });
    }

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
