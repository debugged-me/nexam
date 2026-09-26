import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let contents = '';
try { contents = await fs.readFile(envPath, 'utf8'); } catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

if (/^DATA_ENCRYPTION_KEY=\S+/m.test(contents)) {
  console.log('DATA_ENCRYPTION_KEY is already configured.');
  process.exit(0);
}

const separator = contents && !contents.endsWith('\n') ? '\n' : '';
const key = crypto.randomBytes(32).toString('base64');
await fs.writeFile(envPath, `${contents}${separator}\n# AES-256 key for protected uploads and student PII\nDATA_ENCRYPTION_KEY=${key}\n`, { mode: 0o600 });
console.log('Generated DATA_ENCRYPTION_KEY in api/.env. Back up this file securely; the key is not recoverable.');
