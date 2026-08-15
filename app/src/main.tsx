import React from 'react';
import ReactDOM from 'react-dom/client';
// Body / UI face. Import only the Latin + Latin-ext subsets (dropping the
// Cyrillic/Vietnamese/Thai @font-face rules Google ships by default) for the
// weights this UI actually uses. Glyphs still load on demand via unicode-range.
import '@fontsource/hanken-grotesk/latin-400.css';
import '@fontsource/hanken-grotesk/latin-500.css';
import '@fontsource/hanken-grotesk/latin-600.css';
import '@fontsource/hanken-grotesk/latin-700.css';
import '@fontsource/hanken-grotesk/latin-800.css';
import '@fontsource/hanken-grotesk/latin-ext-400.css';
import '@fontsource/hanken-grotesk/latin-ext-500.css';
import '@fontsource/hanken-grotesk/latin-ext-600.css';
import '@fontsource/hanken-grotesk/latin-ext-700.css';
import '@fontsource/hanken-grotesk/latin-ext-800.css';
// Squared "digital" face for the brand wordmark + splash only (see --font-brand).
// That text is fixed ASCII, so the Latin subset alone covers it.
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './theme/tokens.css';
import App from './App';
import { initTheme } from './theme/theme';

initTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
