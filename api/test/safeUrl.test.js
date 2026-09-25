import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafePublicUrl, isPrivateAddress } from '../src/services/safeUrl.js';

test('private and loopback IPv4 ranges are blocked', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.2.3', '192.168.1.1', '169.254.1.1']) {
    assert.equal(isPrivateAddress(address), true);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});

test('local and non-web URLs are rejected before fetching', async () => {
  await assert.rejects(() => assertSafePublicUrl('http://localhost/admin'));
  await assert.rejects(() => assertSafePublicUrl('http://127.0.0.1/private'));
  await assert.rejects(() => assertSafePublicUrl('file:///etc/passwd'));
  await assert.rejects(() => assertSafePublicUrl('https://user:pass@example.com/'));
});
