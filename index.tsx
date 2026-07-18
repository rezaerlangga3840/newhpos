// FRONTEND: File ini adalah titik masuk utama (entry point) untuk aplikasi React.
// Fungsinya adalah untuk me-render komponen App ke dalam elemen root di HTML
// dan membungkusnya dengan provider yang diperlukan seperti Router dan Context.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext'; // Import AuthProvider
import { PersonalizationProvider } from './contexts/PersonalizationContext';
import { NotificationProvider } from './contexts/NotificationContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <PersonalizationProvider>
        <AuthProvider> {/* Auth can now potentially use personalization in the future */}
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </PersonalizationProvider>
    </HashRouter>
  </React.StrictMode>
);
