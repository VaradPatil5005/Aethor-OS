import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useWindowStore } from './stores/useWindowStore';

// Dev-only handle for UI audits (open/close windows from the console). Stripped from production builds.
if (import.meta.env.DEV) (window as unknown as { __aether: unknown }).__aether = { useWindowStore };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
