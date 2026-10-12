import '../styles/exam-detail.css';
/**
 * ExamDetailPage — exam detail with question attachment, PDF generation,
 * download, and LMS export.
 *
 * Uses a page header, status badges, actions, statistics, and cards for
 * Instructions / Questions / Downloads / LMS Export.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus, Trash2, FileText, FileCheck, Download, Send, Printer,
  Pencil, Clock, Monitor, QrCode, ScanLine, Sparkles, Copy,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import Modal from '../components/Modal.jsx';
import ExamPaper from '../components/ExamPaper.jsx';
import api, { ApiError, getToken } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { StatusPill, GroupChip, groupColor, statusOf } from '../components/Board.jsx';
import StageRail from '../components/StageRail.jsx';
import { PassDoughnut, DistBarChart } from '../components/AnalyticsCharts.jsx';
import Reveal from '../components/Reveal.jsx';
import celebrate from '../lib/celebrate.js';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const TYPE_LABELS = { mcq: 'MCQ', true_false: 'T/F', matching: 'Match', identification: 'Ident' };
const DIST_BINS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** Per-item correct-rate strip — one cell per printed item per set. */
function ItemHeatStrip({ items }) {
  const bySet = new Map();
  items.forEach((it) => {
    const key = it.set || '';
    if (!bySet.has(key)) bySet.set(key, []);
    bySet.get(key).push(it);
  });
  const band = (r) => (r >= 70 ? 'good' : r >= 40 ? 'mid' : 'low');
  return (
    <div className="item-heat" role="img" aria-label="Per-item correct rate — green mostly correct, amber mixed, red mostly wrong">
      {[...bySet.entries()].map(([set, rows]) => (
        <div className="item-heat-row" key={set || 'none'}>
          {set && <span className="item-heat-set">Set {set}</span>}
          <div className="item-heat-cells">
            {rows.map((it) => (
              <span
                key={`${set}:${it.itemNumber}`}
                className="item-heat-cell"
                data-band={band(it.correctRate)}
                title={`#${it.itemNumber} — ${it.correctRate}% correct${it.discrimination != null ? ` · r = ${it.discrimination}` : ''}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExamDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [data, setData] = useState(() => api.peek(`/exams/${id}`) ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [availableQs, setAvailableQs] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [attaching, setAttaching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadsVisible, setDownloadsVisible] = useState(false);
  const [printCfg, setPrintCfg] = useState({ open: false, set: 'A', includeKey: false });
  const [printReady, setPrintReady] = useState(false);
  const [results, setResults] = useState(null);
  const [itemStats, setItemStats] = useState([]);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  const load = useCallback(() => {
    api.get(`/exams/${id}`)
      .then((d) => {
        setData(d);
        // Results panel — best-effort; no scans yet just means no card.
        Promise.all([
          api.get(`/analytics/exam/${id}`),
          api.get(`/analytics/exam/${id}/items`),
        ])
          .then(([res, itemRes]) => {
            setResults(res);
            setItemStats(itemRes?.items || []);
          })
          .catch(() => {});
      })
      .catch((err) => { toast.error(err.message || 'Could not load exam.'); navigate('/exams'); });
  }, [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  // Print once the document block has rendered with the chosen config.
  useEffect(() => {
    if (!printReady) return;
    const t = setTimeout(() => {
      window.print();
      setPrintReady(false);
    }, 60);
    return () => clearTimeout(t);
  }, [printReady]);

  function startPrint() {
    setPrintCfg((c) => ({ ...c, open: false }));
    setPrintReady(true);
  }

  async function openPicker() {
    if (!data) return;
    try {
      const qData = await api.get(`/questions?subject_id=${data.exam.subject_id}&status=active`);
      const attachedIds = new Set(data.questions.map((q) => q.id));
      setAvailableQs(qData.questions.filter((q) => !attachedIds.has(q.id)));
      setSelected(new Set());
      setPickerOpen(true);
    } catch (err) {
      toast.error(err.message || 'Could not load questions.');
    }
  }

  async function handleAttach() {
    setAttaching(true);
    try {
      const ids = Array.from(selected);
      const result = await api.post(`/exams/${id}/questions`, { question_ids: ids });
      toast.success(`${result.added} question${result.added === 1 ? '' : 's'} attached.`);
      setPickerOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Attach failed.');
    } finally {
      setAttaching(false);
    }
  }

  async function handleRemoveQ(qid) {
    if (!(await confirm('Remove this question from the exam?', { title: 'Remove question', confirmText: 'Remove' }))) return;
    try {
      await api.del(`/exams/${id}/questions/${qid}`);
      toast.success('Question removed.');
      load();
    } catch (err) {
      toast.error(err.message || 'Remove failed.');
    }
  }

  async function handleGenerate() {
    if (!data?.questions?.length) { toast.error('Attach questions first.'); return; }
    const scannedCount = parseInt(results?.stats?.total_scans || 0, 10);
    if (hasSets && scannedCount > 0) {
      const ok = await confirm(
        `Regenerating starts a new print run — sheets already printed stay scannable and keep scoring against their own ordering, but any sheets printed from now on must use the new run. Continue?`,
        { title: 'Regenerate sets', confirmText: 'Regenerate', danger: false }
      );
      if (!ok) return;
    }
    setGenerating(true);
    try {
      const result = await api.post(`/exams/${id}/generate-sets`, { setCount: data.exam.set_count });
      toast.success(`Generated ${result.sets.length} set(s).`);
      setDownloadsVisible(true);
      celebrate();
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublish() {
    if (!(await confirm('Publish exam? The exam will be marked as published and ready for use.', { title: 'Publish exam', confirmText: 'Publish', danger: false }))) return;
    try {
      await api.put(`/exams/${id}`, { ...data.exam, status: 'published' });
      toast.success('Exam published.');
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Publish failed.');
    }
  }

  function downloadUrl(type, set) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams();
    if (set) params.set('set', set);
    params.set('token', getToken());
    return `${base}/exams/${id}/download/${type}?${params.toString()}`;
  }

  function exportUrl(format) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams({ token: getToken() });
    return `${base}/exams/${id}/export/${format}?${params.toString()}`;
  }

  if (!data) return <AppShell pageClass="exam-detail" activeNav="exams" pageTitle="Exam"><CardsSkeleton tiles={3} /></AppShell>;
  const { exam, questions, tos, sets } = data;
  const published = exam.status === 'published';
  const print = exam.format === 'print';
  const totalScans = parseInt(results?.stats?.total_scans || 0, 10);
  const reviewOpen = parseInt(results?.stats?.needs_review_count || 0, 10);
  const hasSets = Array.isArray(sets) && sets.length > 0;
  const showDownloads = downloadsVisible || hasSets;
  const accent = groupColor(exam.subject_id || exam.subject_name);
  const setLabels = hasSets
    ? sets.map((s) => s.set_label)
    : Array.from({ length: exam.set_count }, (_, i) => String.fromCharCode(65 + i));

  // Print-ready questions in the chosen set's order (Set B follows the
  // generated shuffle; fall back to canonical order when no set exists).
  const printSet = printCfg.set;
  const setDef = hasSets ? sets.find((s) => s.set_label === printSet) : null;
  const printQuestions = setDef?.question_ids?.length
    ? setDef.question_ids.map((qid) => questions.find((q) => q.id === qid)).filter(Boolean)
    : questions;

  // Lifecycle rail — the first unfinished stage is "current".
  const tone = statusOf(exam.status);
  const railStages = [
    { label: 'Assembled', sub: `${questions.length} item${questions.length === 1 ? '' : 's'}`, done: questions.length > 0 },
    { label: 'Sets generated', sub: hasSets ? `${sets.length} set${sets.length === 1 ? '' : 's'}` : undefined, done: hasSets },
    { label: 'Published', sub: published || tone === 'live' ? exam.status : 'draft', done: published || tone === 'live' },
    { label: 'Scanned', sub: totalScans ? `${totalScans} sheet${totalScans === 1 ? '' : 's'}` : undefined, done: totalScans > 0 },
    { label: 'Reviewed', sub: totalScans ? (reviewOpen ? `${reviewOpen} to confirm` : 'all confirmed') : undefined, done: totalScans > 0 && reviewOpen === 0 },
  ];
  const railNext = railStages.findIndex((s) => !s.done);
  const railSteps = railStages.map((s, i) => ({
    label: s.label,
    sub: s.sub,
    state: s.done ? 'done' : i === railNext ? 'current' : 'todo',
  }));

  return (
    <AppShell pageClass="exam-detail" activeNav="exams" pageTitle={exam.title}>
      {/* Screen UI — skipped when printing the exam document below */}
      <div className="print-skip">
      <div className="page-header">
        <div>
          <h1 style={{ viewTransitionName: 'vt-shared-entity' }}>{exam.title}</h1>
          <div className="exam-meta">
            {exam.subject_name && <GroupChip color={accent}>{exam.subject_name}</GroupChip>}
            <StatusPill status={exam.status} small inline />
          </div>
        </div>
        <div className="header-actions" data-tour="exam-actions">
          {!published && (
            <button className="btn btn-primary btn-sm" onClick={handlePublish}>
              <Send size={14} /> Publish
            </button>
          )}
          <button className={`btn btn-sm ${hasSets ? 'btn-outline' : 'btn-brand'}`} onClick={handleGenerate} disabled={generating || !questions.length}>
            {generating ? <span className="btn-spinner" /> : <Sparkles size={14} />}
            {hasSets ? 'Regenerate sets' : 'Generate sets'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setPrintCfg((c) => ({ ...c, open: true }))}
            title="Print the exam as a formatted document">
            <Printer size={14} /> Print
          </button>
          <Link to={`/exams/${id}/edit`} className="btn btn-outline btn-sm">
            <Pencil size={14} /> Edit
          </Link>
        </div>
      </div>

      <div data-tour="exam-pipeline">
        <StageRail steps={railSteps} />
      </div>

      <div className="exam-detail-layout">
        <div className="exam-detail-main">
          {/* The payoff: parallel print packs. One card per set, every artefact a real target. */}
          {showDownloads && (
            <section className="print-packs" id="exam-downloads" aria-label="Generated print packs" data-tour="exam-downloads">
              {setLabels.map((label) => (
                <article key={label} className="print-pack">
                  <header className="print-pack-head">
                    <span className="print-pack-set">Set {label}</span>
                    <span className="print-pack-meta">{questions.length} {questions.length === 1 ? 'item' : 'items'}{print ? ' · print' : ' · digital'}</span>
                    <QrCode size={18} className="print-pack-qr" aria-hidden="true" />
                  </header>
                  <div className="print-pack-files">
                    <a className="print-pack-file" href={downloadUrl('exam', label)} target="_blank" rel="noreferrer">
                      <FileText size={16} aria-hidden="true" /><span><strong>Exam paper</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <a className="print-pack-file" href={downloadUrl('answerkey', label)} target="_blank" rel="noreferrer">
                      <FileCheck size={16} aria-hidden="true" /><span><strong>Answer key</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <a className="print-pack-file" href={downloadUrl('omr', label)} target="_blank" rel="noreferrer">
                      <ScanLine size={16} aria-hidden="true" /><span><strong>OMR sheet</strong><small>QR-linked · PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                  </div>
                </article>
              ))}
            </section>
          )}

          {exam.instructions && (
            <div className="card card-instructions" style={{ '--gc': accent }}>
              <div className="card-header"><span className="card-title">Instructions</span></div>
              <div className="card-body">
                <p className="preserve-lines">{exam.instructions}</p>
              </div>
            </div>
          )}

          {parseInt(results?.stats?.total_scans || 0, 10) > 0 && (
            <Reveal className="card" data-tour="exam-results">
              <div className="card-header">
                <span className="card-title">Results at a glance</span>
                <Link className="btn btn-outline btn-sm" to={`/analytics/exam/${exam.id}`}>Full analysis</Link>
              </div>
              <div className="exam-results-grid">
                <PassDoughnut
                  passing={parseInt(results.stats.passing_count || 0, 10)}
                  failing={parseInt(results.stats.failing_count || 0, 10)}
                />
                <DistBarChart
                  distMap={Object.fromEntries((results.distribution || []).map((d) => [d.bin_start, d.count]))}
                  bins={DIST_BINS}
                />
              </div>
              {(results.setComparison || []).length > 1 && (
                <div className="exam-setbars" role="img" aria-label="Average score per set">
                  {results.setComparison.map((s) => (
                    <div className="exam-setbar" key={s.set_label}>
                      <span className="exam-setbar-label">Set {s.set_label}</span>
                      <div className="exam-setbar-track">
                        <div className="exam-setbar-fill" style={{ width: `${Math.min(100, Number(s.avg_score || 0))}%` }} />
                      </div>
                      <span className="exam-setbar-val">{Number(s.avg_score || 0).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
              {itemStats.length > 0 && <ItemHeatStrip items={itemStats} />}
            </Reveal>
          )}

          <div className="card" data-tour="exam-questions">
            <div className="card-header">
              <span className="card-title">Questions</span>
              {questions.length > 0 && (
                <>
                  <span className="text-muted meta-sm">{questions.length} total</span>
                  <button className="btn btn-outline btn-sm" onClick={openPicker}>
                    <Plus size={14} /> Add questions
                  </button>
                </>
              )}
            </div>
            {questions.length === 0 ? (
              <div className="empty-state">
                <EmptyStateArt art="paper" tone={4} />
                <h4>No questions in this exam</h4>
                <p>Add approved questions from your question bank or generate from a TOS blueprint.</p>
                <button className="btn btn-primary btn-sm" onClick={openPicker}>
                  <Plus size={14} /> Add questions
                </button>
              </div>
            ) : (
              <div className="table-wrap table-bare">
                <table className="data-table">
                  <caption className="sr-only">Questions included in {exam.title}</caption>
                  <thead>
                    <tr>
                      <th className="col-num">#</th>
                      <th>Question</th>
                      <th>Type</th>
                      <th>Bloom</th>
                      <th style={{ width: 50 }}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, i) => (
                      <tr key={q.id} onContextMenu={(e) => openMenu(e, [
                        { label: 'Copy stem', icon: Copy, onClick: () => copyText(q.stem, 'Question stem') },
                        'sep',
                        { label: 'Remove from exam', icon: Trash2, danger: true, onClick: () => handleRemoveQ(q.id) },
                      ])}>
                        <td className="text-muted">{i + 1}</td>
                        <td className="cell-medium">{q.stem}</td>
                        <td><span className="badge badge-gray">{TYPE_LABELS[q.type] || q.type}</span></td>
                        <td>{q.bloom
                          ? <span className="badge badge-purple">{BLOOM_LABELS[q.bloom] || q.bloom}</span>
                          : <span className="g-mute">—</span>}
                        </td>
                        <td>
                          <button className="action-icon danger" onClick={() => handleRemoveQ(q.id)} title="Remove question">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <aside className="exam-detail-side">
          <div className="card" data-tour="exam-details">
            <div className="card-header"><span className="card-title">Details</span></div>
            <dl className="detail-rows">
              <div className="detail-row"><dt>Status</dt><dd><StatusPill status={exam.status} small inline /></dd></div>
              {exam.subject_name && (
                <div className="detail-row"><dt>Subject</dt><dd><GroupChip color={accent}>{exam.subject_name}</GroupChip></dd></div>
              )}
              <div className="detail-row">
                <dt>Format</dt>
                <dd>{print ? <Printer size={13} /> : <Monitor size={13} />} {print ? 'Print' : 'Digital'}</dd>
              </div>
              {exam.duration_minutes && (
                <div className="detail-row"><dt>Duration</dt><dd><Clock size={13} /> {exam.duration_minutes} min</dd></div>
              )}
              <div className="detail-row"><dt>Questions</dt><dd>{questions.length}</dd></div>
              <div className="detail-row"><dt>Sets</dt><dd>{exam.set_count > 1 ? 'A + B' : 'A'}</dd></div>
              {tos && (
                <div className="detail-row"><dt>Blueprint</dt><dd className="detail-ellip" title={tos.title}>{tos.title || 'Linked'}</dd></div>
              )}
              <div className="detail-row"><dt>Created</dt><dd>{new Date(exam.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>

          <div className="card" data-tour="exam-export">
            <div className="card-header"><span className="card-title">Export</span></div>
            <div className="card-body dl-body">
              {showDownloads && tos && (
                <a className="print-pack-file" href={downloadUrl('tos-report')} target="_blank" rel="noreferrer">
                  <FileText size={16} aria-hidden="true" /><span><strong>TOS report</strong><small>Blueprint coverage · PDF</small></span><Download size={14} aria-hidden="true" />
                </a>
              )}
              <a className="print-pack-file" href={exportUrl('gift')} target="_blank" rel="noreferrer">
                <Download size={16} aria-hidden="true" /><span><strong>Moodle</strong><small>GIFT</small></span><Download size={14} aria-hidden="true" />
              </a>
              <a className="print-pack-file" href={exportUrl('xml')} target="_blank" rel="noreferrer">
                <Download size={16} aria-hidden="true" /><span><strong>Canvas</strong><small>QTI XML</small></span><Download size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
        </aside>
      </div>
      </div>{/* /print-skip */}

      <Modal open={pickerOpen} title="Add questions" subtitle={`From ${exam.subject_code || exam.subject_name}`} onClose={() => setPickerOpen(false)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setPickerOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAttach} disabled={attaching || selected.size === 0}>
            {attaching && <span className="btn-spinner" />}
            Attach {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>}>
        {availableQs.length === 0 ? (
          <p className="placeholder">No more approved questions available for this subject.</p>
        ) : (
          <div className="q-picker">
            <label className="q-pick-item q-pick-all">
              <input
                type="checkbox"
                className="q-pick-checkbox"
                checked={selected.size === availableQs.length}
                ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < availableQs.length; }}
                onChange={(e) => setSelected(e.target.checked ? new Set(availableQs.map((q) => q.id)) : new Set())}
              />
              <div style={{ flex: 1 }}>
                <div className="q-pick-stem">
                  {selected.size === availableQs.length ? 'Clear all' : 'Select all'}
                </div>
                <div className="q-pick-meta">{selected.size} of {availableQs.length} selected</div>
              </div>
            </label>
            {availableQs.map((q) => (
              <label key={q.id} className={`q-pick-item ${selected.has(q.id) ? 'selected' : ''}`}>
                <input type="checkbox" className="q-pick-checkbox" checked={selected.has(q.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(q.id); else next.delete(q.id);
                    setSelected(next);
                  }} />
                <div style={{ flex: 1 }}>
                  <div className="q-pick-stem">{q.stem}</div>
                  <div className="q-pick-meta">
                    {TYPE_LABELS[q.type] || q.type} · {q.bloom ? BLOOM_LABELS[q.bloom] : '—'} · {q.topic || 'No topic'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </Modal>

      {/* Print options — pick the set, optionally append the answer key */}
      <Modal open={printCfg.open} title="Print exam" subtitle="Renders as a formatted exam document" onClose={() => setPrintCfg((c) => ({ ...c, open: false }))}
        footer={<>
          <button className="btn" onClick={() => setPrintCfg((c) => ({ ...c, open: false }))}>Cancel</button>
          <button className="btn btn-primary" onClick={startPrint}><Printer size={14} /> Print</button>
        </>}>
        <div className="form-group">
          <span className="form-label">Set to print</span>
          <div className="src-options" role="radiogroup" aria-label="Set to print">
            {setLabels.map((label) => {
              const shuffled = sets?.find((s) => s.set_label === label)?.question_ids?.length > 0;
              return (
                <label key={label} className={`src-option ${printCfg.set === label ? 'is-selected' : ''}`}>
                  <input type="radio" name="print-set" checked={printCfg.set === label}
                    onChange={() => setPrintCfg((c) => ({ ...c, set: label }))} />
                  <span className="src-option-copy">
                    <strong>Set {label}</strong>
                    <small>{shuffled ? 'Generated shuffled order' : 'Canonical order'}</small>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <label className="form-check">
          <input type="checkbox" checked={printCfg.includeKey}
            onChange={(e) => setPrintCfg((c) => ({ ...c, includeKey: e.target.checked }))} />
          <span>Append answer key on a separate page (instructor copy)</span>
        </label>
      </Modal>

      {/* The printable document — hidden on screen, revealed by @media print */}
      {questions.length > 0 && (
        <ExamPaper
          exam={exam}
          questions={printQuestions}
          tos={tos}
          setLabel={printSet}
          includeKey={printCfg.includeKey}
        />
      )}
      {menuEl}
    </AppShell>
  );
}
