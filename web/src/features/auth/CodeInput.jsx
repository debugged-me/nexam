/**
 * CodeInput — six-box verification/reset code field.
 *
 * Wraps input-otp's single hidden input and paints it as six slots, so the
 * field keeps real-input semantics (label, focus, autofill via
 * autoComplete="one-time-code", paste) while looking like an OTP control.
 * Codes are alphanumeric and always stored uppercase.
 */
import { OTPInput, REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';

export default function CodeInput({ id = 'code', value, onChange, onComplete, inputRef, disabled = false }) {
  return (
    <OTPInput
      id={id}
      ref={inputRef}
      maxLength={6}
      value={value}
      onChange={(v) => onChange(v.toUpperCase())}
      onComplete={onComplete ? (v) => onComplete(v.toUpperCase()) : undefined}
      pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
      pasteTransformer={(p) => p.toUpperCase()}
      inputMode="text"
      autoComplete="one-time-code"
      placeholder="••••••"
      disabled={disabled}
      containerClassName="otp-wrap"
      render={({ slots }) => (
        <div className="otp-slots" aria-hidden="true">
          {slots.map((slot, i) => (
            <div key={i} className={`otp-slot${slot.isActive ? ' is-active' : ''}${slot.char ? ' has-char' : ''}`}>
              {slot.char ?? slot.placeholderChar}
              {slot.hasFakeCaret && <span className="otp-caret" />}
            </div>
          ))}
        </div>
      )}
    />
  );
}
