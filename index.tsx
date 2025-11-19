import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Note: To configure API Keys, see App.tsx or use Environment Variables (VITE_GEMINI_API_KEY)
// You do not need to edit this file for API keys.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);