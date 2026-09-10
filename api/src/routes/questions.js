/**
 * Question routes — import GIFT/XML, bulk operations.
 *
 * Routes:
 *   POST /api/questions/import  — parse GIFT or XML text, create draft questions
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { parseGIFT, parseCanvasXML } from '../services/lmsExport.js';

const router = Router();

/**
 * POST /api/questions/import
 * Body: { format: 'gift'|'xml', content: string, subjectId: string, bloom?: string, topic?: string }
 *
 * Parses the provided GIFT or QTI XML text and creates draft questions in the
 * question bank. Questions are created with status='draft' and source='import'
 * so the instructor reviews them before they enter the active bank.
 */
router.post('/import', requireAuth, async (req, res, next) => {
  try {
    const { format, content, subjectId, bloom, topic } = req.body;

    if (!format || !['gift', 'xml'].includes(format)) {
      return res.status(400).json({ error: 'Format must be "gift" or "xml".' });
    }
    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Content is too short to parse.' });
    }
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required.' });
    }

    // Ownership check — the subject must belong to the user
    const [subjectRows] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :userId`,
      { id: subjectId, userId: req.user.id }
    );
    if (subjectRows.length === 0) {
      return res.status(403).json({ error: 'Subject not found or not owned by you.' });
    }

    // Parse the content
    let questions;
    try {
      questions = format === 'gift'
        ? parseGIFT(content)
        : parseCanvasXML(content);
    } catch (err) {
      return res.status(400).json({ error: `Failed to parse ${format.toUpperCase()}: ${err.message}` });
    }

    if (!questions || questions.length === 0) {
      return res.status(400).json({ error: `No questions could be parsed from the ${format.toUpperCase()} content.` });
    }

    // Insert questions into the database
    const defaultBloom = bloom || 'remember';
    const inserted = [];

    for (const q of questions) {
      const id = uuid();
      const optionsJson = q.options ? JSON.stringify(q.options) : null;

      await pool.query(
        `INSERT INTO questions
         (id, subject_id, stem, type, options, answer, bloom, topic, status, source, created_by, created_at, updated_at)
         VALUES (:id, :subjectId, :stem, :type, :options, :answer, :bloom, :topic, 'draft', 'import', :userId, NOW(), NOW())`,
        {
          id,
          subjectId,
          stem: q.stem,
          type: q.type,
          options: optionsJson,
          answer: q.answer || '',
          bloom: q.bloom || defaultBloom,
          topic: q.topic || topic || null,
          userId: req.user.id,
        }
      );

      inserted.push({ id, type: q.type, stem: q.stem.slice(0, 80) });
    }

    res.status(201).json({
      imported: inserted.length,
      questions: inserted,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
