/**
 * api.js — thin fetch wrapper for the Nexam Node API.
 *
 * - Adds the JWT (from localStorage) to every request as Authorization: Bearer.
 * - Throws a structured ApiError on non-2xx responses, with the server's
 *   `error` message and status code.
 * - Exposes get/post/put/del helpers that return parsed JSON.
 * - Remembers the last GET response per path (in memory only) so pages can
 *   render a revisited screen instantly via api.peek() and refresh quietly.
 * - Counts in-flight requests so the shell can show a background spinner.
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const TOKEN_KEY = 'nexam.token';
const CACHE_LIMIT = 80;

// path -> last successful GET payload. Never persisted; cleared on every
// token change so one instructor's data can't seed another's screens.
const cache = new Map();
// path -> pending GET promise, so identical concurrent GETs share one request.
const inflight = new Map();
// Bumped on every token change and every write; a GET that started before
// either is still returned to its caller but never cached.
let epoch = 0;

let activeRequests = 0;
const activityListeners = new Set();

function setActive(delta) {
  activeRequests += delta;
  activityListeners.forEach((listener) => listener());
}

export function subscribeActivity(listener) {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

export function getActivity() {
  return activeRequests;
}

function remember(path, data) {
  cache.delete(path);
  cache.set(path, data);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function resourceOf(path) {
  return path.split(/[/?]/)[1] || '';
}

/** Drop cached GETs a write may have changed: the same top-level resource
 *  (e.g. `/exams/5` → `/exams`, `/exams/5`) plus the dashboard summary.
 *  Anything else is refreshed in the background the next time it's shown. */
function invalidate(path) {
  epoch += 1;
  const resource = resourceOf(path);
  for (const key of [...cache.keys()]) {
    const keyResource = resourceOf(key);
    if (keyResource === resource || keyResource === 'dashboard') cache.delete(key);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  epoch += 1;
  cache.clear();
  inflight.clear();
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const REQUEST_TIMEOUT_MS = 30000;

async function request(method, path, body, { quiet = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Abort requests that never settle so UI spinners can't hang forever.
  // The timer stays armed through res.json() too — a response that stalls
  // mid-body (proxy hiccup) would otherwise hang past the timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (!quiet) setActive(1);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
        data = null; // malformed JSON — treat as empty body
      }
    }

    if (!res.ok) {
      const message = data?.error || `Request failed (${res.status}).`;
      throw new ApiError(message, res.status, data);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err?.name === 'AbortError') {
      throw new ApiError('The request timed out. Is the API server running?', 0, null);
    }
    throw new ApiError('Network error — could not reach the server.', 0, null);
  } finally {
    clearTimeout(timer);
    if (!quiet) setActive(-1);
  }
}

function get(path, options) {
  const pending = inflight.get(path);
  if (pending) return pending;
  const startedIn = epoch;
  const promise = request('GET', path, undefined, options)
    .then((data) => {
      if (startedIn === epoch) remember(path, data);
      return data;
    })
    .finally(() => {
      if (inflight.get(path) === promise) inflight.delete(path);
    });
  inflight.set(path, promise);
  return promise;
}

async function write(method, path, body) {
  const data = await request(method, path, body);
  invalidate(path);
  return data;
}

/** Upload a single file as multipart. No JSON content-type so the browser
 *  sets the multipart boundary. Field name is `file`, matching the API. */
async function uploadFile(path, file) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const fd = new FormData();
  fd.append('file', file);
  setActive(1);
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: fd });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw new ApiError(data?.error || `Upload failed (${res.status}).`, res.status, data);
    invalidate(path);
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError('Network error — could not reach the server.', 0, null);
  } finally {
    setActive(-1);
  }
}

/** GET a binary resource (e.g. profile photo) with the auth header and
 *  return an object URL. Returns null on 404; throws on other failures. */
async function getBlob(path) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`Request failed (${res.status}).`, res.status, null);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export const api = {
  get: (path) => get(path),
  post: (path, body) => write('POST', path, body),
  put: (path, body) => write('PUT', path, body),
  del: (path) => write('DELETE', path),
  uploadFile,
  getBlob,
  /** Last cached GET payload for `path`, or undefined. Use it to seed state. */
  peek: (path) => cache.get(path),
  /** Warm the cache for a screen that's about to open, without the busy indicator. */
  prefetch: (path) => {
    if (!getToken() || cache.has(path) || inflight.has(path)) return;
    get(path, { quiet: true }).catch(() => {});
  },
  /** Forget cached GETs related to `path` after a write made outside `api`. */
  invalidate,
};

export default api;
