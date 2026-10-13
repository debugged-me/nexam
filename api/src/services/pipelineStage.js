/**
 * Wizard stage for a subject's syllabus pipeline.
 *
 * Extraction enqueues blueprint drafting (syllabus_tos) and indexing (embed)
 * side by side. The blueprint reads the extracted syllabus text directly, so
 * its draft, review and finalization never wait on — or fail with — the
 * vector index. Only question generation retrieves indexed passages, so it
 * is the one step that waits for indexing.
 */
const busy = (job) => job?.status === 'queued' || job?.status === 'running';

export function pipelineStage({ syllabus, embedJob, tosJob, generateJob, tos, questionStats = {} }) {
  if (!syllabus) return 'upload';
  if (syllabus.status === 'pending' || syllabus.status === 'processing') return 'extracting';
  if (syllabus.status === 'failed') return 'extract_failed';
  if (syllabus.status !== 'processed') return 'upload';

  if (busy(tosJob)) return 'tos_generating';
  if (tosJob?.status === 'failed') return 'tos_failed';
  if (!tos) {
    if (busy(embedJob)) return 'embedding';
    if (embedJob?.status === 'failed') return 'embed_failed';
    return 'processed';
  }
  if (tos.status !== 'finalized') return 'tos_review';

  if (busy(generateJob)) return 'question_generating';
  if (generateJob?.status === 'failed') return 'generate_failed';
  if (generateJob?.status === 'done') {
    const drafts = Number(questionStats.draft) || 0;
    const approved = Number(questionStats.approved) || 0;
    if (drafts > 0) return 'review';
    if (approved > 0) return 'exam_ready';
    // The run finished without saving a draft: every cell was refused for
    // lacking substantive source evidence or failing review. Say so instead
    // of showing an empty review queue.
    return 'generate_short';
  }
  if (busy(embedJob)) return 'embedding';
  if (embedJob?.status === 'failed') return 'embed_failed';
  return 'ready_to_generate';
}

export default { pipelineStage };
