/**
 * subjectProgress — where a subject sits in the Nexam workflow, derived from
 * the per-stage counts GET /api/subjects returns.
 *
 *   subjectStages(s) → [{ key, label, state: 'done'|'partial'|'todo', detail }]
 *   nextStep(s)      → { key, label, to, done? } — the one action that moves it on
 *   attentionScore(s) — sort key for "Needs attention" (drafts first)
 *
 * Order follows the real dependencies: questions generate only from a
 * finalized blueprint, and exams assemble only from approved questions.
 */

const n = (v) => Number(v) || 0;
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** "CODE — Name" — skipped when the name already opens with the code, so
 *  "PE 3 — Physical Education" never renders as "PE 3 — PE 3 — …". Accepts
 *  {code,name} or {subject_code,subject_name} shapes. */
export function subjectLabel(s) {
  const name = String(s?.name ?? s?.subject_name ?? '').trim();
  const code = String(s?.code ?? s?.subject_code ?? '').trim();
  if (!name) return code;
  if (!code) return name;
  return name.toLowerCase().startsWith(code.toLowerCase()) ? name : `${code} — ${name}`;
}

export function subjectStages(s) {
  const ready = n(s.material_ready);
  const materials = n(s.material_count);
  const pending = n(s.material_pending);
  const tos = n(s.tos_count);
  const finalized = n(s.tos_finalized);
  const drafts = n(s.draft_count);
  const approved = n(s.approved_count);
  const questions = n(s.question_count);
  const exams = n(s.exam_count);
  const published = n(s.exam_published);

  return [
    {
      key: 'materials',
      label: 'Materials',
      state: ready ? 'done' : materials ? 'partial' : 'todo',
      detail: ready
        ? `${ready} ready${pending ? ` · ${pending} processing` : ''}`
        : pending ? `${pending} processing`
        : materials ? `${plural(materials, 'file')} need attention`
        : 'None yet',
    },
    {
      key: 'blueprint',
      label: 'Blueprint',
      state: finalized ? 'done' : tos ? 'partial' : 'todo',
      detail: finalized ? `${finalized} finalized` : tos ? `${plural(tos, 'draft')}` : 'None yet',
    },
    {
      key: 'questions',
      label: 'Questions',
      state: drafts ? 'partial' : approved ? 'done' : questions ? 'partial' : 'todo',
      detail: drafts
        ? `${drafts} to review${approved ? ` · ${approved} approved` : ''}`
        : approved ? `${approved} approved`
        : questions ? 'All rejected'
        : 'None yet',
    },
    {
      key: 'exam',
      label: 'Exam',
      state: published ? 'done' : exams ? 'partial' : 'todo',
      detail: published ? `${published} published` : exams ? `${plural(exams, 'draft')}` : 'None yet',
    },
  ];
}

export function nextStep(s) {
  const id = encodeURIComponent(s.id);
  const tosId = s.finalized_tos_id ? encodeURIComponent(s.finalized_tos_id) : null;
  if (!n(s.material_count)) return { key: 'upload', label: 'Upload materials', to: `/materials?upload=1&subject_id=${id}` };
  if (!n(s.material_ready)) {
    return n(s.material_pending)
      ? { key: 'processing', label: 'Materials processing…', to: '/materials' }
      : { key: 'fix-materials', label: 'Check materials', to: '/materials' };
  }
  if (!n(s.tos_count)) return { key: 'blueprint', label: 'Create blueprint', to: `/tos?new=1&subject=${id}` };
  if (!n(s.tos_finalized)) return { key: 'finalize', label: 'Finalize blueprint', to: '/tos' };
  if (n(s.draft_count)) {
    return { key: 'review', label: `Review ${plural(n(s.draft_count), 'draft')}`, to: `/questions/review?subject_id=${id}` };
  }
  if (!n(s.approved_count)) return { key: 'generate', label: 'Generate questions', to: tosId ? `/tos/${tosId}` : '/tos' };
  if (!n(s.exam_count)) return { key: 'exam', label: 'Build exam', to: tosId ? `/exams/new?tos=${tosId}` : '/exams/new' };
  if (!n(s.exam_published)) return { key: 'publish', label: 'Publish exam', to: '/exams' };
  return { key: 'exams', label: 'Open exams', to: '/exams', done: true };
}

/** Higher = needs the instructor sooner. Drafts outrank everything. */
export function attentionScore(s) {
  if (n(s.draft_count)) return 1000 + n(s.draft_count);
  return subjectStages(s).filter((st) => st.state !== 'done').length;
}
