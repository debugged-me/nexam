import mysql from 'mysql2/promise';
import fs from 'fs';
import env from './env.js';

/**
 * Connection pool for the Nexam MySQL database. User-owned records must be
 * scoped by the authenticated instructor ID; the approved institution question
 * bank is the only intentionally cross-instructor read surface.
 */
const ssl = env.db.sslCaFile
  ? {
      ca: fs.readFileSync(env.db.sslCaFile, 'utf8'),
      rejectUnauthorized: env.db.sslRejectUnauthorized,
    }
  : undefined;

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  charset: 'utf8mb4',
  waitForConnections: true,
  namedPlaceholders: true,
  ...(ssl ? { ssl } : {}),
});

// Verify connectivity on boot (non-fatal — server still starts).
pool
  .getConnection()
  .then((conn) => {
    conn.release();
    // eslint-disable-next-line no-console
    console.log(`[db] Connected to "${env.db.database}" @ ${env.db.host}:${env.db.port}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`[db] Failed to connect to "${env.db.database}":`, err.message);
  });

export default pool;
