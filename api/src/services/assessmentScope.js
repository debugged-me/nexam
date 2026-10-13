import { createHash } from 'node:crypto';

export function readJson(value, fallback = null) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function parseTimeFrame(value = {}) {
  const label = String(value.label || '').trim();
  if (label.length > 100) throw new Error('Assessment name must be 100 characters or fewer.');
  const week = (n) => n === '' || n == null ? null : (typeof n === 'number' || typeof n === 'string') ? Number(n) : NaN;
  const weekStart = week(value.weekStart);
  const weekEnd = week(value.weekEnd);
  if ((weekStart === null) !== (weekEnd === null)
    || [weekStart, weekEnd].some((n) => n !== null && (!Number.isInteger(n) || n < 1 || n > 100))
    || (weekStart !== null && weekEnd < weekStart)) {
    throw new Error('Enter both weeks, from 1 to 100, with the end on or after the start; or leave both blank.');
  }
  return { version: 1, label, weekStart, weekEnd };
}

// Detect actual headings, never infer weeks from topic order or a period name.
export function syllabusPeriods(text) {
  const pattern = /Time\s*Frame\s*:\s*([^\n(]+?)\s*(?:\(\s*Weeks?\s*(\d+)\s*[-–—]\s*(\d+)\s*\))?(?=\s*\n|$)/gi;
  return [...String(text).matchAll(pattern)].map((m) => {
    const label = normalizeText(m[1]);
    let frame = { label, weekStart: null, weekEnd: null };
    try { frame = parseTimeFrame({ label, weekStart: m[2], weekEnd: m[3] }); }
    catch { /* Preserve an invalid schedule as unknown for instructor review. */ }
    return { label: frame.label, weekStart: frame.weekStart, weekEnd: frame.weekEnd, evidence: m[0].trim(), index: m.index };
  });
}

// Extraction output and source text rarely agree on case, dash spacing, or
// Week/Weeks — compare those loosely. Verification itself stays strict.
const loose = (v) => normalizeText(v).toLowerCase().replace(/\bweeks\b/g, 'week').replace(/\s*[-–—]\s*/g, '-');

export function sliceHasTopic(slice, title) {
  const hay = loose(slice);
  const needle = loose(title);
  if (hay.includes(needle)) return true;
  // AI titles often merge table cells ("Recreational games (including Larong
  // Pinoy)") — the part outside parentheses is what the outline prints.
  const head = loose(String(title || '').replace(/\([^)]*\)/g, ' '));
  if (head.length >= 4 && head !== needle && hay.includes(head)) return true;
  // "Parent — child" topics: both sides must appear in the same section,
  // though other items may sit between them.
  const parts = needle.split('-').map((p) => p.trim()).filter((p) => p.length >= 4);
  return parts.length > 1 && parts.every((p) => hay.includes(p));
}

export function verifiedSchedule(topic, syllabus, materialId) {
  const evidence = normalizeText(topic.schedule_evidence);
  const looseEvidence = loose(evidence);
  if (!evidence || !loose(syllabus).includes(looseEvidence)) return null;
  const periods = syllabusPeriods(syllabus);
  const matching = periods.filter((p) => {
    // The evidence may quote the full heading, drop its "Time Frame:" prefix,
    // or name the period alone — all must equal a detected heading's form.
    const forms = new Set([loose(p.evidence), loose(p.label)]);
    if (p.weekStart) forms.add(loose(`${p.label} (Week ${p.weekStart}-${p.weekEnd})`));
    return forms.has(looseEvidence)
      && sliceHasTopic(syllabus.slice(p.index, periods.find((n) => n.index > p.index)?.index), topic.topic);
  });
  if (matching.length === 1) {
    const { label, weekStart, weekEnd } = matching[0];
    return { label, weekStart, weekEnd, evidence, materialId };
  }
  // A week-based table can quote the complete topic row instead of a heading.
  const weekRanges = [...evidence.matchAll(/\bWeeks?\s*(\d+)(?:\s*[-–—]\s*(\d+))?\b/gi)];
  const weekRange = weekRanges[0];
  if (weekRanges.length === 1 && looseEvidence.includes(loose(topic.topic))) {
    try {
      const frame = parseTimeFrame({ weekStart: weekRange[1], weekEnd: weekRange[2] || weekRange[1] });
      return { ...frame, evidence, materialId };
    } catch { /* Preserve the evidence for manual review below. */ }
  }
  // Other syllabus formats can still preserve an exact quoted schedule for
  // manual review, but cannot silently assign an unverified week range.
  return { label: '', weekStart: null, weekEnd: null, evidence, materialId };
}

export function validateSources(sources, chunks) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 100) {
    throw new Error('Select 1–100 supporting passages for this assessment.');
  }
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const seen = new Set();
  let length = 0;
  const validated = sources.map((s) => {
    if (!s || typeof s.chunkId !== 'string' || seen.has(s.chunkId)) throw new Error('Each source passage must be selected once.');
    seen.add(s.chunkId);
    const chunk = byId.get(s.chunkId);
    const text = normalizeText(s.text);
    if (!chunk || text.length < 20 || !normalizeText(chunk.text).includes(text)) {
      throw new Error('A selected passage is unavailable or its excerpt has changed. Select current material and copy an exact passage.');
    }
    length += text.length;
    return { chunkId: chunk.id, text, title: chunk.title || null, materialId: chunk.materialId || null };
  });
  if (length > 100000) throw new Error('Select a narrower assessment scope (at most 100,000 characters).');
  return validated;
}

export function scopeKey(scope) {
  return createHash('sha256').update(JSON.stringify({
    ...parseTimeFrame(scope),
    sources: scope.sources.map(({ chunkId, text }) => ({ chunkId, text })).sort((a, b) => a.chunkId.localeCompare(b.chunkId)),
  })).digest('hex');
}

// Used by coverage, generation, assembly, and direct question attachment.
export function questionScopeSql(tosId = ':tosId', alias = 'q') {
  return `NOT EXISTS (SELECT 1 FROM tos scope_t WHERE scope_t.id = ${tosId}
    AND scope_t.assessment_scope IS NOT NULL
    AND (scope_t.scope_key IS NULL OR ${alias}.scope_key IS NULL OR ${alias}.scope_key <> scope_t.scope_key))`;
}

export function questionFitsScope(question, tos) {
  return !tos.assessment_scope || Boolean(tos.scope_key && question.scope_key === tos.scope_key);
}
