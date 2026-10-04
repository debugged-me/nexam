/**
 * AppShell — per-page frame inside the persistent AppLayout.
 *
 * The sidebar and topbar live in AppLayout and stay mounted while you move
 * between pages. Each page renders <AppShell> to tell the layout which nav
 * item is active, what the topbar title is, and whether the page is wide;
 * the page body fades in instead of the whole screen reloading.
 */
import { useContext, useLayoutEffect } from 'react';
import { ShellMetaContext } from './shellMeta.js';

export default function AppShell({ activeNav, pageTitle, wide = false, children }) {
  const setMeta = useContext(ShellMetaContext);

  // Layout effect so the topbar title updates in the same frame as the page.
  useLayoutEffect(() => {
    setMeta({ activeNav, pageTitle, wide: Boolean(wide) });
  }, [setMeta, activeNav, pageTitle, wide]);

  return <div className="page-enter">{children}</div>;
}
