/**
 * ItemAnalysisPage — per-question response distributions and difficulty.
 *
 * Mirrors application/views/analytics/items.php. Data comes from
 * GET /api/analytics/exam/:examId/items.
 */
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ListChecks } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/analytics.css';

const DIFF_CLASS = { easy: 'green', medium: 'amber', hard: 'red' };

export default function ItemAnalysisPage() {
  const { examId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    api.get(`/analytics/exam/${examId}/items`)
      .then((d) => setItems(d.items || []))
      .catch((err) => {
        toast.error(err.message || 'Item analysis not found.');
        navigate('/analytics');
      });
  }, [examId, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppShell activeNav="analytics" pageTitle="Item Analysis" wide>
      <div className="page-header">
        <div>
          <h1>Item Analysis</h1>
          <p className="page-sub">Response distributions and difficulty per question.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/analytics')}>
            <ArrowLeft size={14} /> Back to Analytics
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="placeholder">Loading…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <ListChecks size={32} aria-hidden="true" />
          <h2>No item data yet</h2>
          <p>Item-level analysis appears once OMR answer sheets have been scanned for this exam.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Question Performance</span>
            <span className="text-muted meta-sm">{items.length} items</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-num">#</th>
                  <th>Correct Answer</th>
                  <th>Correct Rate</th>
                  <th>Difficulty</th>
                  <th>Responses</th>
                  <th>Ambiguous</th>
                  <th>Distribution</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.itemNumber}>
                    <td className="text-muted">{item.itemNumber}</td>
                    <td><span className="badge badge-gray">{item.correctAnswer || '—'}</span></td>
                    <td>
                      <div className="correct-rate-bar">
                        <div className="correct-rate-fill" style={{ width: `${item.correctRate}%` }} />
                        <span className="correct-rate-text">{item.correctRate}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${DIFF_CLASS[item.difficulty] || 'gray'}`}>
                        {item.difficulty ? item.difficulty[0].toUpperCase() + item.difficulty.slice(1) : '—'}
                      </span>
                    </td>
                    <td className="text-muted">{item.totalResponses}</td>
                    <td className="text-muted">{item.ambiguousCount}</td>
                    <td>
                      <div className="answer-dist">
                        {(item.answerDistribution || []).map((ad, i) => (
                          <span className="answer-dist-item" key={i} title={`${ad.marked_answer ?? 'blank'}: ${ad.count}`}>
                            <span className="answer-dist-letter">{ad.marked_answer ?? '—'}</span>
                            <span className="answer-dist-count">{ad.count}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
