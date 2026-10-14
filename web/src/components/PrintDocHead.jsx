/**
 * PrintDocHead — shared masthead for every printed document.
 *
 * If the instructor uploaded a letterhead (Account → Print letterhead), the
 * banner image heads the page instead of the default text org line; the
 * document title and meta line always follow.
 */
import { useAuth } from '../features/auth/AuthContext.jsx';
import { useLetterheadSrc } from '../lib/useLetterheadSrc.js';

export default function PrintDocHead({ org, title, meta }) {
  const { user } = useAuth();
  const src = useLetterheadSrc(user);

  return (
    <div className="print-doc-head">
      {src ? (
        <img className="pd-letterhead" src={src} alt="" aria-hidden="true" />
      ) : (
        <div className="pd-org">{org}</div>
      )}
      <div className="pd-title">{title}</div>
      {meta ? <div className="pd-meta">{meta}</div> : null}
    </div>
  );
}
