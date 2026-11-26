import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';
import { AppContextProvider } from './contexts/AppContext';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// When saved lists are arriving from the old address, wait until they're in place.
const ready: Promise<unknown> = (window as any).__sfReady || Promise.resolve();

ready
  .catch(() => undefined)
  .then(() => {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <AppContextProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </AppContextProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
