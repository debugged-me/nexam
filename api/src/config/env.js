import dotenv from 'dotenv';

dotenv.config();

const required = ['JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn(`[config] Missing env vars: ${missing.join(', ')}. Copy .env.example to .env.`);
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
};

export default env;
