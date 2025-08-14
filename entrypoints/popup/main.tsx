import React from 'react';
import ReactDOM from 'react-dom/client';
import SimplifiedPopup from './components/SimplifiedPopup.tsx';
import '@/assets/tailwind.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <SimplifiedPopup />
  </React.StrictMode>,
);
