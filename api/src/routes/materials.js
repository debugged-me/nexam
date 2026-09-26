/**
 * Materials routes — upload, list, delete, status.
 *
 * POST   /api/materials              — upload a file (multipart) or submit a URL/text
 * GET    /api/materials               — list materials for the authenticated user
 * GET    /api/materials/:id           — single material detail
 * DELETE /api/materials/:id          — delete a material (ownership-checked)
 * POST   /api/materials/:id/reprocess — re-queue a failed material for extraction
 *
 * All routes require auth (JWT). Materials are scoped to the user via
 * created_by for ownership and IDOR protection.
 */
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';
import pool from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { enqueue } from '../services/jobs.js';
import { assertSafePublicUrl } from '../services/safeUrl.js';
import { encryptFileAtRest } from '../services/storageCrypto.js';

const router = Router();

// ── Upload config ────────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.cwd(), 'upload/materials');

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Never keep the original filename — security best practice.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain',
      'text/markdown',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed. Accepted: PDF, DOCX, PPTX, TXT.`));
  },
});

// ── MIME → source_type mapping ───────────────────────────
function mimeToSourceType(mimetype, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (mimetype === 'application/pdf' || ext === '.pdf') return 'pdf';
  if (mimetype.includes('wordprocessingml') || ext === '.docx') return 'docx';
  if (mimetype.includes('presentationml') || ext === '.pptx') return 'pptx';
  if (mimetype === 'text/plain' || mimetype === 'text/markdown' || ext === '.txt' || ext === '.md') return 'text';
  return 'text';
}

/** POST /api/materials — upload a file or submit a URL/YouTube/text. */
router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const { subject_id, title, source_type: explicitType, url, content, is_syllabus } = req.body;

    if (!subject_id) return res.status(400).json({ error: 'subject_id is required.' });

    // Ownership check — the subject must belong to the user.
    const [subjects] = await pool.query(
      `SELECT id FROM subjects WHERE id = :id AND instructor_id = :userId`,
      { id: subject_id, userId: req.user.id }
    );
    if (!subjects.length) return res.status(403).json({ error: 'Subject not found or not owned by you.' });

    let sourceType = explicitType || 'file';
    let filePath = null;
    let fileSize = null;
    let mimeType = null;
    let materialUrl = url || null;
    let materialContent = content || null;
    let materialTitle = title || 'Untitled material';

    if (req.file) {
      // File upload
      sourceType = mimeToSourceType(req.file.mimetype, req.file.originalname);
      filePath = req.file.path;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
      if (!title) materialTitle = req.file.originalname.replace(/\.[^.]+$/, '');
      await encryptFileAtRest(filePath);
    } else if (url) {
      // URL or YouTube submission
      await assertSafePublicUrl(url);
      if (url.match(/(?:youtube\.com|youtu\.be)/)) {
        sourceType = 'youtube';
      } else {
        sourceType = 'url';
      }
      materialUrl = url;
    } else if (content) {
      // Raw text
      sourceType = 'text';
    } else {
      return res.status(400).json({ error: 'Provide a file, URL, or text content.' });
    }

    const id = uuid();
    await pool.query(
      `INSERT INTO materials
         (id, subject_id, created_by, title, type, source_type, content, url,
          file_path, file_size, mime_type, status, is_syllabus)
       VALUES
         (:id, :subjectId, :userId, :title, 'reference', :sourceType, :content, :url,
          :filePath, :fileSize, :mimeType, 'pending', :isSyllabus)`,
      {
        id,
        subjectId: subject_id,
        userId: req.user.id,
        title: materialTitle,
        sourceType,
        content: materialContent,
        url: materialUrl,
        filePath,
        fileSize,
        mimeType,
        isSyllabus: is_syllabus === 'true' || is_syllabus === true ? 1 : 0,
      }
    );

    // Enqueue extraction
    const jobId = await enqueue({
      type: 'extract',
      payload: { materialId: id },
      userId: req.user.id,
      subjectId: subject_id,
    });

    res.status(201).json({ id, jobId, status: 'pending', sourceType, title: materialTitle });
  } catch (err) {
    next(err);
  }
});

/** GET /api/materials — list materials for the user, optionally filtered by subject. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { subject_id } = req.query;
    const [rows] = await pool.query(
      `SELECT id, subject_id, title, source_type, status, error, chunk_count,
              is_syllabus, created_at, processed_at
       FROM materials
       WHERE created_by = :userId
       ${subject_id ? 'AND subject_id = :subjectId' : ''}
       ORDER BY created_at DESC`,
      { userId: req.user.id, subjectId: subject_id || null }
    );
    res.json({ materials: rows });
  } catch (err) {
    next(err);
  }
});

/** GET /api/materials/:id — single material detail (with extracted text preview). */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM materials WHERE id = :id AND created_by = :userId`,
      { id: req.params.id, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });
    const m = rows[0];
    // Truncate content in list view; full content only on explicit request.
    if (m.content && m.content.length > 5000) {
      m.content = m.content.slice(0, 5000) + '\n...[truncated]';
    }
    res.json({ material: m });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/materials/:id — delete material + its chunks + file. */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM materials WHERE id = :id AND created_by = :userId`,
      { id: req.params.id, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });

    const material = rows[0];
    // Delete the uploaded file if it exists
    if (material.file_path) {
      try { await fs.unlink(material.file_path); } catch { /* file may already be gone */ }
    }
    // DB cascade deletes material_chunks
    await pool.query(`DELETE FROM materials WHERE id = :id`, { id: req.params.id });
    res.json({ message: 'Material deleted.' });
  } catch (err) {
    next(err);
  }
});

/** POST /api/materials/:id/reprocess — re-queue a failed material. */
router.post('/:id/reprocess', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM materials WHERE id = :id AND created_by = :userId`,
      { id: req.params.id, userId: req.user.id }
    );
    if (!rows.length) return res.status(404).json({ error: 'Material not found.' });

    await pool.query(
      `UPDATE materials SET status = 'pending', error = NULL WHERE id = :id`,
      { id: req.params.id }
    );

    const jobId = await enqueue({
      type: 'extract',
      payload: { materialId: req.params.id },
      userId: req.user.id,
      subjectId: rows[0].subject_id,
    });

    res.json({ jobId, status: 'pending' });
  } catch (err) {
    next(err);
  }
});

export default router;
