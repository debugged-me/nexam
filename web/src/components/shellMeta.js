import { createContext } from 'react';

/** Setter each page uses to tell the persistent AppLayout its nav key,
 *  topbar title, and content width. */
export const ShellMetaContext = createContext(() => {});
