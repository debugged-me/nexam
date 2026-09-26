/**
 * ExamsPage — list of exams with create/edit/delete.
 *
 * React exam list with shared grid controls and row actions.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, FileCheck, Info, Eye, Ellipsis } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import api, { ApiError } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import '../styles/exams.css';

export default function ExamsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState(null);

  const load = useCallback(() => {
    api.get('/exams')
      .then((data) => setExams(data.exams))
      .catch((err) => toast.error(err.message || 'Could not load exams.'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(exam) {
    if (!confirm(`Delete exam "${exam.title}"? This cannot be undone.`)) return;
    try { await api.del(`/exams/${exam.id}`); toast.success('Exam deleted.'); load(); }
    catch (err) { toast.error(err instanceof ApiError ? err.message : 'Delete failed.'); }
  }

  return (
    <AppShell activeNav="exams" pageTitle="Exams" wide>
      <header className="list-head">
        <div className="list-head-main">
          <h1 className="list-head-title">
            Exams
            {exams && exams.length > 0 && (
              <span className="list-head-count">{exams.length}</span>
            )}
          </h1>
          <details className="list-head-info">
            <summary aria-label="About exams"><Info size={16} /></summary>
            <p>Draft and published papers assembled from your question bank.</p>
          </details>
        </div>
        <div className="list-head-actions">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      </header>

      {exams === null ? (
        <p className="placeholder">Loading…</p>
      ) : exams.length === 0 ? (
        <div className="empty-state">
          <h4>No exams yet</h4>
          <p>Start from a blank paper, or generate one from a blueprint so the Bloom spread is decided for you.</p>
          <button className="btn btn-primary" onClick={() => navigate('/exams/new')}>
            <Plus size={16} /> New exam
          </button>
        </div>
      ) : (
        <div className="dataset">
          <div className="dataset-scroll">
            <table className="grid datatable" data-grid="exams" data-grid-label="exams">
              <caption className="sr-only">Exams in your workspace</caption>
              <thead>
                <tr>
                  <th className="col-select wp-4">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="col-primary wp-31" data-name="Exam" data-locked>Exam</th>
                  <th className="wp-17" data-name="Subject">Subject</th>
                  <th className="wp-11" data-name="Format">Format</th>
                  <th className="wp-11" data-name="Status">Status</th>
                  <th className="is-num wp-8" data-name="Items">Items</th>
                  <th className="wp-13" data-name="Updated">Updated</th>
                  <th className="col-actions wp-5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => {
                  const count = e.question_count || 0;
                  const published = e.status === 'published';
                  const print = e.format === 'print';
                  const touched = e.updated_at || e.created_at;
                  const meta = [];
                  if (e.duration_minutes) meta.push(`${e.duration_minutes} min`);
                  meta.push(`${count} ${count === 1 ? 'item' : 'items'}`);
                  return (
                    <tr key={e.id} data-id={e.id}>
                      <td className="col-select" />
                      <td>
                        <span className="g-primary">
                          <Link to={`/exams/${e.id}`} className="g-title">{e.title}</Link>
                          <span className="g-meta">{meta.join(' · ')}</span>
                        </span>
                      </td>
                      <td data-order={e.subject_name || ''} data-filter={e.subject_name || ''}>
                        {e.subject_name ? (
                          <Link to={`/subjects`} className="g-link" title={e.subject_name}>{e.subject_name}</Link>
                        ) : (
                          <span className="g-mute">—</span>
                        )}
                      </td>
                      <td data-filter={print ? 'Print' : 'Digital'}>
                        <span className="g-inline">
                          {print ? <FileCheck size={14} /> : <FileCheck size={14} />}
                          {print ? 'Print' : 'Digital'}
                        </span>
                      </td>
                      <td data-order={published ? 1 : 0} data-filter={published ? 'Published' : 'Draft'}>
                        <span className={`g-state ${published ? 'is-live' : 'is-draft'}`}>
                          {published ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="is-num" data-order={count}>
                        <span className={`g-count${count ? '' : ' is-zero'}`}>{count || '—'}</span>
                      </td>
                      <td className="g-mute" data-order={touched || ''}>
                        {touched ? new Date(touched).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="col-actions">
                        <details className="g-menu">
                          <summary className="g-menu-trigger" aria-label={`Actions for ${e.title}`}>
                            <Ellipsis size={16} />
                          </summary>
                          <div className="g-menu-panel">
                            <Link to={`/exams/${e.id}`} className="g-menu-item"><Eye size={15} /> Open</Link>
                            <Link to={`/exams/${e.id}/edit`} className="g-menu-item"><Pencil size={15} /> Edit</Link>
                            <div className="g-menu-sep" />
                            <button type="button" className="g-menu-item is-danger" onClick={() => handleDelete(e)}>
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
