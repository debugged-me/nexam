import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, BrainCircuit, CopyCheck, ChevronDown, ArrowUpRight } from 'lucide-react';
import api from '../lib/api.js';
import { jobJson, similaritySummary } from '../lib/pipelineRun.js';

export default function PipelineChecks({ job, drafts = [], drafted = 0 }) {
  const payload = jobJson(job?.payload);
  const generation = job?.type === 'generate';
  const single = job?.type === 'similarity' ? payload.questionId : null;
  const idsKey = JSON.stringify(single ? [single] : generation ? drafts.map((draft) => draft.id).filter(Boolean) : []);
  const endpoint = single ? '/questions/' + encodeURIComponent(single)
    : generation && payload.tosId && idsKey !== '[]' ? '/questions?tos_id=' + encodeURIComponent(payload.tosId) : null;
  const key = `${job?.id || ''}:${idsKey}`;
  const [snapshot, setSnapshot] = useState(null);
  useEffect(() => {
    if (!endpoint) return undefined;
    let alive = true;
    let timer;
    async function load() {
      try {
        const data = await api.get(endpoint);
        if (alive) setSnapshot({ key, summary: similaritySummary(JSON.parse(idsKey), data.questions || (data.question ? [data.question] : [])) });
      } catch (error) {
        if (alive) setSnapshot({ key, error: error.message });
      } finally {
        // Similarity may finish after the generation stream has already ended.
        if (alive) timer = setTimeout(load, 10000);
      }
    }
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [endpoint, key, idsKey]);
  const current = snapshot?.key === key ? snapshot : null;
  const summary = current?.summary;
  const counts = summary ? ['clear', 'flagged', 'pending', 'failed', 'rejected', 'unavailable']
    .filter((state) => summary[state]).map((state) => `${summary[state]} ${state}`).join(' · ') : '';
  const label = current?.error ? 'Status unavailable'
    : summary ? counts || 'No saved questions'
    : endpoint ? 'Loading checks…'
    : generation ? (drafted > 0 ? 'Run details unavailable' : 'No saved questions')
    : single ? 'Status unavailable' : 'After questions are saved';
  const attention = !!(current?.error || summary?.flagged || summary?.failed || summary?.unavailable);
  return <div className="pc-checks" aria-label="Constraints and similarity checks" data-tour="pipe-checks">
    <details className="pc-check">
      <summary><ShieldCheck size={18} /><span><strong>Constraints</strong><small>Source · format · Bloom</small></span><ChevronDown size={14} /></summary>
      <p>Question generation requires a finalized blueprint and supporting lessons. A syllabus alone is not answer evidence. Invalid formats, outline-only questions and unsupported claims are held; an independent reviewer must confirm the requested Bloom level.</p>
    </details>
    <details className="pc-check">
      <summary><BrainCircuit size={18} /><span><strong>Independent check</strong><small>Blind answer verification</small></span><ChevronDown size={14} /></summary>
      <p>A different model solves the draft without seeing its answer key. Its answer must agree; missing independent verification holds the draft. These are required rules, not a claim that this selected task passed them.</p>
    </details>
    <details className="pc-check" data-attention={attention || undefined}>
      <summary><CopyCheck size={18} /><span><strong>Similarity check</strong><small aria-live="polite">{label}</small></span><ChevronDown size={14} /></summary>
      <p>{!generation && !single ? 'Material processing does not run question similarity. Saved questions are checked against the approved institution bank before instructor approval.'
        : 'Current status of this run’s loaded saved questions, refreshed every 10 seconds. Pending and flagged matches block approval. A failed check needs retry or an explicit instructor override; “clear” means no unresolved match, not proof of originality or accuracy.'}</p>
      {current?.error && <p role="status">Could not load check results. Open Review drafts to inspect them.</p>}
      <Link to={'/questions/review' + (job?.subject_id ? '?subject_id=' + encodeURIComponent(job.subject_id) : '')}>Review questions <ArrowUpRight size={14} /></Link>
    </details>
  </div>;
}
