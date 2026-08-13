import { useEffect, useRef, useState } from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Button } from './components/ui.js';
import { AboutPage } from './pages/AboutPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { NewProjectPage } from './pages/NewProjectPage.js';
import { PlannerPage } from './pages/PlannerPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { ResultsPage } from './pages/ResultsPage.js';
import { RunPage } from './pages/RunPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { TemplatesPage } from './pages/TemplatesPage.js';

export function App() {
  return (
    <HashRouter>
      <Layout>
        <ScrollFocus />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new" element={<NewProjectPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <GuidedTour />
      </Layout>
    </HashRouter>
  );
}

function ScrollFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    if (!document.querySelector('.tour-backdrop'))
      document.querySelector<HTMLElement>('#main-content h1')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

function GuidedTour() {
  const [visible, setVisible] = useState(
    () => localStorage.getItem('reconforge.tour-complete') !== 'true',
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!visible) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const background = [
      document.querySelector<HTMLElement>('.sidebar'),
      document.querySelector<HTMLElement>('.topbar'),
      document.querySelector<HTMLElement>('footer'),
      ...document.querySelectorAll<HTMLElement>('#main-content > :not(.tour-backdrop)'),
    ].filter((item): item is HTMLElement => Boolean(item));
    for (const item of background) item.inert = true;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      for (const item of background) item.inert = false;
      returnFocusRef.current?.focus();
    };
  }, [visible]);
  if (!visible) return null;
  const close = () => {
    localStorage.setItem('reconforge.tour-complete', 'true');
    setVisible(false);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, [href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  return (
    <div
      className="tour-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      onKeyDown={handleKeyDown}
    >
      <div className="tour" ref={dialogRef}>
        <span className="eyebrow">Welcome · 1 minute tour</span>
        <h2 id="tour-title">Plan first. Collect deliberately.</h2>
        <p>
          ReconForge turns an authorized scope into explained search queries, then helps you
          normalize, annotate, and export results. Planner mode stays entirely in your browser.
        </p>
        <div className="tour-steps">
          <div>
            <b>1</b>
            <span>Define a strict hostname boundary.</span>
          </div>
          <div>
            <b>2</b>
            <span>Preview safe, data-driven query packs.</span>
          </div>
          <div>
            <b>3</b>
            <span>Import or collect bounded results and report.</span>
          </div>
        </div>
        <div className="tour-actions">
          <Button variant="secondary" onClick={close}>
            Explore on my own
          </Button>
          <Button onClick={close}>Start safely</Button>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="page narrow-page">
      <div className="card empty-state">
        <span className="eyebrow">404 · Route not found</span>
        <h1 tabIndex={-1}>This workspace view does not exist.</h1>
        <p>The URL may be outdated. Your locally saved projects have not been changed.</p>
        <Link className="button button-primary" to="/">
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
