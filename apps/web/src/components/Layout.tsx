import {
  BookOpen,
  Boxes,
  FileOutput,
  Gauge,
  Menu,
  PlayCircle,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useProject } from '../state/project-store.js';
import { loadConnectedSettings } from '../lib/connected-api.js';

const nav = [
  ['/', 'Dashboard', Gauge],
  ['/new', 'New project', PlayCircle],
  ['/planner', 'Query planner', Radar],
  ['/run', 'Live run', Search],
  ['/results', 'Results', Boxes],
  ['/reports', 'Reports', FileOutput],
  ['/templates', 'Templates', BookOpen],
  ['/settings', 'Providers', Settings],
  ['/about', 'Methodology', ShieldCheck],
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(() => Boolean(loadConnectedSettings().token));
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const { project } = useProject();
  useEffect(() => {
    const update = () => setConnected(Boolean(loadConnectedSettings().token));
    window.addEventListener('reconforge-settings', update);
    return () => window.removeEventListener('reconforge-settings', update);
  }, []);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const main = document.querySelector<HTMLElement>('.main-column');
    if (!sidebar || !main) return;
    const mobile = window.matchMedia('(max-width: 820px)');
    const apply = () => {
      sidebar.inert = mobile.matches && !open;
      main.inert = mobile.matches && open;
    };
    apply();
    mobile.addEventListener('change', apply);
    document.body.style.overflow = mobile.matches && open ? 'hidden' : '';
    if (mobile.matches && open) sidebar.querySelector<HTMLElement>('.mobile-close')?.focus();
    return () => {
      mobile.removeEventListener('change', apply);
      sidebar.inert = false;
      main.inert = false;
      document.body.style.overflow = '';
    };
  }, [open]);
  const closeMenu = () => {
    setOpen(false);
    window.setTimeout(() => menuRef.current?.focus(), 0);
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
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
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        id="primary-navigation"
        ref={sidebarRef}
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
        aria-label="Primary navigation"
        onKeyDown={handleMenuKeyDown}
      >
        <div className="brand">
          <span className="brand-mark">
            <Radar size={24} />
          </span>
          <div>
            <strong>ReconForge</strong>
            <small>Defensive OSINT</small>
          </div>
          <button className="mobile-close" aria-label="Close menu" onClick={closeMenu}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="mode-indicator">
            <span className="status-dot" />
            {connected ? 'Connected configured' : 'Planner mode'}
          </div>
          <small>{connected ? 'Session-only owner token' : 'No API key required'}</small>
        </div>
      </aside>
      {open ? <button className="scrim" aria-label="Close navigation" onClick={closeMenu} /> : null}
      <div className="main-column">
        <header className="topbar">
          <button
            ref={menuRef}
            className="menu-button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="primary-navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <div className="scope-chip">
            <span>Active scope</span>
            <strong>
              {project
                ? `${project.scope.normalized}${project.additionalScopes?.length ? ` +${project.additionalScopes.length}` : ''}`
                : 'No project'}
            </strong>
          </div>
          <div className="safety-chip">
            <ShieldCheck size={16} /> {connected ? 'Bounded owner API' : 'Passive only'}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer>
          <span>ReconForge Web v0.2.0</span>
          <span>Findings are leads, not proof of vulnerability.</span>
        </footer>
      </div>
    </div>
  );
}
