import dotenv from 'dotenv';

dotenv.config();

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

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
    sslCaFile: process.env.DB_SSL_CA_FILE || '',
    sslRejectUnauthorized: boolEnv('DB_SSL_REJECT_UNAUTHORIZED', true),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    // Origins allowed to call the API (React web app + Flutter mobile).
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:8080')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  deployment: {
    trustProxy: boolEnv('TRUST_PROXY', false),
    enforceHttps: boolEnv('ENFORCE_HTTPS', process.env.NODE_ENV === 'production'),
    serveWeb: boolEnv('SERVE_WEB', process.env.NODE_ENV === 'production'),
    webDistDir: process.env.WEB_DIST_DIR || '../../web/dist',
    dataAtRestConfirmed: boolEnv('DATA_AT_REST_CONFIRMED', false),
  },

  dataEncryption: {
    // Base64-encoded 32-byte key. Used for uploaded materials and student PII.
    key: process.env.DATA_ENCRYPTION_KEY || '',
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

  // SMTP used by the email service for verification and password-reset codes.
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

if (env.isProd) {
  const productionErrors = [];
  if (!process.env.JWT_SECRET || ['change-me-in-production', 'dev-insecure-secret-change-me'].includes(env.jwt.secret)) {
    productionErrors.push('JWT_SECRET must be a rotated production secret');
  }
  if (!env.dataEncryption.key) {
    productionErrors.push('DATA_ENCRYPTION_KEY must be configured');
  }
  if (!env.deployment.enforceHttps) {
    productionErrors.push('ENFORCE_HTTPS must remain enabled');
  }
  if (!env.deployment.dataAtRestConfirmed) {
    productionErrors.push('DATA_AT_REST_CONFIRMED=true is required after enabling encrypted database and storage volumes');
  }
  if (productionErrors.length) {
    throw new Error(`Unsafe production configuration: ${productionErrors.join('; ')}.`);
  }
}

export default env;
