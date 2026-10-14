/**
 * GoogleSignInButton — "Continue with Google" trigger for the OAuth popup.
 *
 * Renders our own button (full-width, always English, matches .btn-login
 * sizing) instead of Google's iframe — Google's rendered button follows the
 * signed-in account's language and can't be forced to English.
 *
 * Clicking opens Google's account chooser via initCodeClient (ux_mode:
 * 'popup'). The returned authorization code goes to onCode — POST it to
 * /api/auth/google, which exchanges it server-side for a verified ID token.
 * The account chooser itself is Google's UI and follows the account's own
 * language — only this button is ours.
 *
 *   <GoogleSignInButton clientId={id} onCode={handleCode} disabled={busy} />
 */
import { useEffect, useRef, useState } from 'react';

let loader = null;

function loadGsi() {
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      if (window.google?.accounts?.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => (window.google?.accounts?.oauth2 ? resolve() : reject(new Error('Google sign-in failed to load')));
      s.onerror = () => reject(new Error('Google sign-in failed to load'));
      document.head.appendChild(s);
    });
  }
  return loader;
}

// Official multicolor Google "G" mark.
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45c-.28 1.48-1.12 2.73-2.38 3.57v2.97h3.85c2.25-2.07 3.54-5.13 3.54-8.73z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.85-2.97c-1.07.72-2.44 1.14-4.08 1.14-3.13 0-5.79-2.11-6.74-4.96H1.29v3.07C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.26 14.3c-.24-.72-.38-1.49-.38-2.3s.14-1.58.37-2.3V6.63H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.37l3.97-3.07z" />
      <path fill="#EA4335" d="M12 4.7c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.63l3.97 3.07C6.21 6.81 8.87 4.7 12 4.7z" />
    </svg>
  );
}

export default function GoogleSignInButton({ clientId, onCode, disabled = false }) {
  const clientRef = useRef(null);
  const onCodeRef = useRef(onCode);
  useEffect(() => { onCodeRef.current = onCode; });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    clientRef.current = null;
    loadGsi()
      .then(() => {
        if (cancelled) return;
        clientRef.current = window.google.accounts.oauth2.initCodeClient({
          client_id: clientId,
          scope: 'openid email profile',
          ux_mode: 'popup',
          callback: (res) => {
            if (res?.code) onCodeRef.current(res.code);
            // res.error covers popup_closed / access_denied — stay silent,
            // the user can just click again.
          },
        });
        setReady(true);
      })
      .catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (!ready) return null;

  return (
    <button
      type="button"
      className="btn-google"
      disabled={disabled}
      onClick={() => clientRef.current?.requestCode()}
    >
      <GoogleMark />
      Continue with Google
    </button>
  );
}
