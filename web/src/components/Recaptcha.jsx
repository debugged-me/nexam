/**
 * Recaptcha — Google reCAPTCHA v2 widget.
 *
 * Two modes, driven by the `invisible` prop:
 *   checkbox (default) — the familiar "I'm not a robot" box; the token flows
 *                        through onChange as soon as the user solves it.
 *   invisible          — no UI besides the corner badge; call
 *                        ref.current.execute() on submit and the challenge
 *                        resolves (or shows) then, returning the token via
 *                        onChange.
 *
 * Loads api.js once (shared across mounts) and renders explicitly so the
 * widget works inside React's lifecycle. Pages fetch the site key from
 * GET /api/auth/captcha and render this only when a key exists.
 *
 *   const captchaRef = useRef(null);
 *   <Recaptcha ref={captchaRef} siteKey={key} onChange={setToken} />
 *   captchaRef.current?.reset()    // after a failed submit (checkbox mode)
 *   captchaRef.current?.execute()  // run the check (invisible mode)
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

let loader = null;

function loadRecaptcha() {
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      if (window.grecaptcha?.render) return resolve();
      window.onNexamRecaptchaLoad = resolve;
      const s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/api.js?render=explicit&onload=onNexamRecaptchaLoad';
      s.async = true;
      s.defer = true;
      s.onerror = () => reject(new Error('reCAPTCHA failed to load'));
      document.head.appendChild(s);
    });
  }
  return loader;
}

const Recaptcha = forwardRef(function Recaptcha({ siteKey, onChange, invisible = false }, ref) {
  const boxRef = useRef(null);
  const widgetId = useRef(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const [failed, setFailed] = useState(false);

  const execute = useCallback(() => {
    // Invisible mode only — triggers the check; the token arrives via
    // the render-time callback below.
    if (widgetId.current !== null) window.grecaptcha?.execute(widgetId.current);
  }, []);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
    },
    execute,
    isReady: () => widgetId.current !== null,
  }), [execute]);

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha()
      .then(() => {
        if (cancelled || !boxRef.current || widgetId.current !== null) return;
        widgetId.current = window.grecaptcha.render(boxRef.current, {
          sitekey: siteKey,
          size: invisible ? 'invisible' : undefined,
          badge: invisible ? 'bottomright' : undefined,
          callback: (token) => onChangeRef.current(token),
          'expired-callback': () => onChangeRef.current(''),
          'error-callback': () => onChangeRef.current(''),
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [siteKey, invisible]);

  if (failed) return null;
  return <div ref={boxRef} className={invisible ? 'recaptcha-invisible' : 'recaptcha-box'} />;
});

export default Recaptcha;
