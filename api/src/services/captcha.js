/**
 * captcha.js — reCAPTCHA v2 verification backed by the `settings` table.
 *
 * `recaptcha_site_key` / `recaptcha_secret_key` are seeded by the admin panel.
 * When the secret is unset, verification is skipped (returns true) so local
 * development without keys keeps working. The secret never leaves this file.
 */
import { getSetting } from './settings.js';

/** Public site key — safe to hand to the browser for widget rendering. */
export async function getCaptchaSiteKey() {
  return getSetting('recaptcha_site_key', null);
}

/**
 * Verify a v2 checkbox token against Google's siteverify endpoint.
 * Returns true when verification succeeds or no secret is configured.
 */
export async function verifyCaptcha(token, remoteIp) {
  const secret = await getSetting('recaptcha_secret_key', null);
  if (!secret) return true;
  if (!token) return false;

  try {
    const params = new URLSearchParams({ secret, response: String(token) });
    if (remoteIp) params.set('remoteip', remoteIp);
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.success === true;
  } catch {
    return false;
  }
}
