import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import routes from './routes/index.js';

const app = express();

// ── Security & parsing ──────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow the PHP web app + Flutter mobile origins.
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
app.get('/', (_req, res) => {
  res.json({ service: 'nexam-api', version: '1.0.0', docs: '/api/health' });
});
app.use('/api', routes);

// ── Fallback handlers (order matters) ───────────────────
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[nexam-api] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

export default app;
