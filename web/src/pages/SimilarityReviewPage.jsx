import '../styles/similarity.css';
/**
 * SimilarityReviewPage — shows a flagged question alongside its near-duplicate
 * candidates so the instructor can decide whether to keep or reject it.
 *
 * Instructor review screen for semantic similarity matches.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Check, Trash2, ArrowLeft } from 'lucide-react';
import RichText from '../components/RichText.jsx';
import TextDiff from '../components/TextDiff.jsx';
import { wordDiff } from '../lib/wordDiff.js';
import { useToast } from '../components/Toast.jsx';
import EmptyStateArt from '../components/EmptyStateArt.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { PageLoader } from '../components/Loaders.jsx';

const BLOOM_LABELS = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create' };
const BLOOM_LEVELS = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };

export default function SimilarityReviewPage() {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [deciding, setDeciding] = useState(false);
  // Matches open with word differences highlighted; "Plain" shows each bank
  // question as written (with math typeset).
  const [showDiff, setShowDiff] = useState(true);

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

  if (!data) return <AppShell pageClass="similarity" activeNav="questions" pageTitle="Similarity Review"><PageLoader label="Checking similar questions…" /></AppShell>;

  const { question, matches } = data;
  const bl = BLOOM_LEVELS;
  const questionLevel = question.bloom ? bl[question.bloom] || 0 : 0;

  return (
    <AppShell pageClass="similarity" activeNav="questions" pageTitle="Similarity Review">
      <div className="page-header">
        <div className="page-header-actions">
          <Link to="/questions" className="btn btn-outline btn-sm">
            <ArrowLeft size={16} /> Back to Questions
          </Link>
        </div>
      </div>

      {/* Flagged Question card */}
      <div className="card mb-3" data-tour="sim-flagged">
        <div className="card-header">
          <span className="card-title">Flagged Question</span>
          {question.similarity_score != null && (
            <span className="sim-score" data-band={question.similarity_score >= 0.9 ? 'high' : question.similarity_score >= 0.75 ? 'mid' : 'low'}>
              <span className="sim-score-track" aria-hidden="true"><i style={{ width: `${Math.min(100, question.similarity_score * 100)}%` }} /></span>
              {(question.similarity_score * 100).toFixed(1)}% highest match
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="sim-question">
            <div className="sim-question-meta">
              <span className="badge badge-gray">{question.type ? question.type.charAt(0).toUpperCase() + question.type.slice(1) : '—'}</span>
              {questionLevel > 0 && (
                <span className="g-bloom" data-level={questionLevel}>
                  {BLOOM_LABELS[question.bloom] || '—'}
                </span>
              )}
              {question.topic && (
                <span className="text-muted meta-sm">{question.topic}</span>
              )}
            </div>
            <RichText as="div" className="sim-question-stem" text={question.stem} />
            {question.type === 'mcq' && Array.isArray(question.options) && question.options.length > 0 ? (
              <ul className="sim-question-options">
                {question.options.map((opt, i) => (
                  <li key={i} className={opt === question.answer ? 'is-correct' : ''}>
                    {String.fromCharCode(65 + i)}. {opt}
                    {opt === question.answer && <Check size={14} />}
                  </li>
                ))}
              </ul>
            ) : (
              question.answer && (
                <div className="sim-question-answer">
                  <strong>Answer:</strong> {question.answer}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Similar Questions card */}
      {!matches || matches.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state empty-state-md">
              <EmptyStateArt size={88} art="merge" tone={5} />
              <p>No similar questions found in the database. The flag may have been cleared.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card mb-3" data-tour="sim-matches">
          <div className="card-header">
            <div>
              <span className="card-title">Similar Questions in the Bank</span>
              <p className="card-sub">{matches.length} match{matches.length > 1 ? 'es' : ''}</p>
            </div>
            <div className="sim-view" role="group" aria-label="How to show matches">
              <button type="button" aria-pressed={showDiff} onClick={() => setShowDiff(true)}>Highlight differences</button>
              <button type="button" aria-pressed={!showDiff} onClick={() => setShowDiff(false)}>Plain</button>
            </div>
          </div>
          {showDiff && (
            <div className="sim-legend" aria-hidden="true">
              <span><ins className="text-diff-add">word</ins> only in this draft</span>
              <span><del className="text-diff-del">word</del> only in the bank question</span>
            </div>
          )}
          <div className="card-body">
            <div className="sim-matches">
              {matches.map((m, idx) => {
                const matchLevel = m.match_bloom ? bl[m.match_bloom] || 0 : 0;
                const matchStem = m.match_stem || m.stem || '';
                const overlap = matchStem ? wordDiff(matchStem, question.stem).wordOverlap : null;
                return (
                  <div key={m.result_id || idx} className="sim-match">
                    <div className="sim-match-header">
                      <span className="badge badge-gray">{m.match_type ? m.match_type.charAt(0).toUpperCase() + m.match_type.slice(1) : '—'}</span>
                      {matchLevel > 0 && (
                        <span className="g-bloom" data-level={matchLevel}>
                          {BLOOM_LABELS[m.match_bloom] || '—'}
                        </span>
                      )}
                      <span className="sim-score sim-match-score" data-band={(m.score || 0) >= 0.9 ? 'high' : (m.score || 0) >= 0.75 ? 'mid' : 'low'}>
                        <span className="sim-score-track" aria-hidden="true"><i style={{ width: `${Math.min(100, (m.score || 0) * 100)}%` }} /></span>
                        {((m.score || 0) * 100).toFixed(1)}% similar
                      </span>
                      {overlap != null && (
                        <span className="sim-overlap" title="Share of words both stems have in common">
                          {Math.round(overlap * 100)}% same wording
                        </span>
                      )}
                      {m.decision && (
                        <span className="badge badge-gray">{m.decision.charAt(0).toUpperCase() + m.decision.slice(1)}</span>
                      )}
                    </div>
                    {!matchStem ? (
                      <div className="sim-match-stem">—</div>
                    ) : showDiff ? (
                      <TextDiff className="sim-match-stem" from={matchStem} to={question.stem} />
                    ) : (
                      <RichText as="div" className="sim-match-stem" text={matchStem} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Decision card */}
      <div className="card" data-tour="sim-decision">
        <div className="card-header">
          <span className="card-title">Decision</span>
        </div>
        <div className="card-body">
          <div className="sim-decision-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => decide('keep')}
              disabled={deciding}
            >
              <Check size={16} /> Keep — Not a Duplicate
            </button>
            <button
              type="button"
              className="btn btn-outline is-danger"
              onClick={() => decide('reject')}
              disabled={deciding}
            >
              <Trash2 size={16} /> Reject — It's a Duplicate
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
