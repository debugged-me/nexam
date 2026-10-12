import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './lib/theme.js';
import { initScrollShadows } from './lib/scrollShadow.js';
import App from './App.jsx';

initScrollShadows();

// Dev-only render profiler — enable with VITE_REACT_SCAN=1 in .env.local.
if (import.meta.env.DEV && import.meta.env.VITE_REACT_SCAN) {
  import('react-scan').then(({ scan }) => scan());
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
