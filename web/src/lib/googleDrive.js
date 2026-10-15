/**
 * googleDrive — shared helpers for the browser-side Google Drive flow.
 * Used by DriveImportButton (materials) and the Account page's
 * "Connect Google Drive" card.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let gsiLoader = null;
export function loadGsi() {
  if (!gsiLoader) {
    gsiLoader = new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => (window.google?.accounts?.oauth2 ? resolve() : reject(new Error('GIS failed to load')));
      s.onerror = () => reject(new Error('Google sign-in failed to load'));
      document.head.appendChild(s);
    });
  }
  return gsiLoader;
}

/**
 * Short-lived Google access token via the GIS token client, for any scope.
 * Tries silently first (prompt:'') so already-consented flows skip all UI;
 * on failure retries once with the consent prompt — unless the user closed
 * the popup, which is treated as a deliberate cancel.
 * `hint` pre-selects the bound Google account in the consent UI.
 * Loads the GIS client itself so callers can't forget that step.
 */
export async function requestGoogleToken(clientId, { scope, hint, prompt = '' } = {}) {
  await loadGsi();
  return new Promise((resolve, reject) => {
    let retried = false;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope,
      hint: hint || undefined,
      callback: (res) => (res?.access_token ? resolve(res.access_token) : reject(new Error(res?.error || 'No token'))),
      error_callback: (err) => {
        if (!retried && prompt === '' && err?.type !== 'popup_closed') {
          retried = true;
          client.requestAccessToken({ prompt: 'consent', hint: hint || undefined });
          return;
        }
        reject(err);
      },
    });
    client.requestAccessToken({ prompt, hint: hint || undefined });
  });
}

/** Drive-scoped variant of requestGoogleToken. */
export function requestDriveToken(clientId, { hint, prompt } = {}) {
  return requestGoogleToken(clientId, { scope: DRIVE_SCOPE, hint, prompt });
}

/** Revoke an access token (grant cleanup on mismatch/disconnect). */
export function revokeToken(token) {
  try { window.google?.accounts?.oauth2?.revoke(token, () => {}); } catch { /* best effort */ }
}

/** The Drive user behind a token — email + display name via about.get. */
export async function fetchDriveUser(token) {
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName)',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Could not read the Drive account (${res.status}).`);
  return (await res.json())?.user || {};
}
