import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import './styles/tokens.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Primer service worker que realmente se registra en este proyecto: el anterior se
// configuraba en config-overrides.js, un archivo que el build nunca ejecutaba.
registerSW({ immediate: true });
