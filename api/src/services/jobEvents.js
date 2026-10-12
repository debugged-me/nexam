/**
 * In-process job event bus — lets the worker push live updates (progress,
 * freshly stored drafts, status changes) to open SSE streams instantly.
 *
 * The worker runs inside the API process (server.js → worker.start()), so a
 * plain EventEmitter reaches every stream. Streams still re-read the job row
 * on a timer, so a missed event only delays an update — it never loses one.
 */
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open stream — no fixed ceiling

/** Publish `event` ({ kind, ... }) to every stream watching `jobId`. */
export function publishJobEvent(jobId, event) {
  if (jobId) bus.emit(String(jobId), event);
}

/** Watch one job's events; returns the unsubscribe function. */
export function subscribeJobEvents(jobId, listener) {
  const key = String(jobId);
  bus.on(key, listener);
  return () => bus.off(key, listener);
}
