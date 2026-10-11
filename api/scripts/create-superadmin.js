/**
 * create-superadmin.js — create or promote a superadmin account.
 *
 * The superadmin oversees the platform: approves instructor accounts,
 * reviews login logs and the audit trail, and manages reCAPTCHA / AI
 * credentials. It is NOT an admin and gets no instructor workspace.
 *
 * Usage:
 *   node scripts/create-superadmin.js --email admin@school.edu \
 *     [--password 'Secret123!'] [--first Name] [--last Name]
 *
 * If the email already exists, the account is promoted in place
 * (role=superadmin, status=active, verified). Otherwise --password is
 * required and a new verified superadmin account is created.
 */
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import pool from '../src/config/db.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    out[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const email = String(args.email || '').trim().toLowerCase();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: node scripts/create-superadmin.js --email <email> [--password <pw>] [--first <name>] [--last <name>]');
  process.exit(1);
}

try {
  const [rows] = await pool.query(`SELECT id, role FROM users WHERE email = :email LIMIT 1`, { email });

  if (rows.length) {
    await pool.query(
      `UPDATE users SET role = 'superadmin', status = 'active', email_verified = 1 WHERE id = :id`,
      { id: rows[0].id }
    );
    console.log(`Promoted existing account ${email} (${rows[0].id}) to superadmin.`);
  } else {
    const password = String(args.password || '');
    if (password.length < 8) {
      console.error('New account requires --password (min. 8 characters).');
      process.exit(1);
    }
    const id = uuid();
    const first = String(args.first || 'Super').trim();
    const last = String(args.last || 'Admin').trim();
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users
         (id, email, password_hash, first_name, last_name, full_name, role, email_verified, status)
       VALUES
         (:id, :email, :hash, :first, :last, :full, 'superadmin', 1, 'active')`,
      { id, email, hash, first, last, full: `${first} ${last}` }
    );
    console.log(`Created superadmin account ${email} (${id}).`);
  }
} finally {
  await pool.end();
}
