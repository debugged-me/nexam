import pool from '../config/db.js';
import { readJson, validateSources, scopeKey } from './assessmentScope.js';

export async function loadScopeChunks(tos, userId, db = pool) {
  const scope = readJson(tos.assessment_scope);
  if (!tos.assessment_scope) return null;
  if (!scope?.confirmed || !tos.scope_key || !Array.isArray(scope.sources) || !scope.sources.length) {
    throw new Error('Review and confirm assessment coverage and supporting passages before continuing.');
  }
  const chunks = await ownedChunks(tos.subject_id, userId, scope.sources.map((s) => s.chunkId), db);
  const sources = validateSources(scope.sources, chunks);
  if (scopeKey({ ...scope, sources }) !== tos.scope_key) throw new Error('Assessment coverage has changed. Review it before continuing.');
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return sources.map((s) => ({ ...byId.get(s.chunkId), text: s.text }));
}

export async function ownedChunks(subjectId, userId, ids, db = pool) {
  if (!ids.length) return [];
  const [rows] = await db.query(
    `SELECT c.id, c.text, c.ordinal, c.material_id AS materialId, m.title
     FROM material_chunks c JOIN materials m ON m.id = c.material_id
     JOIN subjects s ON s.id = m.subject_id
     WHERE c.id IN (:ids) AND c.subject_id = :sid AND m.subject_id = :sid
       AND m.created_by = :uid AND s.instructor_id = :uid AND m.status = 'processed'`,
    { ids, sid: subjectId, uid: userId }
  );
  return rows;
}
