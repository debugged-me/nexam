/**
 * ScopedLayer — wraps portaled content in the current page's @scope class.
 *
 * Radix popovers, hover cards and selects render at document.body, outside
 * the .page--<name> subtree, so page-scoped rules would stop matching. This
 * adds the scope class back (the same contract Modal follows) on a
 * `display: contents` wrapper, so it never affects layout or positioning.
 */
import { useContext } from 'react';
import { PageScopeContext } from './shellMeta.js';

export default function ScopedLayer({ children }) {
  const scope = useContext(PageScopeContext);
  return <div className={`nx-layer${scope ? ` ${scope}` : ''}`}>{children}</div>;
}
