import env from '../config/env.js';

/**
 * Central error handler — must be registered last (after all routes).
 * Converts thrown errors and validation failures into a consistent JSON shape.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error.';

  // Never leak stack traces in production.
  const body = { error: message };
  if (!env.isProd && status >= 500) body.stack = err.stack;

  if (status >= 500) console.error('[error]', err);
  res.status(status).json(body);
}

/**
 * 404 handler for unmatched routes — registered after routes, before errorHandler.
 */
// eslint-disable-next-line no-unused-vars
export function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}
