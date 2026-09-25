import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import './index.css';

// -------------------------------------------------------------
// GLOBAL RESILIENCE & EXCEPTION SUPPRESSION ENGINE
// -------------------------------------------------------------
if (typeof window !== 'undefined') {
  // Suppress unhandled WebSocket disconnection alerts and HMR reconnection errors
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message || String(reason || '');
    
    // Prevent unhandled rejections from WebSocket disruptions, HMR reloads, or transient network drops
    if (
      msg.includes('WebSocket') ||
      msg.includes('ws://') ||
      msg.includes('wss://') ||
      msg.includes('vite') ||
      msg.includes('HMR') ||
      msg.includes('failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('AbortError')
    ) {
      event.preventDefault();
      console.warn('[Runtime Resilience] Gracefully handled background network/HMR rejection:', msg);
      return;
    }

    console.warn('[Runtime Resilience] Global unhandled promise rejection captured:', reason);
    // Prevent unhandled promise rejection crashes
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || String(event?.error?.message || '');
    if (
      msg.includes('WebSocket') ||
      msg.includes('ws://') ||
      msg.includes('wss://') ||
      msg.includes('HMR') ||
      msg.includes('ResizeObserver loop') ||
      msg.includes('Script error')
    ) {
      event.preventDefault();
      console.warn('[Runtime Resilience] Gracefully handled runtime error:', msg);
      return;
    }

    console.warn('[Runtime Resilience] Global error captured gracefully:', msg);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
