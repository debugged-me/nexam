import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { start as startWorker } from './worker/worker.js';
import './worker/register.js'; // side-effect: registers all job handlers

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (env.deployment.trustProxy) app.set('trust proxy', 1);

// ── Security & parsing ──────────────────────────────────
app.use(helmet());

// TLS is normally terminated by the production reverse proxy. Reject plain
// HTTP application traffic after proxy headers have been trusted.
if (env.isProd && env.deployment.enforceHttps) {
  app.use((req, res, next) => {
    if (req.secure) return next();
    return res.status(426).json({ error: 'HTTPS is required.' });
  });
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow the React web app and approved mobile/web origins.
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / server-to-server / non-browser clients (no Origin header).
      if (!origin || env.cors.allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);

// Request logging (skip in test).
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
}

// ── Routes ──────────────────────────────────────────────
if (!env.deployment.serveWeb) {
  app.get('/', (_req, res) => {
    res.json({ service: 'nexam-api', version: '1.0.0', docs: '/api/health' });
  });
}
app.use('/api', routes);

// In production, the Node process serves the compiled React single-page app.
// Development continues to use Vite on port 5173 with its /api proxy.
const webDist = path.resolve(__dirname, env.deployment.webDistDir);
if (env.deployment.serveWeb && fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(express.static(webDist, { index: false, maxAge: env.isProd ? '30d' : 0 }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    if (!req.accepts('html')) return next();
    return res.sendFile(path.join(webDist, 'index.html'));
  });
}

// ── Fallback handlers (order matters) ───────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[nexam-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
  // Start the background AI job worker.
  startWorker();
});

export default app;
