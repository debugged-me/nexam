/**
 * Similarity/dedup gate for approving a draft. Returns a human-readable block
 * reason, or null when the draft clears the gate.
 *
 * `ignoreSimilarityFailure` lifts ONLY a recorded provider failure — the
 * explicit instructor override for outages. A failed check carries no
 * information, so blocking on it just freezes manual work. Pending checks and
 * flagged matches DO carry information: a pending check might still return a
 * match, and a flag means a probable duplicate needs a keep/reject decision.
 * Those stay hard gates even under the override.
 */
export function similarityGate(question, { ignoreSimilarityFailure = false } = {}) {
  if (question.similarity_error) {
    if (!ignoreSimilarityFailure) return `Similarity check failed: ${question.similarity_error}`;
    // The failed check left checked_at NULL — that null is failure residue,
    // not a pending check, so the pending gate must not re-block the row.
  } else if (!question.similarity_checked_at) {
    return 'Similarity check is still pending. Wait for it to complete before approval.';
  }
  if (question.similarity_flag === 'flagged') return 'Review and decide the similarity match before approval.';
  if (question.similarity_flag === 'rejected' || question.status === 'rejected') return 'Rejected questions cannot be approved.';
  return null;
}
