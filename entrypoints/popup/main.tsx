import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup.tsx';
import '@/assets/tailwind.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
