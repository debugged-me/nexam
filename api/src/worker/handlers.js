/**
 * Job handler registry.
 *
 * Each handler receives the job row (with parsed payload) and returns a
 * result that is stored in ai_jobs.result. Handlers are registered by
 * job type and dispatched by the worker loop.
 *
 * Handlers are added incrementally as phases are built:
 *   - extract        (Phase 1)
 *   - embed          (Phase 2)
 *   - syllabus_tos   (Phase 3)
 *   - generate       (Phase 4)
 *   - similarity     (Phase 6)
 */
const handlers = {};

export function register(type, fn) {
  handlers[type] = fn;
}

export function getHandler(type) {
  return handlers[type] || null;
}

export function listTypes() {
  return Object.keys(handlers);
}

export default { register, getHandler, listTypes };
