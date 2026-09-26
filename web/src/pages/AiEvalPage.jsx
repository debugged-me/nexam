/**
 * AiEvalPage — AI component evaluation metrics.
 *
 * Data comes from
 * GET /api/ai-eval/summary (generation, similarity, extraction, provider
 * usage, distributions, and the Bloom confusion matrix).
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, CheckCircle, CopyCheck, FileSearch,
  Target, Crosshair, Search, GitMerge, Layers, CircleHelp, Grid3x3,
} from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/analytics.css';

const BLOOM_LEVEL = { remember: 1, understand: 2, apply: 3, analyze: 4, evaluate: 5, create: 6 };
const TYPE_LABELS = { mcq: 'Multiple choice', true_false: 'True / false', matching: 'Matching type', identification: 'Identification' };

function pct(v, digits = 1) {
  return ((Number(v) || 0) * 100).toFixed(digits);
}

export default function AiEvalPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get('/ai-eval/summary')
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load AI evaluation metrics.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return (
      <AppShell activeNav="analytics" pageTitle="AI Evaluation" wide>
        <p className="placeholder">Loading…</p>
      </AppShell>
    );
  }

  const gen = data.generation || {};
  const sim = data.similarity || {};
  const ext = data.extraction || {};
  const providers = data.providers || [];
  const bloomDist = data.bloomDistribution || [];
  const typeDist = data.typeDistribution || [];
  const cm = data.confusionMatrix || {};
  const classes = cm.classes || [];

  return (
    <AppShell activeNav="analytics" pageTitle="AI Evaluation" wide>
      <div className="page-header">
        <div>
          <h1>AI Component Evaluation</h1>
          <p className="page-sub">Quality metrics for AI-generated questions, similarity detection, and material extraction.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Back to Analytics
          </button>
        </div>
      </div>

      <div className="stats-grid mb-3">
        <div className="stat-card">
          <div className="stat-icon green"><Sparkles size={18} /></div>
          <div className="stat-info"><div className="stat-value">{pct(gen.precision)}%</div><div className="stat-label">Generation Precision</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><CheckCircle size={18} /></div>
          <div className="stat-info"><div className="stat-value">{pct(gen.approvalRate)}%</div><div className="stat-label">Approval Rate</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><CopyCheck size={18} /></div>
          <div className="stat-info"><div className="stat-value">{pct(sim.flagRate)}%</div><div className="stat-label">Similarity Flag Rate</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FileSearch size={18} /></div>
          <div className="stat-info"><div className="stat-value">{pct(ext.accuracy)}%</div><div className="stat-label">Extraction Accuracy</div></div>
        </div>
      </div>

      <div className="detail-grid-2 mb-3">
        <div className="card">
          <div className="card-header"><span className="card-title">Question Generation</span></div>
          <div className="card-body">
            <table className="data-table">
              <tbody>
                <tr><td>Total Generated</td><td className="text-right">{gen.totalGenerated || 0}</td></tr>
                <tr><td>Approved</td><td className="text-right"><span className="badge badge-green">{gen.approved || 0}</span></td></tr>
                <tr><td>Rejected</td><td className="text-right"><span className="badge badge-amber">{gen.rejected || 0}</span></td></tr>
                <tr><td>Pending Review</td><td className="text-right">{gen.pending || 0}</td></tr>
                <tr><td><strong>Precision</strong></td><td className="text-right"><strong>{pct(gen.precision, 2)}%</strong></td></tr>
                <tr><td><strong>Approval Rate</strong></td><td className="text-right"><strong>{pct(gen.approvalRate, 2)}%</strong></td></tr>
              </tbody>
            </table>
            <p className="text-muted meta-sm mt-2">Precision = approved / (approved + rejected). A higher precision means the AI generates more usable questions.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Material Extraction</span></div>
          <div className="card-body">
            <table className="data-table">
              <tbody>
                <tr><td>Total Materials</td><td className="text-right">{ext.totalMaterials || 0}</td></tr>
                <tr><td>Processed</td><td className="text-right"><span className="badge badge-green">{ext.processed || 0}</span></td></tr>
                <tr><td>Failed</td><td className="text-right"><span className="badge badge-red">{ext.failed || 0}</span></td></tr>
                <tr><td>Pending</td><td className="text-right">{ext.pending || 0}</td></tr>
                <tr><td><strong>Accuracy</strong></td><td className="text-right"><strong>{pct(ext.accuracy, 2)}%</strong></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="detail-grid-2 mb-3">
        <div className="card">
          <div className="card-header"><span className="card-title">Bloom Level Distribution (AI-generated)</span></div>
          {bloomDist.length === 0 ? (
            <div className="empty-state empty-state-md"><Layers size={24} aria-hidden="true" /><p>No AI-generated questions yet.</p></div>
          ) : (
            <div className="table-wrap table-bare">
              <table className="data-table">
                <thead><tr><th>Bloom Level</th><th>Count</th></tr></thead>
                <tbody>
                  {bloomDist.map((b) => (
                    <tr key={b.bloom}>
                      <td><span className="g-bloom" data-level={BLOOM_LEVEL[b.bloom] || 0}>{b.bloom ? b.bloom[0].toUpperCase() + b.bloom.slice(1) : '—'}</span></td>
                      <td className="text-muted">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Question Type Distribution</span></div>
          {typeDist.length === 0 ? (
            <div className="empty-state empty-state-md"><CircleHelp size={24} aria-hidden="true" /><p>No AI-generated questions yet.</p></div>
          ) : (
            <div className="table-wrap table-bare">
              <table className="data-table">
                <thead><tr><th>Type</th><th>Count</th></tr></thead>
                <tbody>
                  {typeDist.map((t) => (
                    <tr key={t.type}>
                      <td>{TYPE_LABELS[t.type] || t.type}</td>
                      <td className="text-muted">{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {providers.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Provider Usage</span></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Provider</th><th>Model</th><th>Questions Generated</th></tr></thead>
              <tbody>
                {providers.map((p, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-gray">{p.provider || 'unknown'}</span></td>
                    <td className="text-muted">{p.model || '—'}</td>
                    <td>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card mb-3">
        <div className="card-header">
          <span className="card-title">Bloom's Taxonomy Classification — Confusion Matrix</span>
          {cm.sampleSize > 0 && <span className="text-muted meta-sm">Sample size: {cm.sampleSize} reviewed questions</span>}
        </div>
        <div className="card-body">
          {cm.sampleSize > 0 ? (
            <>
              <div className="stats-grid mb-3">
                <div className="stat-card">
                  <div className="stat-icon green"><Target size={18} /></div>
                  <div className="stat-info"><div className="stat-value">{pct(cm.overall?.accuracy)}%</div><div className="stat-label">Accuracy</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon blue"><Crosshair size={18} /></div>
                  <div className="stat-info"><div className="stat-value">{pct(cm.overall?.precision)}%</div><div className="stat-label">Precision</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon amber"><Search size={18} /></div>
                  <div className="stat-info"><div className="stat-value">{pct(cm.overall?.recall)}%</div><div className="stat-label">Recall</div></div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon purple"><GitMerge size={18} /></div>
                  <div className="stat-info"><div className="stat-value">{pct(cm.overall?.f1)}%</div><div className="stat-label">F1-Score</div></div>
                </div>
              </div>

              <p className="text-muted meta-sm mb-2">
                Compares the AI's predicted Bloom level against the instructor's confirmed Bloom level for each reviewed question.
                Diagonal cells (highlighted) are correct predictions; off-diagonal cells are misclassifications.
              </p>

              {classes.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table confusion-matrix-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="cm-axis-label">AI Predicted ↓</th>
                        <th colSpan={classes.length}>Instructor Confirmed →</th>
                      </tr>
                      <tr>
                        {classes.map((cls) => <th key={cls} className="cm-col-header">{cls[0].toUpperCase() + cls.slice(1)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((predicted) => (
                        <tr key={predicted}>
                          <td className="cm-row-header">{predicted[0].toUpperCase() + predicted.slice(1)}</td>
                          {classes.map((actual) => {
                            const cell = cm.matrix?.[predicted]?.[actual] ?? 0;
                            const cls = `cm-cell${predicted === actual ? ' cm-diagonal' : ''}${cell === 0 ? ' cm-zero' : ''}`;
                            return <td key={actual} className={cls}>{cell > 0 ? cell : '·'}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(cm.perClass || []).length > 0 && (
                <>
                  <h3 className="mt-3 mb-1">Per-Class Metrics</h3>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Bloom Level</th><th>TP</th><th>FP</th><th>FN</th><th>TN</th>
                          <th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1-Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cm.perClass.map((pc) => (
                          <tr key={pc.bloom}>
                            <td><span className="g-bloom" data-level={BLOOM_LEVEL[pc.bloom] || 0}>{pc.bloom[0].toUpperCase() + pc.bloom.slice(1)}</span></td>
                            <td className="text-right">{pc.tp}</td>
                            <td className="text-right">{pc.fp}</td>
                            <td className="text-right">{pc.fn}</td>
                            <td className="text-right">{pc.tn}</td>
                            <td className="text-right">{pct(pc.accuracy, 2)}%</td>
                            <td className="text-right">{pct(pc.precision, 2)}%</td>
                            <td className="text-right">{pct(pc.recall, 2)}%</td>
                            <td className="text-right"><strong>{pct(pc.f1, 2)}%</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-state empty-state-md">
              <Grid3x3 size={24} aria-hidden="true" />
              <p>No reviewed AI questions yet. The confusion matrix will appear once instructors review and approve or reject AI-generated questions, confirming or correcting the AI's Bloom level assignment.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
