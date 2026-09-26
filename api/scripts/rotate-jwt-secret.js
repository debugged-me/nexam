import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let contents = '';
try { contents = await fs.readFile(envPath, 'utf8'); } catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const secret = crypto.randomBytes(48).toString('base64url');
if (/^JWT_SECRET=.*$/m.test(contents)) {
  contents = contents.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`);
} else {
  const separator = contents && !contents.endsWith('\n') ? '\n' : '';
  contents = `${contents}${separator}JWT_SECRET=${secret}\n`;
}
await fs.writeFile(envPath, contents, { mode: 0o600 });
console.log('Rotated JWT_SECRET in api/.env. Existing login tokens are now invalid.');
