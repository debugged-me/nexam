/**
 * Phase 1 — Material text extraction handler.
 *
 * Receives a job with payload { materialId } and:
 *   1. Loads the material row.
 *   2. Extracts text based on source_type (pdf, docx, pptx, url, youtube).
 *   3. Stores extracted text in materials.content.
 *   4. Sets status='processed' or 'failed'.
 *   5. Auto-enqueues an embed job if extraction succeeded.
 */
import pool from '../../config/db.js';
import { extract } from '../../services/extractors.js';
import { enqueue } from '../../services/jobs.js';

export default async function extractHandler(job) {
  const { materialId } = job.payload;
  if (!materialId) throw new Error('materialId is required.');

  const [rows] = await pool.query(
    `SELECT * FROM materials WHERE id = :id`,
    { id: materialId }
  );
  const material = rows[0];
  if (!material) throw new Error(`Material ${materialId} not found.`);

  try {
    const text = await extract(material);

    await pool.query(
      `UPDATE materials
       SET content = :content, status = 'processed', processed_at = NOW(), error = NULL
       WHERE id = :id`,
      { id: materialId, content: text }
    );

    // Auto-enqueue embedding so the pipeline continues hands-free.
    const embedJobId = await enqueue({
      type: 'embed',
      payload: { materialId },
      userId: material.created_by,
      subjectId: material.subject_id,
    });

    return { materialId, charCount: text.length, embedJobId };
  } catch (err) {
    await pool.query(
      `UPDATE materials SET status = 'failed', error = :error WHERE id = :id`,
      { id: materialId, error: err.message }
    );
    throw err;
  }
}
