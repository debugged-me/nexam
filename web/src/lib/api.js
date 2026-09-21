/**
 * api.js — thin fetch wrapper for the Nexam Node API.
 *
 * - Adds the JWT (from localStorage) to every request as Authorization: Bearer.
 * - Throws a structured ApiError on non-2xx responses, with the server's
 *   `error` message and status code.
 * - Exposes get/post/put/del helpers that return parsed JSON.
 */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const TOKEN_KEY = 'nexam.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Abort requests that never settle so UI spinners can't hang forever.
  // The timer stays armed through res.json() too — a response that stalls
  // mid-body (proxy hiccup) would otherwise hang past the timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

export default api;
