import dotenv from 'dotenv';

dotenv.config();

const required = ['JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(`[config] Missing env vars: ${missing.join(', ')}. Copy .env.example to .env.`);
}
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: JWT_SECRET is unset — the insecure development default is in use. Set JWT_SECRET in .env before deploying.');
}
if (process.env.JWT_SECRET === 'change-me-in-production' && process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.warn('[config] WARNING: JWT_SECRET is still the .env.example placeholder. Rotate it before deploying.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  isProd: process.env.NODE_ENV === 'production',

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nexam',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    // Origins allowed to call the API (PHP web app + Flutter mobile).
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  vectorStore: {
    // Directory where HNSWLib persists vector indices (one subdirectory per subject).
    // This is the "dedicated vector database" — vectors live here, not in MySQL.
    dir: process.env.VECTOR_STORE_DIR || 'storage/vectors',
  },

  ai: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    },
    worker: {
      pollInterval: parseInt(process.env.WORKER_POLL_INTERVAL || '5000', 10),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '2', 10),
    },
    generation: {
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192', 10),
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.4'),
    },
  },

  // SMTP — same env vars as the PHP app (NEXAM_SMTP_*). Used by the email
  // service to send OTP verification and password-reset codes.
  smtp: {
    host: process.env.NEXAM_SMTP_HOST || 'mail.mati.gov.ph',
    port: parseInt(process.env.NEXAM_SMTP_PORT || '587', 10),
    user: process.env.NEXAM_SMTP_USER || 'nexam@mati.gov.ph',
    pass: process.env.NEXAM_SMTP_PASS || '',
    secure: process.env.NEXAM_SMTP_CRYPTO === 'ssl',
    from: process.env.NEXAM_SMTP_USER || 'nexam@mati.gov.ph',
  },

  // Public URL of the web app — used to build links in emails.
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
};

export default env;
