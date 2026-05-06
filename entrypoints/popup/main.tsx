import React from 'react';
import ReactDOM from 'react-dom/client';
import Popup from './Popup.tsx';
import '@fontsource/space-grotesk/latin-400.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/vt323/latin-400.css';
import '@/assets/tailwind.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
