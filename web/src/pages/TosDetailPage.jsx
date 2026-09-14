/**
 * TosDetailPage — TOS builder with topic management.
 *
 * Matches the PHP CodeIgniter design (application/views/tos/view.php) exactly:
 * page-header, tos-workflow-callout, stats-grid, Bloom distribution card with
 * bloom-bar-row, topics card with data-table + inline-form.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, BookOpen, ChevronRight, Sparkles, FileText, Pencil, ListOrdered, Layers, Clock } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/tos.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

export default function TosDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [newTopic, setNewTopic] = useState({ title: '', instructional_hours: 0 });
  const [savingTopic, setSavingTopic] = useState(false);

  const load = useCallback(() => {
    api.get(`/tos/${id}`)
      .then(setData)
      .catch((err) => {
        toast.error(err.message || 'Could not load TOS.');
        navigate('/tos');
      });
  }, [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleAddTopic(e) {
    e.preventDefault();
    if (!newTopic.title.trim()) { toast.error('Topic title is required.'); return; }
    setSavingTopic(true);
    try {
      await api.post(`/tos/${id}/topics`, newTopic);
      toast.success('Topic added.');
      setNewTopic({ title: '', instructional_hours: 0 });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add topic.');
    } finally {
      setSavingTopic(false);
    }
  }

  async function handleDeleteTopic(topicId) {
    if (!confirm('Remove this topic? This cannot be undone.')) return;
    try {
      await api.del(`/tos/${id}/topics/${topicId}`);
      toast.success('Topic removed.');
      load();
    } catch (err) {
      toast.error(err.message || 'Could not remove topic.');
    }
  }

  if (!data) return <AppShell activeNav="tos" pageTitle="Blueprint"><p className="placeholder">Loading…</p></AppShell>;
  const { tos, topics } = data;
  const totalHours = topics.reduce((s, t) => s + (Number(t.instructional_hours) || 0), 0);

  return (
    <AppShell activeNav="tos" pageTitle={tos.title}>

      <div className="page-header">
        <div>
          <h1>{tos.title}</h1>
          {tos.subject_name && (
            <Link to="/subjects" className="crumb-link">
              <BookOpen size={14} />
              {tos.subject_name}
              {tos.subject_code && <span className="badge badge-gray ml-1">{tos.subject_code}</span>}
            </Link>
          )}
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-primary btn-sm" title="AI drafts questions from your materials based on this blueprint">
            <Sparkles size={14} /> Auto-generate Questions
          </button>
          <Link to="/exams" className="btn btn-outline btn-sm">
            <FileText size={14} /> Build Exam
          </Link>
          <Link to="/tos" className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</Link>
        </div>
      </div>

      <div className="tos-workflow-callout">
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">1</span>
          <span className="tos-workflow-text"><strong>Auto-generate Questions</strong> — AI drafts questions from your uploaded materials, aligned to this blueprint's Bloom distribution.</span>
        </div>
        <ChevronRight className="tos-workflow-arrow" />
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">2</span>
          <span className="tos-workflow-text"><strong>Review & Approve</strong> — Drafts appear on the Questions page. Approve the good ones to make them active.</span>
        </div>
        <ChevronRight className="tos-workflow-arrow" />
        <div className="tos-workflow-step">
          <span className="tos-workflow-num">3</span>
          <span className="tos-workflow-text"><strong>Build Exam</strong> — Pulls from your approved (active) question bank to fill this blueprint.</span>
        </div>
      </div>

      <div className="stats-grid mb-2">
        <div className="stat-card">
          <div className="stat-icon blue"><ListOrdered size={18} /></div>
          <div className="stat-info"><div className="stat-value">{Number(tos.total_items)}</div><div className="stat-label">Total Items</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><Layers size={18} /></div>
          <div className="stat-info"><div className="stat-value">{topics.length}</div><div className="stat-label">Topics</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Clock size={18} /></div>
          <div className="stat-info"><div className="stat-value">{totalHours}</div><div className="stat-label">Instructional Hours</div></div>
        </div>
      </div>

      <div className="card mb-2">
        <div className="card-header">
          <span className="card-title">Bloom's Taxonomy Distribution</span>
        </div>
        <div className="card-body">
          {BLOOM_ORDER.map((k) => {
            const pct = Number(tos.bloom_weights?.[k]) || 0;
            const itemCount = Math.round((pct / 100) * Number(tos.total_items));
            return (
              <div key={k} className="bloom-bar-row">
                <div className="bloom-bar-label">{BLOOM_LABELS[k]}</div>
                <div className="bloom-bar-track">
                  <div className="bloom-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="bloom-bar-meta">
                  <span className="badge badge-gray">{pct}%</span>
                  <span className="text-muted meta-xs">~{itemCount} items</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Topics</span>
          <span className="text-muted meta-sm">{topics.length} topic{topics.length === 1 ? '' : 's'}</span>
        </div>
        {topics.length === 0 ? (
          <div className="empty-state empty-state-md">
            <Layers aria-hidden="true" />
            <p>No topics added yet. Add topics below to define what this TOS covers.</p>
          </div>
        ) : (
          <div className="table-wrap table-bare">
            <table className="data-table">
              <caption className="sr-only">Topics in this Table of Specification</caption>
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Topic</th>
                  <th className="col-medium">Instructional Hours</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.map((tp, i) => (
                  <tr key={tp.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td className="cell-primary">{tp.title}</td>
                    <td><span className="badge badge-amber">{Number(tp.instructional_hours)} hrs</span></td>
                    <td>
                      <div className="action-icons">
                        <button className="action-icon danger" aria-label={`Remove ${tp.title}`} onClick={() => handleDeleteTopic(tp.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card-body card-body-divider">
          <form onSubmit={handleAddTopic}>
            <div className="inline-form">
              <div className="inline-form-grow">
                <label className="form-label" htmlFor="topic_title">Topic Title <span className="req">*</span></label>
                <input type="text" id="topic_title" className="form-control" required maxLength={255}
                  placeholder="e.g. Introduction to Algorithms"
                  value={newTopic.title}
                  onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} />
              </div>
              <div className="inline-form-fixed">
                <label className="form-label" htmlFor="topic_hours">Instructional Hours</label>
                <input type="number" id="topic_hours" className="form-control" min={0} max={1000} value={newTopic.instructional_hours}
                  onChange={(e) => setNewTopic({ ...newTopic, instructional_hours: Number(e.target.value) })} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingTopic}>
                {savingTopic ? <span className="btn-spinner" /> : <Plus size={16} />} Add Topic
              </button>
            </div>
          </form>
        </div>
      </div>

    </AppShell>
  );
}
