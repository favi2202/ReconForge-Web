import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ProjectProvider } from './state/project-store.js';
import './styles.css';

const root = document.querySelector('#root');
if (!root) throw new Error('Application root is missing.');

createRoot(root).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>,
);
