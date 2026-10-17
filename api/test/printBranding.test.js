import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { loadPrintBranding } from '../src/services/printBranding.js';

test('loadPrintBranding embeds only the requested user private images', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexam-branding-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));

  const headPath = path.join(dir, 'head.png');
  const footPath = path.join(dir, 'foot.jpg');
  await fs.writeFile(headPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await fs.writeFile(footPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return [[{ letterhead_path: headPath, letterhead_foot_path: footPath }]];
    },
  };

  const branding = await loadPrintBranding(db, 'instructor-7');

  assert.equal(branding.letterhead, 'data:image/png;base64,iVBORw==');
  assert.equal(branding.footer, 'data:image/jpeg;base64,/9j/2Q==');
  assert.deepEqual(calls[0].params, { userId: 'instructor-7' });
  assert.match(calls[0].sql, /WHERE id = :userId/);
});

test('loadPrintBranding safely falls back when an owned image file is missing', async () => {
  const db = {
    async query() {
      return [[{
        letterhead_path: '/tmp/nexam-missing-letterhead.png',
        letterhead_foot_path: null,
      }]];
    },
  };

  assert.deepEqual(await loadPrintBranding(db, 'instructor-8'), {
    letterhead: null,
    footer: null,
  });
});
