/**
 * Recaptcha — Google reCAPTCHA v2 checkbox widget.
 *
 * Loads api.js once (shared across mounts) and renders explicitly so the
 * widget works inside React's lifecycle. Pages fetch the site key from
 * GET /api/auth/captcha and render this only when a key exists.
 *
 *   const captchaRef = useRef(null);
 *   <Recaptcha ref={captchaRef} siteKey={key} onChange={setToken} />
 *   captchaRef.current?.reset()   // after a failed submit
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

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

const Recaptcha = forwardRef(function Recaptcha({ siteKey, onChange }, ref) {
  const boxRef = useRef(null);
  const widgetId = useRef(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    loadRecaptcha()
      .then(() => {
        if (cancelled || !boxRef.current || widgetId.current !== null) return;
        widgetId.current = window.grecaptcha.render(boxRef.current, {
          sitekey: siteKey,
          callback: onChange,
          'expired-callback': () => onChange(''),
          'error-callback': () => onChange(''),
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [siteKey, onChange]);

  if (failed) return null;
  return <div ref={boxRef} className="recaptcha-box" />;
});

export default Recaptcha;
