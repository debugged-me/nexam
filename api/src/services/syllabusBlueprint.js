import { createHash } from 'node:crypto';
import { normalizeText, syllabusPeriods, verifiedSchedule, sliceHasTopic } from './assessmentScope.js';

export const sourceHash = (text) => createHash('sha256').update(String(text)).digest('hex');

// Only accept an unambiguous stated semester/course total. Credits and weekly
// hours alone do not establish semester length or individual topic hours.
export function statedCourseHours(text) {
  const matches = [...String(text).matchAll(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:per\s+(?:semester|course)|\/(?:semester|course)|(?:in|for)\s+(?:the\s+)?(?:semester|course))/gi)];
  if (!matches.length) {
    matches.push(...String(text).matchAll(/(?:total\s+(?:instructional\s+|contact\s+)?hours?|(?:course|semester)\s+hours?)\s*[:|=]\s*(\d+(?:\.\d+)?)/gi));
  }
  const values = [...new Set(matches.map((m) => Number(m[1])))];
  return values.length === 1 && values[0] > 0 && values[0] <= 10000
    ? { value: values[0], evidence: matches[0][0] } : null;
}

// Topic bullets: -, –, —, •, ▪, ◦, *, "1." / "1)" and "a." / "a)".
export const BULLET = /^(?:[-–—•▪◦*]\s*|\d{1,2}[.)]\s+|[a-z][.)]\s+)/i;
// Section labels that end a Topics list. A "Label:" line inside the list only
// ends it when the label is a known section or repeats across the outline
// (table headers repeat per period); "Unit 1: Introduction" stays a topic.
const SECTION_LABEL = /^(?:time\s*frame|ilo|intended learning outcomes?|clos?(?:\s+targeted)?|topics?|teaching|learning activit|assessment|resources?|references?|values?|weeks?|course|output|evaluation|remarks)\b/i;
const labelOf = (line) => line.match(/^([\p{L}][^:]{0,100}):/u)?.[1].trim().toLowerCase() || null;

// Recognized column labels provide a lossless outline, independent of LLM
// omissions. Unknown layouts use validated model extraction instead.
// An indented bullet under a topic ("  - Patintero" under "Larong Task") is
// a sub-item: it becomes "Larong Task — Patintero" and the sub-items stand in
// for their parent. `{ raw: true }` returns every item's plain text instead.
export function explicitOutline(text, { raw = false } = {}) {
  const lines = String(text).split('\n');
  const periods = syllabusPeriods(text);
  const labelCounts = new Map();
  for (const line of lines) {
    const label = labelOf(line.trim());
    if (label) labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
  }
  const endsSection = (line) => {
    if (/^PART\s+\d/i.test(line)) return true;
    const label = labelOf(line);
    return Boolean(label && (SECTION_LABEL.test(label) || labelCounts.get(label) > 1));
  };
  const topics = [];
  const intro = /^(?:at the end|students (?:will|should))/i;
  let frame = ''; let outcomes = []; let inTopics = false; let inOutcomes = false; let parent = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^Time\s*Frame\s*:/i.test(trimmed)) {
      frame = periods.find((p) => normalizeText(p.evidence) === normalizeText(trimmed))?.evidence || '';
      outcomes = []; inTopics = false; inOutcomes = false; parent = null;
    }
    if (/^(?:ILO|Intended Learning Outcomes?)\s*:/i.test(trimmed)) {
      inOutcomes = true; inTopics = false;
      const value = trimmed.replace(/^[^:]+:\s*/, '').replace(BULLET, '');
      if (value && !intro.test(value)) outcomes.push(value);
      continue;
    }
    const topicLine = trimmed.match(/^Topics?\s*:\s*(.*)$/i);
    if (topicLine) { inTopics = true; inOutcomes = false; parent = null; }
    else if (endsSection(trimmed)) { inTopics = false; inOutcomes = false; parent = null; }
    const value = (topicLine ? topicLine[1] : trimmed).replace(BULLET, '').trim();
    if (inTopics && value) {
      const item = { topic: value, learning_outcomes: [...outcomes], schedule_evidence: frame };
      if (!raw && !topicLine && parent && /^\s{2,}[-–—•▪◦*]/.test(line)) {
        parent.hasSubItems = true;
        topics.push({ ...item, topic: `${parent.topic} — ${value}` });
      } else {
        parent = item;
        topics.push(item);
      }
    } else if (inOutcomes && value && !intro.test(value)) {
      // Every line of the ILO cell is an outcome, bulleted or not.
      outcomes.push(value);
    }
  }
  return topics.filter((t) => !t.hasSubItems).map(({ hasSubItems, ...t }) => t); // eslint-disable-line no-unused-vars
}

export function prepareSyllabusBlueprint(parsed, text, materialId) {
  const outline = explicitOutline(text);
  const candidates = outline.length ? outline : parsed.topics;
  if (!Array.isArray(candidates) || !candidates.length || candidates.length > 100) {
    throw new Error('No complete course outline could be verified. Review the document layout or enter topics manually.');
  }
  const normalized = normalizeText(text);
  // Model-extracted titles may differ from the page in case, dashes or quotes,
  // or join a parent and sub-item; each part must still be syllabus text. One
  // unverifiable title is left out visibly instead of failing the blueprint.
  const plain = (v) => String(v || '').replace(/[‘’`]/g, "'").replace(/[“”]/g, '"');
  const inSyllabus = (title) => normalized.includes(normalizeText(title)) || sliceHasTopic(plain(text), plain(title));
  const seen = new Set();
  const unverified = [];
  const repeated = [];
  const topics = [];
  const lower = normalized.toLowerCase();
  const listLines = String(text).split('\n').map((l) => normalizeText(l.replace(/^\s*(?:Topics?\s*:\s*)?/i, '').replace(BULLET, '')));
  for (const candidate of candidates) {
    let title = normalizeText(candidate.topic);
    if (!title) continue;
    // When only letter case differs, take the syllabus's own spelling —
    // from an outline line first, not an earlier sentence that happens to
    // contain the same words in lowercase.
    if (!normalized.includes(title)) {
      const line = listLines.find((l) => l.toLowerCase() === title.toLowerCase());
      const at = lower.indexOf(title.toLowerCase());
      if (line) title = line;
      else if (at >= 0) title = normalized.slice(at, at + title.length);
    }
    if (title.length > 255 || !inSyllabus(title)) { unverified.push(title.slice(0, 120)); continue; }
    if (seen.has(title.toLowerCase())) { repeated.push(title); continue; }
    seen.add(title.toLowerCase());
    const outcomes = (candidate.learning_outcomes || []).filter((s) => typeof s === 'string' && normalized.includes(normalizeText(s)));
    topics.push({ topic: title, learning_outcomes: outcomes, schedule: verifiedSchedule(candidate, text, materialId), instructional_hours: 0 });
  }
  // Sub-items listed as "Parent — sub-item" stand in for their parent, so
  // the parent is not a separate row (same result as the structured path).
  for (let i = topics.length - 1; i >= 0; i--) {
    const head = topics[i].topic.toLowerCase();
    if (topics.some((t, j) => j !== i && t.topic.toLowerCase().startsWith(head) && /^\s+[—–-]\s+\S/.test(t.topic.slice(head.length)))) topics.splice(i, 1);
  }
  if (!topics.length) {
    throw new Error('No course topic could be verified against the syllabus text. Review the document layout or enter topics manually.');
  }
  const hoursEvidence = {};
  for (const topic of topics) {
    const candidate = parsed.topics?.find((t) => normalizeText(t.topic).toLowerCase() === topic.topic.toLowerCase());
    const evidence = normalizeText(candidate?.hours_evidence);
    const value = Number(candidate?.instructional_hours);
    const numbers = [...evidence.matchAll(/(?:hours?|hrs?)\s*[:|=]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi)].map((m) => Number(m[1] || m[2]));
    if (evidence && evidence.length <= 600 && value > 0 && value <= 10000 && normalized.includes(evidence)
      && evidence.includes(normalizeText(topic.topic)) && numbers.length === 1 && numbers[0] === value
      && !topics.some((t) => t !== topic && evidence.includes(normalizeText(t.topic)))) {
      topic.instructional_hours = Math.round(value * 100) / 100;
      hoursEvidence[topic.topic] = evidence;
    }
  }
  const courseHours = statedCourseHours(text);
  // Suggested allocations are explicitly marked as estimates, never extracted
  // topic facts. Use non-overlapping period ranges only when all are known.
  const groups = new Map();
  for (const t of topics) {
    const s = t.schedule;
    const key = s?.weekStart ? `${s.weekStart}:${s.weekEnd}` : 'unknown';
    if (!groups.has(key)) groups.set(key, { start: s?.weekStart, end: s?.weekEnd, topics: [] });
    groups.get(key).topics.push(t);
  }
  const ordered = [...groups.values()].sort((a, b) => a.start - b.start);
  const usePeriods = ordered.every((g, i) => g.start && g.end && (!i || g.start > ordered[i - 1].end));
  const weights = topics.map((t) => {
    if (!usePeriods) return 1;
    const s = t.schedule; const group = groups.get(`${s.weekStart}:${s.weekEnd}`);
    return (s.weekEnd - s.weekStart + 1) / group.topics.length;
  });
  const statedSum = topics.reduce((n, t) => n + t.instructional_hours, 0);
  if (courseHours && statedSum > courseHours.value + 0.005) throw new Error('Stated topic hours exceed the stated course hours. Resolve the conflicting syllabus values before allocation.');
  const proposed = topics.map((t, i) => t.instructional_hours ? 0 : weights[i]);
  if (courseHours && proposed.some(Boolean)) {
    const sum = proposed.reduce((a, b) => a + b, 0);
    const cents = Math.round((courseHours.value - statedSum) * 100);
    const shares = proposed.map((w) => cents * w / sum);
    const allocated = shares.map(Math.floor);
    let remainder = cents - allocated.reduce((a, b) => a + b, 0);
    const ranking = shares.map((n, i) => ({ i, fraction: n - allocated[i] })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const { i } of ranking) { if (remainder-- <= 0) break; allocated[i]++; }
    topics.forEach((t, i) => { if (!t.instructional_hours) t.instructional_hours = allocated[i] / 100; });
  }
  return { topics, sourceMeta: {
    version: 1, extractionBasis: outline.length ? 'structured_outline' : 'ai_exact_spans', materialId, contentHash: sourceHash(text), courseHours, hoursEvidence,
    hoursBasis: Object.keys(hoursEvidence).length === topics.length ? 'stated_per_topic' : courseHours ? (usePeriods ? 'estimated_by_period_weeks' : 'estimated_equal_share') : 'not_stated',
    defaults: ['total_items', 'bloom_weights'],
    warnings: [courseHours
      ? `Hours without explicit topic evidence are proposed shares of the stated ${courseHours.value} course hours. Confirm the actual teaching allocation.`
      : 'Total course hours were not verified. Retain stated topic hours and supply any missing allocations before finalizing.',
    'Item count and Bloom percentages are editable planning defaults, not facts extracted from the syllabus.',
    'Creating requires original work. Objective questions cannot establish this level; review any Creating allocation before generation.',
    ...(unverified.length ? [`${unverified.length} topic${unverified.length === 1 ? '' : 's'} suggested by the AI could not be found in the syllabus text and ${unverified.length === 1 ? 'was' : 'were'} left out: ${unverified.map((t) => `"${t}"`).join(', ')}. Add ${unverified.length === 1 ? 'it' : 'them'} manually if ${unverified.length === 1 ? 'it belongs' : 'they belong'}.`] : []),
    ...[...new Set(repeated)].map((t) => `"${t}" appears more than once and was kept once. Add it again under another name if it is taught in more than one period.`)],
  } };
}
