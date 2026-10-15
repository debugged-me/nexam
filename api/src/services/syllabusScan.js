import pool from '../config/db.js';
import { enqueue } from './jobs.js';
import { readJson, parseTimeFrame } from './assessmentScope.js';
import { sourceHash } from './syllabusBlueprint.js';

const sameFrame = (a, b) => JSON.stringify(a ? parseTimeFrame(a) : null) === JSON.stringify(b ? parseTimeFrame(b) : null);

// Upload chaining and manual scans share the same material lock. A second
// click returns the running scan or its existing blueprint, without another
// provider call. Deleted results and changed source text can be scanned again.
export async function queueSyllabusScan({ materialId, userId, tosId = null, assessmentScope = null }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[material]] = await conn.query(
      `SELECT m.* FROM materials m JOIN subjects s ON s.id = m.subject_id
       WHERE m.id = :id AND m.created_by = :uid AND s.instructor_id = :uid FOR UPDATE`,
      { id: materialId, uid: userId });
    if (!material || !material.is_syllabus || material.status !== 'processed') throw new Error('A processed syllabus owned by this instructor is required.');
    const contentHash = sourceHash(material.content);
    const [previous] = await conn.query(
      `SELECT id, status, payload, result FROM ai_jobs WHERE type = 'syllabus_tos' AND user_id = :uid
       AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.materialId')) = :id
       AND status IN ('queued', 'running', 'done') ORDER BY created_at DESC`,
      { id: materialId, uid: userId });
    for (const job of previous) {
      const payload = readJson(job.payload, {});
      if ((payload.tosId || null) !== tosId || !sameFrame(payload.assessmentScope, assessmentScope)) continue;
      if (payload.contentHash && payload.contentHash !== contentHash) continue;
      if (job.status !== 'done') {
        await conn.commit();
        return { jobId: job.id, status: job.status, reused: true };
      }
      const result = readJson(job.result, {});
      if (!result.tosId) continue;
      const [[blueprint]] = await conn.query(`SELECT id, source_meta FROM tos WHERE id = :id AND subject_id = :sid`, { id: result.tosId, sid: material.subject_id });
      const meta = readJson(blueprint?.source_meta, {});
      if (blueprint && meta.materialId === materialId && meta.contentHash === contentHash) {
        await conn.commit();
        return { jobId: job.id, tosId: blueprint.id, status: 'done', reused: true };
      }
    }
    const jobId = await enqueue({ type: 'syllabus_tos', payload: { materialId, userId, tosId, assessmentScope, contentHash }, userId, subjectId: material.subject_id }, conn);
    await conn.commit();
    return { jobId, status: 'queued', reused: false };
  } catch (err) { await conn.rollback(); throw err; }
  finally { conn.release(); }
}
