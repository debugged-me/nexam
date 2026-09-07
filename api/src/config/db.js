import mysql from 'mysql2/promise';
import env from './env.js';

/**
 * Shared connection pool for the `nexam` database.
 * The CodeIgniter PHP app and this Node API read/write the same DB,
 * so models here must respect the same ownership rules (user_id scoping).
 */
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
