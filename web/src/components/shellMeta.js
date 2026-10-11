import { createContext } from 'react';

/** Setter each page uses to tell the persistent AppLayout its nav key,
 *  topbar title, and content width. */
export const ShellMetaContext = createContext(() => {});

/** The page's @scope root class (e.g. "page--materials"). Portaled UI —
 *  modals, pickers — renders at document.body, outside the page DOM, so it
 *  must carry this class itself or @scope (.page--x) rules stop matching. */
export const PageScopeContext = createContext('');
