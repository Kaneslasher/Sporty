import React from 'react';
import { createRoot } from 'react-dom/client';
import { SportsProvider } from './context/SportsContext';
import App from './App';
import './index.css';
import './styles/app.css';

/* Native switch controls ship in Safari; load the small polyfill only where they are missing. */
if (!('switch' in HTMLInputElement.prototype)) {
  import('input-switch-polyfill').catch((err) => {
    console.warn('[Main]: Switch polyfill failed to load', err);
  });
}

/* Register the service worker up front so local score alerts can use showNotification(),
   which Android Chrome requires instead of the Notification constructor. */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
      console.warn('[Main]: Service worker registration failed', err);
    });
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SportsProvider>
      <App />
    </SportsProvider>
  </React.StrictMode>
);
