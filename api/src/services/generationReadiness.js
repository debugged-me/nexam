import pool from '../config/db.js';

const COURSE_LABELS = [
  /^course\s+title\s*[:\-]?\s*(.+)$/i,
  /^course\s+syllabus\s*[:\-]?\s*(.+)$/i,
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with',
  'course', 'introduction', 'fundamentals',
]);

function lessonRows(chunks = []) {
  return chunks.filter((chunk) => Number(chunk.is_syllabus) === 0);
}

export function readinessFromChunks(chunks = [], scoped = true) {
  const lessons = lessonRows(chunks);
  return {
    ready: lessons.length > 0,
    scoped,
    lessonMaterials: new Set(lessons.map((chunk) => chunk.materialId || chunk.material_id).filter(Boolean)).size,
    lessonChunks: lessons.length,
    code: lessons.length ? null : 'LESSON_EVIDENCE_REQUIRED',
  };
}

export async function generationReadiness(tos, userId, scopedChunks, db = pool) {
  if (Array.isArray(scopedChunks)) return readinessFromChunks(scopedChunks, true);

  const [rows] = await db.query(
    `SELECT COUNT(DISTINCT m.id) AS lesson_materials, COUNT(c.id) AS lesson_chunks
     FROM materials m
     JOIN subjects s ON s.id = m.subject_id
     JOIN material_chunks c ON c.material_id = m.id AND c.subject_id = m.subject_id
     WHERE m.subject_id = :subjectId AND m.created_by = :userId
       AND s.instructor_id = :userId AND m.status = 'processed' AND m.is_syllabus = 0`,
    { subjectId: tos.subject_id, userId }
  );
  const lessonMaterials = Number(rows[0]?.lesson_materials) || 0;
  const lessonChunks = Number(rows[0]?.lesson_chunks) || 0;
  return {
    ready: lessonChunks > 0,
    scoped: false,
    lessonMaterials,
    lessonChunks,
    code: lessonChunks > 0 ? null : 'LESSON_EVIDENCE_REQUIRED',
  };
}

export function extractSyllabusCourseTitle(content) {
  const lines = String(content || '').split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    for (const pattern of COURSE_LABELS) {
      const match = lines[i].match(pattern);
      if (match?.[1]?.trim()) return match[1].trim();
    }
    if (/^course\s+(?:title|syllabus)\s*[:\-]?$/i.test(lines[i]) && lines[i + 1]) return lines[i + 1];
  }
  return null;
}

function normalized(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function meaningfulTokens(value) {
  return new Set(normalized(value).split(/\s+/).filter((token) => token.length > 1 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)));
}

export function compareSyllabusCourse(content, subject = {}) {
  const syllabusCourseTitle = extractSyllabusCourseTitle(content);
  if (!syllabusCourseTitle) return null;

  const sourceTokens = meaningfulTokens(syllabusCourseTitle);
  const subjectTokens = meaningfulTokens(`${subject.code || ''} ${subject.name || ''}`);
  const overlap = [...sourceTokens].filter((token) => subjectTokens.has(token)).length;
  const compactSource = normalized(syllabusCourseTitle).replace(/\s/g, '');
  const compactCode = normalized(subject.code).replace(/\s/g, '');
  const codeMatches = compactCode.length >= 3 && (compactSource.includes(compactCode) || compactCode.includes(compactSource));
  const comparable = sourceTokens.size >= 2 && subjectTokens.size >= 1;

  return {
    syllabusCourseTitle,
    subjectName: subject.name || null,
    subjectCode: subject.code || null,
    mismatch: comparable && overlap === 0 && !codeMatches,
  };
}
