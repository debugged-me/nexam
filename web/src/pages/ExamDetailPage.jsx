import '../styles/exam-detail.css';
/**
 * ExamDetailPage — exam detail with question attachment, PDF generation,
 * download, and LMS export.
 *
 * Uses a page header, status badges, actions, statistics, and cards for
 * Instructions / Questions / Downloads / LMS Export.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Plus, Trash2, FileText, FileCheck, Download, Send, Printer,
  Pencil, Clock, Monitor, QrCode, ScanLine, Sparkles, Copy,
  Eye, RefreshCw, Shuffle, Search, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import { useContextMenu, useCopyText } from '../components/ContextMenu.jsx';
import Modal from '../components/Modal.jsx';
import ExamPaper from '../components/ExamPaper.jsx';
import ExamQuestionList from '../components/ExamQuestionList.jsx';
import QuestionPreview from '../components/QuestionPreview.jsx';
import api, { ApiError, getToken } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { StatusPill, GroupChip, groupColor, statusOf } from '../components/Board.jsx';
import StageRail from '../components/StageRail.jsx';
import { PassDoughnut, DistBarChart } from '../components/AnalyticsCharts.jsx';
import { Bubbles } from '../components/omr.jsx';
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
  const [quickN, setQuickN] = useState('');
  const [pickQuery, setPickQuery] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadsVisible, setDownloadsVisible] = useState(false);
  const [printCfg, setPrintCfg] = useState({ open: false, set: 'A', includeKey: false });
  const [printReady, setPrintReady] = useState(false);
  const [omrPreview, setOmrPreview] = useState(null); // 'A' | 'B' | null
  const [omrNonce, setOmrNonce] = useState(0);      // bumps the iframe after a re-render
  const [omrBusy, setOmrBusy] = useState(false);
  const omrFrameRef = useRef(null);
  const [previewQ, setPreviewQ] = useState(null);
  const [results, setResults] = useState(null);
  const [itemStats, setItemStats] = useState([]);
  const { menuEl, openMenu } = useContextMenu();
  const copyText = useCopyText();

  // Fingerprint of the results payload — the heartbeat compares against it so
  // unchanged polls never re-render or refetch item stats.
  const scanFp = (res) => `${res?.stats?.total_scans || 0}:${res?.stats?.needs_review_count || 0}:${(res?.students || []).length}`;
  const seenFp = useRef('');

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
            seenFp.current = scanFp(res);
            setResults(res);
            setItemStats(itemRes?.items || []);
          })
          .catch(() => {});
      })
      .catch((err) => { toast.error(err.message || 'Could not load exam.'); navigate('/exams'); });
  }, [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  // Live-scan heartbeat — scanned sheets POST synchronously from the scanner,
  // never touching the jobs queue, so the page polls quietly and only applies
  // state when the fingerprint actually moves.
  useEffect(() => {
    if (!data?.exam?.id) return undefined;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await api.get(`/analytics/exam/${id}`, { quiet: true });
        if (stopped || !res) return;
        const fp = scanFp(res);
        if (fp === seenFp.current) return;
        seenFp.current = fp;
        setResults(res);
        const itemRes = await api.get(`/analytics/exam/${id}/items`, { quiet: true });
        if (!stopped) setItemStats(itemRes?.items || []);
      } catch { /* quiet heartbeat — transient errors are fine */ }
    };
    const timer = setInterval(tick, 6000);
    return () => { stopped = true; clearInterval(timer); };
  }, [data?.exam?.id, id]);

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
      const filtered = qData.questions.filter((q) => !attachedIds.has(q.id));
      setAvailableQs(filtered);
      setSelected(new Set());
      // Prefill N with the blueprint's remaining item need, when there is one.
      const remaining = data.tos?.total_items
        ? Math.max(0, Number(data.tos.total_items) - data.questions.length)
        : 0;
      setQuickN(remaining > 0 ? String(Math.min(remaining, filtered.length)) : '');
      setPickQuery('');
      setPickerOpen(true);
    } catch (err) {
      toast.error(err.message || 'Could not load questions.');
    }
  }

  // Search narrows the working set — select-all and quick-select act on what
  // is shown, picks already made stay picked even when filtered out of view.
  const needle = pickQuery.trim().toLowerCase();
  const visibleQs = needle
    ? availableQs.filter((it) => it.stem.toLowerCase().includes(needle))
    : availableQs;
  const visibleSel = visibleQs.reduce((n, it) => n + (selected.has(it.id) ? 1 : 0), 0);
  const allVisibleChecked = visibleQs.length > 0 && visibleSel === visibleQs.length;

  // Fill the selection to N items — current picks are kept, the remainder is
  // topped up in list order or randomly from the unselected pool in view.
  const quickCount = Math.max(0, Math.min(Number(quickN) || 0, visibleQs.length));
  function selectN(random) {
    if (!quickCount) return;
    const keep = [...selected].slice(0, quickCount);
    const pool = visibleQs.filter((q) => !selected.has(q.id));
    const need = quickCount - keep.length;
    const fill = (random
      ? pool.map((q) => [Math.random(), q]).sort((a, b) => a[0] - b[0]).map(([, q]) => q)
      : pool
    ).slice(0, need).map((q) => q.id);
    setSelected(new Set([...keep, ...fill]));
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

  // Inline-served PDF for the preview iframe — the nonce cache-busts after a
  // re-render so the frame actually reloads the new file.
  function previewUrl(type, set) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams();
    if (set) params.set('set', set);
    params.set('inline', '1');
    params.set('cb', String(omrNonce));
    params.set('token', getToken());
    return `${base}/exams/${id}/download/${type}?${params.toString()}`;
  }

  // Re-render the stored OMR PDF with the latest layout code — same setId and
  // question order, so sheets already printed still scan.
  async function refreshOmr(setLabel) {
    setOmrBusy(true);
    try {
      await api.post(`/exams/${id}/omr/refresh?set=${setLabel}`);
      setOmrNonce((n) => n + 1);
      toast.success(`Set ${setLabel} OMR sheet re-rendered with the latest layout.`);
    } catch (err) {
      toast.error(err.message || 'Could not re-render the OMR sheet.');
    } finally {
      setOmrBusy(false);
    }
  }

  function exportUrl(format) {
    const base = import.meta.env.VITE_API_BASE || '/api';
    const params = new URLSearchParams({ token: getToken() });
    return `${base}/exams/${id}/export/${format}?${params.toString()}`;
  }

  if (!data) return <AppShell pageClass="exam-detail" activeNav="exams" pageTitle="Exam"><CardsSkeleton tiles={3} /></AppShell>;
  const { exam, questions, tos, tosMatrix, sets } = data;
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

  function questionMenu(e, q) {
    openMenu(e, [
      { label: 'Preview', icon: Eye, onClick: () => setPreviewQ(q) },
      { label: 'Copy stem', icon: Copy, onClick: () => copyText(q.stem, 'Question stem') },
      'sep',
      { label: 'Remove from exam', icon: Trash2, danger: true, onClick: () => handleRemoveQ(q.id) },
    ]);
  }

  // Preparation ends at publishing. OMR progress appears only when scans exist.
  const tone = statusOf(exam.status);
  const railStages = [
    { label: 'Assembled', sub: `${questions.length} item${questions.length === 1 ? '' : 's'}`, done: questions.length > 0 },
    { label: 'Sets generated', sub: hasSets ? `${sets.length} set${sets.length === 1 ? '' : 's'}` : undefined, done: hasSets },
    { label: 'Published', sub: published || tone === 'live' ? exam.status : 'draft', done: published || tone === 'live' },
    ...(totalScans > 0 ? [
      { label: 'OMR scanned', sub: `${totalScans} sheet${totalScans === 1 ? '' : 's'}`, done: true },
      { label: 'OMR reviewed', sub: reviewOpen ? `${reviewOpen} to confirm` : 'all confirmed', done: reviewOpen === 0 },
    ] : []),
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
        <p className="exam-delivery-note">Print exam papers or export to an LMS. OMR grading is optional: print the OMR sheets and scan completed answers with the Nexam mobile app.</p>
      </div>

      <div className="exam-detail-layout">
        <div className="exam-detail-main">
          {/* Outputs re-verify every AI question's quality review; say why
              before a download link opens a refusal in a new tab. */}
          {data.outputBlock && (
            <div className="callout callout-warning mb-2" role="alert">
              <span className="callout-icon"><AlertTriangle aria-hidden="true" /></span>
              <div>
                <div className="callout-title">Downloads and exports are blocked</div>
                <div className="callout-detail">{data.outputBlock.message}</div>
              </div>
            </div>
          )}
          {/* The payoff: parallel print packs. One card per set, every artefact a real target. */}
          {showDownloads && (
            <section className="print-packs" id="exam-downloads" aria-label="Generated print packs" data-tour="exam-downloads">
              {setLabels.map((label) => (
                <article key={label} className="print-pack">
                  <header className="print-pack-head">
                    <span className="print-pack-set">Set {label}</span>
                    <span className="print-pack-meta">{questions.length} {questions.length === 1 ? 'item' : 'items'}</span>
                    <QrCode size={18} className="print-pack-qr" aria-hidden="true" />
                  </header>
                  <div className="print-pack-files">
                    <a className="print-pack-file" href={downloadUrl('exam', label)} target="_blank" rel="noreferrer">
                      <FileText size={16} aria-hidden="true" /><span><strong>Exam paper</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <a className="print-pack-file" href={downloadUrl('answerkey', label)} target="_blank" rel="noreferrer">
                      <FileCheck size={16} aria-hidden="true" /><span><strong>Answer key</strong><small>PDF</small></span><Download size={14} aria-hidden="true" />
                    </a>
                    <button type="button" className="print-pack-file is-btn is-omr" onClick={() => setOmrPreview(label)}>
                      <ScanLine size={16} aria-hidden="true" /><span><strong>OMR sheet</strong><Bubbles className="pp-omr-bubbles" count={4} marked={1} /><small>Preview · QR-linked</small></span><Eye size={14} aria-hidden="true" />
                    </button>
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
                <span className="card-title">OMR results at a glance</span>
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

          <div className="card eq-card" data-tour="exam-questions">
            <div className="card-header">
              <div>
                <span className="card-title">Questions</span>
                {questions.length > 0 && (
                  <p className="card-sub">
                    {questions.length} item{questions.length === 1 ? '' : 's'}
                    {tos?.total_items ? ` of ${Number(tos.total_items)} planned` : ''} · click one to preview
                  </p>
                )}
              </div>
              {questions.length > 0 && (
                <button className="btn btn-outline btn-sm" onClick={openPicker}>
                  <Plus size={14} /> Add questions
                </button>
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
              <ExamQuestionList
                questions={questions}
                tosMatrix={tosMatrix}
                onPreview={setPreviewQ}
                onRemove={(q) => handleRemoveQ(q.id)}
                onMenu={questionMenu}
              />
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
                <dt>Preferred format</dt>
                <dd>{print ? <Printer size={13} /> : <Monitor size={13} />} {print ? 'Print' : 'LMS export'}</dd>
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

      <Modal
        open={!!previewQ}
        side
        title={previewQ ? `Question ${questions.findIndex((q) => q.id === previewQ.id) + 1}` : 'Question'}
        subtitle={previewQ?.topic || exam.subject_name}
        icon={FileText}
        accent={accent}
        onClose={() => setPreviewQ(null)}
        footer={previewQ && (
          <>
            <button type="button" className="btn btn-outline is-danger" onClick={() => { const q = previewQ; setPreviewQ(null); handleRemoveQ(q.id); }}>
              <Trash2 size={15} /> Remove from exam
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setPreviewQ(null)}>Done</button>
          </>
        )}
      >
        {previewQ && <QuestionPreview question={previewQ} />}
      </Modal>

      <Modal open={pickerOpen} title="Add questions" subtitle={`From ${exam.subject_code || exam.subject_name}`} onClose={() => setPickerOpen(false)} size="lg"
        footer={<>
          <button className="btn" onClick={() => setPickerOpen(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAttach} disabled={attaching || selected.size === 0}>
            {attaching && <span className="btn-spinner" />}
            Attach {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>}>
        {availableQs.length === 0 ? (
          <>
            <p className="placeholder">No more approved questions available for this subject.</p>
            <p className="q-pick-note">
              Need more? <Link to={`/questions?import=1&subject_id=${data?.exam?.subject_id}`}>Import a GIFT/XML bank</Link>
              {' '}— imported items land in the review queue first.
            </p>
          </>
        ) : (
          <>
          <label className="ds-search q-pick-search" htmlFor="q-pick-search">
            <Search size={15} />
            <span className="sr-only">Filter questions</span>
            <input
              id="q-pick-search"
              type="search"
              autoComplete="off"
              placeholder="Filter stems…"
              value={pickQuery}
              onChange={(e) => setPickQuery(e.target.value)}
            />
          </label>
          <div className="q-pick-tools">
            <span className="q-pick-tools-label">Quick select</span>
            <input
              type="number" className="form-control q-pick-n" min={1} max={availableQs.length}
              value={quickN} placeholder="N" aria-label="Number of questions to select"
              onChange={(e) => setQuickN(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); selectN(false); } }}
            />
            <button type="button" className="btn btn-outline btn-sm" onClick={() => selectN(false)} disabled={!quickCount}>
              First {quickCount || 'N'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => selectN(true)} disabled={!quickCount}>
              <Shuffle size={14} /> Random {quickCount || 'N'}
            </button>
            {tos?.total_items > 0 && questions.length + selected.size < Number(tos.total_items) && (
              <span className="q-pick-tools-hint">
                Blueprint needs {Number(tos.total_items) - questions.length - selected.size} more
              </span>
            )}
          </div>
          <div className="q-picker">
            <label className="q-pick-item q-pick-all">
              <input
                type="checkbox"
                className="q-pick-checkbox"
                checked={allVisibleChecked}
                ref={(el) => { if (el) el.indeterminate = visibleSel > 0 && !allVisibleChecked; }}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) visibleQs.forEach((it) => next.add(it.id));
                  else visibleQs.forEach((it) => next.delete(it.id));
                  setSelected(next);
                }}
              />
              <div style={{ flex: 1 }}>
                <div className="q-pick-stem">
                  {allVisibleChecked ? 'Clear all' : 'Select all'}{needle ? ' shown' : ''}
                </div>
                <div className="q-pick-meta">
                  {selected.size} of {availableQs.length} selected
                  {needle && ` · ${visibleQs.length} shown`}
                </div>
              </div>
            </label>
            {needle && visibleQs.length === 0 && (
              <p className="q-pick-empty">No questions match “{pickQuery.trim()}”.</p>
            )}
            {visibleQs.map((q) => (
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
                    {q.similarity_error && (
                      <span className="q-pick-unverified" title={`Approved without a duplicate check — ${q.similarity_error}`}>
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <p className="q-pick-note">
            Missing an item? <Link to={`/questions?import=1&subject_id=${data?.exam?.subject_id}`}>Import a GIFT/XML bank</Link>
            {' '}— imported items join the review queue first.
          </p>
          </>
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

      {/* OMR sheet preview — the exact PDF students fill, with re-render and
          print built in so nothing goes to paper sight-unseen. */}
      <Modal
        open={!!omrPreview}
        title={`OMR answer sheet — Set ${omrPreview || ''}`}
        subtitle="The exact PDF the scanner reads — check it before printing"
        onClose={() => setOmrPreview(null)}
        size="xl"
        icon={ScanLine}
        footer={<>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => refreshOmr(omrPreview)}
            disabled={omrBusy}
            title="Re-render this sheet with the latest layout code"
          >
            <RefreshCw size={14} className={omrBusy ? 'is-spinning' : ''} /> Re-render
          </button>
          <a className="btn btn-outline" href={downloadUrl('omr', omrPreview)} target="_blank" rel="noreferrer">
            <Download size={14} /> Download PDF
          </a>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => omrFrameRef.current?.contentWindow?.print()}
          >
            <Printer size={14} /> Print
          </button>
        </>}
      >
        {omrPreview && (
          <iframe
            key={`${omrPreview}-${omrNonce}`}
            ref={omrFrameRef}
            className="omr-preview-frame"
            src={previewUrl('omr', omrPreview)}
            title={`OMR answer sheet preview — Set ${omrPreview}`}
          />
        )}
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
