import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
process.env.DATA_ENCRYPTION_KEY ||= Buffer.alloc(32, 7).toString('base64');

const {
  blindIndex,
  encryptFileAtRest,
  protectText,
  readProtectedFile,
  unprotectText,
} = await import('../src/services/storageCrypto.js');

test('student PII encrypts with randomized ciphertext and decrypts exactly', () => {
  const first = protectText('Student 001');
  const second = protectText('Student 001');
  assert.notEqual(first, 'Student 001');
  assert.notEqual(first, second);
  assert.equal(unprotectText(first), 'Student 001');
  assert.equal(unprotectText(second), 'Student 001');
});

test('blind indexes are stable and normalized', () => {
  assert.equal(blindIndex('  ABC-123 '), blindIndex('abc-123'));
  assert.notEqual(blindIndex('ABC-123'), blindIndex('ABC-124'));
});

test('uploaded files are encrypted at rest and readable through the protected reader', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexam-crypto-'));
  const file = path.join(dir, 'material.pdf');
  const original = Buffer.from('course material with verified facts');
  try {
    await fs.writeFile(file, original);
    assert.equal(await encryptFileAtRest(file), true);
    const stored = await fs.readFile(file);
    assert.notDeepEqual(stored, original);
    assert.deepEqual(await readProtectedFile(file), original);
    assert.equal(await encryptFileAtRest(file), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
