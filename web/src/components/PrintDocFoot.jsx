/**
 * PrintDocFoot — shared footer for every printed document.
 *
 * Renders the standard doc footer line (left/right meta), and appends the
 * instructor's optional footer banner (Account → Print letterhead) at the
 * bottom when one is uploaded.
 */
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useLetterheadFootSrc } from '../lib/useLetterheadSrc.js';

export default function PrintDocFoot({ left, right }) {
  const { user } = useAuth();
  const src = useLetterheadFootSrc(user);

  return (
    <div className="print-doc-foot">
      <div className="pd-foot-line">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      {src ? <img className="pd-letterhead-foot" src={src} alt="" aria-hidden="true" /> : null}
    </div>
  );
}
