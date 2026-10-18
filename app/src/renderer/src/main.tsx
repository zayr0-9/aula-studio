import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readThemePreference } from './theme';
import './index.css';
import './motion.css';

applyTheme(readThemePreference());

const root = document.getElementById('root');
if (!root) throw new Error('Renderer root is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
