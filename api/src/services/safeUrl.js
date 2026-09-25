import dns from 'dns/promises';
import net from 'net';

function isPrivateAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::' || normalized === '::1'
      || normalized.startsWith('fc') || normalized.startsWith('fd')
      || normalized.startsWith('fe8') || normalized.startsWith('fe9')
      || normalized.startsWith('fea') || normalized.startsWith('feb')
      || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.')
      || normalized.startsWith('::ffff:192.168.');
  }
  return true;
}

/** Reject non-web, credentialed, local, and private-network URLs. */
export async function assertSafePublicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid public URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS URLs are allowed.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local or private-network URLs are not allowed.');
  }
  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Local or private-network URLs are not allowed.');
  }
  return url;
}

/** Fetch a public URL while re-validating every redirect destination. */
export async function safePublicFetch(value, options = {}, maxRedirects = 5) {
  let current = await assertSafePublicUrl(value);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    const response = await fetch(current, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('URL redirect did not include a destination.');
    if (redirects === maxRedirects) throw new Error('URL redirected too many times.');
    current = await assertSafePublicUrl(new URL(location, current).toString());
  }
  throw new Error('URL could not be fetched safely.');
}

export { isPrivateAddress };
