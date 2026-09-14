/**
 * SimilarityReviewPage — shows a flagged question alongside its near-duplicate
 * candidates so the instructor can decide whether to keep or reject it.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, X, ArrowLeft } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/questions.css';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };

export default function SimilarityReviewPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    api.get(`/questions/${id}/similarity`)
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load similarity review.'));
  }, [id, toast]);

  async function decide(decision) {
    setDeciding(true);
    try {
      await api.post(`/questions/${id}/similarity/decide`, { decision });
      toast.success(decision === 'keep' ? 'Question kept.' : 'Question rejected.');
      navigate('/questions');
    } catch (err) {
      toast.error(err.message || 'Could not record decision.');
    } finally {
      setDeciding(false);
    }
  }

  if (!data) return <AppShell activeNav="questions" pageTitle="Similarity Review"><p className="placeholder">Loading…</p></AppShell>;
  const { question, matches } = data;

  return (
    <AppShell activeNav="questions" pageTitle="Similarity Review">
      <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link to="/questions" className="btn"><ArrowLeft size={16} /> Back</Link>
              <h1>Similarity review</h1>
            </div>
            <div className="page-header-actions">
              <button className="btn" onClick={() => decide('keep')} disabled={deciding}>
                <Check size={16} /> Keep question
              </button>
              <button className="btn btn-danger" onClick={() => decide('reject')} disabled={deciding}>
                <X size={16} /> Reject question
              </button>
            </div>
          </div>
          <div className="sim-layout">
            <div className="sim-card">
              <h2>Question under review</h2>
              <div className="sim-question-stem">{question.stem}</div>
              <div className="sim-question-meta">
                {question.subject_name} · {question.type} · {question.bloom ? BLOOM_LABELS[question.bloom] : '—'} · {question.topic || 'No topic'}
              </div>
              {Array.isArray(question.options) && question.options.length > 0 && (
                <ul style={{ margin: '12px 0', paddingLeft: 20, fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
                  {question.options.map((opt, i) => (
                    <li key={i} style={{ fontWeight: opt === question.answer ? 600 : 400 }}>
                      {opt}{opt === question.answer ? ' (correct)' : ''}
                    </li>
                  ))}
                </ul>
              )}
              {question.answer && !Array.isArray(question.options) && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-2)' }}>
                  <strong>Answer:</strong> {question.answer}
                </div>
              )}
            </div>

            <div className="sim-card">
              <h2>Potential duplicates ({matches.length})</h2>
              {matches.length === 0 ? (
                <p className="sim-empty">No similarity matches found for this question.</p>
              ) : (
                matches.map((m) => {
                  const pct = Math.round((m.score || 0) * 100);
                  const cls = pct >= 80 ? 'high' : pct >= 60 ? 'med' : 'low';
                  return (
                    <div key={m.result_id} className="sim-match">
                      <div className="sim-match-head">
                        <span className={`sim-score ${cls}`}>{pct}%</span>
                        {m.decision && <span className={`q-badge ${m.decision === 'keep' ? 'active' : 'rejected'}`}>{m.decision}</span>}
                      </div>
                      <div className="sim-match-stem">{m.match_stem || '(question deleted)'}</div>
                      <div className="sim-match-meta">
                        {m.match_type} · {m.match_bloom ? BLOOM_LABELS[m.match_bloom] : '—'} · {m.match_status}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
    </AppShell>
  );
}
