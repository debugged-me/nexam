/**
 * TosDetailPage — TOS builder with topic management.
 *
 * Shows the TOS blueprint (title, subject, total items, Bloom weights) and
 * a list of topics with instructional hours. Topics can be added/removed.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Clock, BookOpen } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/tos.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const BLOOM_COLORS = ['var(--bloom-1)', 'var(--bloom-2)', 'var(--bloom-3)', 'var(--bloom-4)', 'var(--bloom-5)', 'var(--bloom-6)'];

export default function TosDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [addingTopic, setAddingTopic] = useState(false);
  const [newTopic, setNewTopic] = useState({ title: '', instructional_hours: 0, learning_outcomes: '' });
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
    setSavingTopic(true);
    try {
      await api.post(`/tos/${id}/topics`, newTopic);
      toast.success('Topic added.');
      setAddingTopic(false);
      setNewTopic({ title: '', instructional_hours: 0, learning_outcomes: '' });
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add topic.');
    } finally {
      setSavingTopic(false);
    }
  }

  async function handleDeleteTopic(topicId) {
    if (!confirm('Remove this topic?')) return;
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
  const totalHours = topics.reduce((s, t) => s + (t.instructional_hours || 0), 0);

  return (
    <AppShell activeNav="tos" pageTitle={tos.title}>
      <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/tos" className="btn"><ArrowLeft size={16} /> Back</Link>
              <div>
                <h1 style={{ margin: 0 }}>{tos.title}</h1>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                  {tos.subject_code || tos.subject_name} · {tos.total_items} items
                </p>
              </div>
            </div>
            <div className="page-header-actions">
              <button className="btn btn-primary" onClick={() => setAddingTopic(true)}>
                <Plus size={16} /> Add topic
              </button>
            </div>
          </div>
          <div className="tos-builder">
            {/* Main: topics */}
            <div className="tos-main">
              <h2>Topics ({topics.length})</h2>
              {topics.length === 0 ? (
                <div className="empty-state">
                  <BookOpen size={36} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
                  <h3>No topics yet</h3>
                  <p>Add topics from your syllabus to drive question generation.</p>
                  <button className="btn btn-primary" onClick={() => setAddingTopic(true)}>
                    <Plus size={16} /> Add first topic
                  </button>
                </div>
              ) : (
                <>
                  <ul className="topic-list">
                    {topics.map((t) => (
                      <li key={t.id} className="topic-item">
                        <div className="topic-info">
                          <div className="topic-title">{t.title}</div>
                          <div className="topic-meta">
                            {t.learning_outcomes ? `${t.learning_outcomes.slice(0, 80)}${t.learning_outcomes.length > 80 ? '…' : ''}` : 'No outcomes specified'}
                          </div>
                        </div>
                        <div className="topic-hours">
                          <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {t.instructional_hours}h
                        </div>
                        <button className="btn btn-danger" onClick={() => handleDeleteTopic(t.id)} title="Remove">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)', fontSize: 'var(--text-sm)', color: 'var(--ink-3)' }}>
                    Total instructional hours: <strong>{totalHours}h</strong>
                  </div>
                </>
              )}
            </div>

            {/* Side: Bloom distribution */}
            <div className="tos-side">
              <h2>Bloom distribution</h2>
              <div className="bloom-editor">
                {BLOOM_ORDER.map((k, i) => (
                  <div key={k} className="bloom-weight-row">
                    <span className="bloom-weight-label">{BLOOM_LABELS[k]}</span>
                    <div className="bloom-weight-bar">
                      <div className="bloom-weight-fill" style={{ width: `${tos.bloom_weights?.[k] || 0}%`, background: BLOOM_COLORS[i] }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 'var(--text-sm)', width: 40, textAlign: 'right' }}>
                      {tos.bloom_weights?.[k] || 0}%
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-3)', marginBottom: 8 }}>Target items per Bloom level</div>
                {BLOOM_ORDER.map((k, i) => {
                  const pct = tos.bloom_weights?.[k] || 0;
                  const items = Math.round((pct / 100) * tos.total_items);
                  return (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', padding: '4px 0' }}>
                      <span style={{ color: 'var(--ink-2)' }}>{BLOOM_LABELS[k]}</span>
                      <span style={{ fontWeight: 600, color: BLOOM_COLORS[i] }}>{items} items</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

      <Modal open={addingTopic} title="Add topic" subtitle="Add a topic from your syllabus." onClose={() => setAddingTopic(false)}
        footer={<>
          <button className="btn" onClick={() => setAddingTopic(false)}>Cancel</button>
          <button className="btn btn-primary" form="topic-form" type="submit" disabled={savingTopic}>
            {savingTopic && <span className="btn-spinner" />}Add topic
          </button>
        </>}>
        <form id="topic-form" onSubmit={handleAddTopic} noValidate>
          <div className="form-group">
            <label className="form-label">Title <span className="req">*</span></label>
            <input className="form-input" style={{ paddingLeft: 16 }} value={newTopic.title} maxLength={255} required
              onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Instructional Hours</label>
            <input type="number" className="form-input" style={{ paddingLeft: 16 }} min={0} value={newTopic.instructional_hours}
              onChange={(e) => setNewTopic({ ...newTopic, instructional_hours: Number(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Learning Outcomes</label>
            <textarea className="form-input" style={{ minHeight: 80, padding: '12px 16px', resize: 'vertical' }}
              value={newTopic.learning_outcomes} maxLength={2000}
              onChange={(e) => setNewTopic({ ...newTopic, learning_outcomes: e.target.value })} />
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
