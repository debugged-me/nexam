/**
 * Bloom configuration for blueprints that can only produce objective items.
 *
 * Create requires the learner to produce original work, so it cannot be
 * assessed by MCQ, true/false, matching or identification. Keep the level in
 * the stored shape for reporting compatibility, but never allocate items to it.
 */
export const BLOOM_LEVELS = Object.freeze([
  'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create',
]);

export const DEFAULT_OBJECTIVE_BLOOM = Object.freeze({
  remember: 15,
  understand: 20,
  apply: 25,
  analyze: 20,
  evaluate: 20,
  create: 0,
});

export function objectiveCreateBlockReason(weights) {
  if (Number(weights?.create || 0) <= 0) return null;
  return 'Create must be 0% for an objective-question blueprint. Use a separate constructed-performance assessment for original work, then redistribute this percentage before finalizing.';
}
