import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Clock, Search, Trash2 } from 'lucide-react';
import api from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { useConfirm } from './ConfirmDialog.jsx';
import Modal from './Modal.jsx';
import AssessmentTimeFrame from './AssessmentTimeFrame.jsx';
import { parseScope, timeFrameLabel } from '../lib/assessmentScope.js';

export default function AssessmentCoverage({ tos, topics, onSaved }) {
  const [open, setOpen] = useState(false);
  const scope = parseScope(tos.assessment_scope);
  const reviewed = Boolean(scope?.confirmed && tos.scope_key);
  const locked = tos.status === 'finalized';
  return <section className="card assessment-coverage" aria-label="Assessment coverage">
    <div className="card-header">
      <div><h2 className="card-title"><Clock size={17} /> Assessment coverage</h2>
        <p className="card-sub">{scope ? timeFrameLabel(scope) : 'All subject materials · no period restriction'}</p></div>
      {!locked && <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
        {reviewed ? 'Edit coverage' : 'Review coverage'}
      </button>}
    </div>
    <div className="assessment-summary">
      {scope ? <><span className={`badge ${reviewed ? 'badge-green' : 'badge-amber'}`}>{reviewed ? 'Coverage confirmed' : 'Review required'}</span>
        <span>{topics.length} topics · {scope.sources?.length || 0} supporting passages</span>
        {!reviewed && <p>Choose the topics and syllabus or lesson passages for this assessment before finalizing. Weeks are optional.</p>}</>
        : <p>{locked ? 'This existing blueprint uses subject-wide retrieval. Create a new blueprint from selected topics to set a period.' : 'Set a period and select supporting passages to limit what the questions can cover.'}</p>}
    </div>
    {reviewed && <details className="assessment-saved-sources"><summary>View confirmed source passages</summary>
      {scope.sources.map((s, i) => <div key={s.chunkId}><strong>{s.title || `Passage ${i + 1}`}</strong><p>{s.text}</p></div>)}
    </details>}
    {open && <CoverageEditor tos={tos} topics={topics} onClose={() => setOpen(false)} onSaved={onSaved} />}
  </section>;
}

function CoverageEditor({ tos, topics, onClose, onSaved }) {
  const saved = parseScope(tos.assessment_scope);
  const toast = useToast();
  const confirm = useConfirm();
  const [frame, setFrame] = useState(saved || { label: '', weekStart: '', weekEnd: '' });
  const [selected, setSelected] = useState(() => new Set(topics.filter((t) => {
    if (saved?.confirmed || !saved?.weekStart) return true;
    const schedule = parseScope(t.schedule);
    return schedule?.weekStart >= saved.weekStart && schedule?.weekEnd <= saved.weekEnd;
  }).map((t) => t.id)));
  const [sources, setSources] = useState(() => new Map((saved?.sources || []).map((source) => [source.chunkId, {
    text: source.text,
    materialId: source.materialId || null,
    title: source.title || null,
  }])));
  const [materials, setMaterials] = useState([]);
  const [materialId, setMaterialId] = useState('');
  const [materialQuery, setMaterialQuery] = useState('');
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const periods = useMemo(() => [...new Map(topics.map((t) => parseScope(t.schedule)).filter((s) => s?.label || s?.weekStart)
    .map((s) => [timeFrameLabel(s), s])).values()], [topics]);
  const unknown = topics.filter((t) => !parseScope(t.schedule)?.weekStart).length;
  const selectedMaterial = materials.find((m) => m.id === materialId);
  const filteredMaterials = useMemo(() => {
    const needle = materialQuery.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter((material) => `${material.title} ${Number(material.is_syllabus) ? 'syllabus' : 'lesson'}`.toLowerCase().includes(needle));
  }, [materials, materialQuery]);
  const selectedMaterialGroups = useMemo(() => {
    const groups = new Map();
    for (const [chunkId, source] of sources) {
      const key = source.materialId || `unknown:${chunkId}`;
      if (!groups.has(key)) groups.set(key, {
        materialId: source.materialId,
        title: source.title || 'Selected source',
        chunkIds: [],
      });
      groups.get(key).chunkIds.push(chunkId);
    }
    return [...groups.values()];
  }, [sources]);

  useEffect(() => {
    let active = true;
    api.get(`/tos/${tos.id}/scope-materials`).then((data) => { if (active) { setMaterials(data.materials); setMaterialId(data.materials[0]?.id || ''); if (!data.materials.length) setLoading(false); } })
      .catch((e) => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [tos.id]);

  useEffect(() => {
    if (!materialId) return;
    let active = true;
    api.get(`/tos/${tos.id}/scope-materials?materialId=${encodeURIComponent(materialId)}`)
      .then((data) => { if (active) setChunks(data.chunks); })
      .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tos.id, materialId]);

  const toggleTopic = (id) => { setConfirmed(false); setSelected((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const changeSource = (id, text, meta = {}) => {
    if (text !== null && !sources.has(id) && sources.size >= 100) {
      setError('Assessment Coverage supports up to 100 passages. Remove one before adding another.');
      return;
    }
    setConfirmed(false); setSources((old) => {
    const next = new Map(old);
    if (text === null) next.delete(id);
    else next.set(id, { ...(next.get(id) || {}), ...meta, text });
    return next;
    });
  };
  const currentChunkIds = chunks.map((chunk) => chunk.id);
  const allCurrentSelected = currentChunkIds.length > 0 && currentChunkIds.every((id) => sources.has(id));
  function toggleCurrentMaterial() {
    setConfirmed(false);
    setError('');
    const additions = chunks.filter((chunk) => !sources.has(chunk.id));
    if (!allCurrentSelected && sources.size + additions.length > 100) {
      setError('Assessment Coverage supports up to 100 passages. Select fewer passages or narrower excerpts.');
      return;
    }
    setSources((old) => {
      const next = new Map(old);
      if (allCurrentSelected) {
        currentChunkIds.forEach((id) => next.delete(id));
        return next;
      }
      additions.forEach((chunk) => next.set(chunk.id, {
        text: chunk.text,
        materialId: selectedMaterial?.id || null,
        title: selectedMaterial?.title || null,
      }));
      return next;
    });
  }
  function removeSelectedMaterial(group) {
    setConfirmed(false);
    setSources((old) => {
      const next = new Map(old);
      group.chunkIds.forEach((id) => next.delete(id));
      return next;
    });
  }
  function choosePeriod(period) {
    setFrame({ label: period.label || frame.label, weekStart: period.weekStart ?? '', weekEnd: period.weekEnd ?? '' });
    setSelected(new Set(topics.filter((t) => {
      const s = parseScope(t.schedule);
      return s && (period.weekStart ? s.weekStart >= period.weekStart && s.weekEnd <= period.weekEnd : s.label === period.label);
    }).map((t) => t.id)));
    setConfirmed(false);
  }
  async function save(e) {
    e.preventDefault();
    const excluded = topics.length - selected.size;
    if (excluded && !(await confirm(`Keep ${selected.size} selected topics and remove ${excluded} others from this draft? Their source syllabus remains available.`, { title: 'Apply assessment coverage', confirmText: 'Apply coverage', danger: false }))) return;
    setSaving(true); setError('');
    try {
      await api.put(`/tos/${tos.id}/assessment-scope`, {
        ...frame,
        confirmed,
        topicIds: [...selected],
        sources: [...sources].map(([chunkId, source]) => ({ chunkId, text: source.text })),
      });
      toast.success('Assessment coverage saved. Review hours and the Bloom matrix before finalizing.');
      await onSaved(); onClose();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <Modal open title="Review assessment coverage" size="lg" onClose={() => !saving && onClose()}
    subtitle="Confirm the topics and their syllabus passages. Add substantive lesson passages for questions when needed."
    footer={<><button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
      <button type="submit" form="assessment-coverage-form" className="btn btn-primary" disabled={saving || !confirmed || !selected.size || !sources.size || !frame.label.trim()}>{saving ? 'Saving…' : 'Save coverage'}</button></>}>
    <form id="assessment-coverage-form" className="assessment-editor" onSubmit={save}>
      <AssessmentTimeFrame value={frame} onChange={(v) => { setFrame(v); setConfirmed(false); }} />
      {!!periods.length && <div className="assessment-periods"><span>From this syllabus:</span>{periods.map((p) => <button key={timeFrameLabel(p)} type="button" className="btn btn-outline btn-sm" onClick={() => choosePeriod(p)}>{timeFrameLabel(p)}</button>)}</div>}
      <fieldset><legend>Topics included ({selected.size} of {topics.length})</legend>
        {frame.weekStart && frame.weekEnd && <button type="button" className="btn btn-outline btn-sm" onClick={() => choosePeriod(frame)}>Select topics in this week range</button>}
        <p className="form-hint">Period buttons select topics with matching schedules. Review the selection; you can include earlier topics for a cumulative exam.</p>
        {unknown > 0 && <p className="assessment-note">{unknown} topic{unknown === 1 ? ' has' : 's have'} no verified week range. Select these manually if they belong; no weeks will be invented.</p>}
        <div className="assessment-topic-list">{topics.map((t) => {
          const schedule = parseScope(t.schedule);
          const outside = frame.weekStart && schedule?.weekStart && (schedule.weekStart < Number(frame.weekStart) || schedule.weekEnd > Number(frame.weekEnd));
          return <div className="assessment-topic" key={t.id}>
            <label className="assessment-check"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleTopic(t.id)} /><span><strong>{t.title}</strong><small>{timeFrameLabel(schedule)}{outside ? ' · Outside or overlaps your range — review inclusion' : ''}</small></span></label>
            {schedule?.evidence && <details><summary>View syllabus evidence</summary><blockquote>{schedule.evidence}</blockquote></details>}
          </div>;
        })}</div>
      </fieldset>
      <fieldset><legend><BookOpen size={16} /> Supporting source passages ({sources.size})</legend>
        <p className="form-hint">Syllabus passages are sufficient to confirm blueprint coverage. For question generation, select substantive lessons, slides, or readings when the syllabus contains only an outline. If a passage spans periods, keep only the exact excerpt taught in this assessment. A syllabus outline alone may not contain enough facts for questions.</p>
        <label className="ds-search assessment-material-search" htmlFor="scope-material-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">Search supporting materials</span>
          <input id="scope-material-search" type="search" autoComplete="off" placeholder={`Search ${materials.length || ''} materials…`} value={materialQuery} onChange={(e) => { setMaterialQuery(e.target.value); setMaterialId(''); setChunks([]); setLoading(false); }} />
        </label>
        <label className="form-label" htmlFor="scope-material">Material</label>
        <select id="scope-material" className="form-control" value={materialId} onChange={(e) => { setMaterialId(e.target.value); setChunks([]); setError(''); setLoading(Boolean(e.target.value)); }}>
          <option value="">Choose material</option>{filteredMaterials.map((m) => <option value={m.id} key={m.id}>{m.title}{Number(m.is_syllabus) ? ' (syllabus)' : ''} · {Number(m.chunk_count) || 0} passages</option>)}
        </select>
        {materialQuery && !filteredMaterials.length && <p className="assessment-note">No processed material matches “{materialQuery}”.</p>}
        {selectedMaterial && Number(selectedMaterial.is_syllabus) === 1 && <p className="assessment-note">This is a syllabus. Select only substantive teaching content; course schedules and reading lists do not supply the answers.</p>}
        {loading ? <p role="status">Loading passages…</p> : !materials.length ? <p>No processed materials yet. Upload the lessons for this subject, then return here.</p> : !chunks.length && <p>No passages available in this material yet.</p>}
        {!!chunks.length && <div className="assessment-source-toolbar">
          <span>{chunks.filter((chunk) => sources.has(chunk.id)).length} of {chunks.length} passages selected from this material</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={toggleCurrentMaterial}>
            {allCurrentSelected ? 'Remove this material' : 'Select all passages'}
          </button>
        </div>}
        <div className="assessment-passages">{chunks.map((c) => <div key={c.id} className="assessment-passage">
          <label className="assessment-check"><input type="checkbox" checked={sources.has(c.id)} onChange={(e) => changeSource(c.id, e.target.checked ? c.text : null, { materialId: selectedMaterial?.id || null, title: selectedMaterial?.title || null })} /><strong>Passage {Number(c.ordinal) + 1}</strong></label>
          <details><summary>Read source passage</summary><p>{c.text}</p></details>
          {sources.has(c.id) && <><label className="form-label" htmlFor={`excerpt-${c.id}`}>Included excerpt — keep an exact passage from the source</label><textarea id={`excerpt-${c.id}`} className="form-control" rows={4} value={sources.get(c.id)?.text || ''} onChange={(e) => changeSource(c.id, e.target.value)} /></>}
        </div>)}</div>
        {!!selectedMaterialGroups.length && <div className="assessment-selected-materials" aria-label="Selected supporting materials">
          <div className="assessment-selected-head"><strong>{selectedMaterialGroups.length} material{selectedMaterialGroups.length === 1 ? '' : 's'} selected</strong><span>{sources.size} passage{sources.size === 1 ? '' : 's'} total</span></div>
          <ul>{selectedMaterialGroups.map((group) => <li key={group.materialId || group.chunkIds[0]}>
            <span><strong>{group.title}</strong><small>{group.chunkIds.length} selected passage{group.chunkIds.length === 1 ? '' : 's'}</small></span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSelectedMaterial(group)} aria-label={`Remove ${group.title} from assessment coverage`}><Trash2 size={14} /> Remove</button>
          </li>)}</ul>
        </div>}
        {!!sources.size && <details className="assessment-selected"><summary>Review all {sources.size} selected passages</summary>{[...sources].map(([id, source], i) => <div key={id}><p><strong>{i + 1}.</strong> {source.text}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => changeSource(id, null)} aria-label={`Remove selected passage ${i + 1}`}><Trash2 size={14} /> Remove</button></div>)}</details>}
      </fieldset>
      <label className="assessment-check assessment-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I reviewed these topics and passages and confirm they belong in this assessment.</span><Check size={18} /></label>
      {error && <p className="assessment-error" role="alert">{error}</p>}
    </form>
  </Modal>;
}
