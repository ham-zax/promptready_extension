import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupApp from './PopupApp.tsx';
import '@/assets/tailwind.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
