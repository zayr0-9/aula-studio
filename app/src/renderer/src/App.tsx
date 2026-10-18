import { useEffect, useState } from 'react';
import { StreamPanel } from './StreamPanel';
import { IndicatorPanel } from './IndicatorPanel';
import { BrightnessPanel } from './BrightnessPanel';
import { KnobPanel } from './KnobPanel';
import { MappingPanel } from './MappingPanel';
import type { ShellInfo } from '../../shared/contracts';
import { applyTheme, nextThemePreference, readThemePreference, saveThemePreference } from './theme';

import type { IndicatorColors } from '../../shared/indicators';

type Page = 'Lighting' | 'Remapping' | 'Knob' | 'Macros';
const pages: Page[] = ['Lighting', 'Remapping', 'Knob', 'Macros'];

export default function App() {
  const [page, setPage] = useState<Page>('Lighting');
  const [theme, setTheme] = useState(readThemePreference);
  const [indicators, setIndicators] = useState<IndicatorColors | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => applyTheme(theme);
    update();
    if (theme !== 'system') return;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);

  function switchTheme() {
    const next = nextThemePreference(theme);
    applyTheme(next);
    saveThemePreference(next);
    setTheme(next);
  }
  const [shell, setShell] = useState<ShellInfo | null>(null);
  const [shellStatus, setShellStatus] = useState(
    window.aula ? 'Checking availability…' : 'Browser preview',
  );

  useEffect(() => {
    let active = true;
    if (!window.aula) return;
    window.aula
      .getShellInfo()
      .then((info) => {
        if (!active) return;
        if (info.mode !== 'simulator' || typeof info.hardwareEnabled !== 'boolean') {
          setShellStatus('Device controls unavailable');
          return;
        }
        setShell(info);
        setShellStatus(
          info.hardwareEnabled ? 'Device controls available' : 'Device controls unavailable',
        );
      })
      .catch(() => {
        if (active) setShellStatus('Shell unavailable');
      });
    return () => {
      active = false;
    };
  }, []);

  const enabled = shell?.hardwareEnabled === true;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            a.
          </span>
          <div>
            Aula<span className="brand-subtitle">Studio</span>
          </div>
        </div>
        <nav aria-label="Studio">
          {pages.map((item) => (
            <button
              type="button"
              key={item}
              className={`nav-item ${page === item ? 'active' : ''}`}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          Aula F75<span>Standard · wired</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Studio <span className="muted">/ {page}</span>
          </span>
          <div className="topbar-actions">
            <button
              type="button"
              className="secondary-button theme-toggle"
              onClick={switchTheme}
              aria-label={`Theme: ${theme}. Switch to ${nextThemePreference(theme)} theme`}
              title="Cycle System, Light, and Dark themes"
            >
              <span key={theme} className="t-text-swap">
                Theme: {theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'}
              </span>
            </button>
            <span className="badge">{shellStatus}</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <h1 key={page} className="t-text-swap">
              {page}
            </h1>
          </div>
          {/* Keep transaction state and failure latches when changing pages. */}
          <div hidden={page !== 'Lighting'} className="lighting-page t-page">
            <BrightnessPanel
              enabled={enabled}
              indicators={indicators}
              onIndicators={setIndicators}
            />
            <StreamPanel enabled={enabled} />
            <IndicatorPanel enabled={enabled} onIndicators={setIndicators} />
          </div>
          <div hidden={page !== 'Remapping'} className="t-page">
            <MappingPanel enabled={enabled} />
          </div>
          {page === 'Knob' ? (
            <div className="t-page">
              <KnobPanel enabled={enabled} />
            </div>
          ) : null}
          {page === 'Macros' ? (
            <section className="panel empty-state t-page" aria-labelledby="macros-title">
              <h2 id="macros-title">Macros are not available yet</h2>
              <p>No keystrokes are recorded or played back.</p>
            </section>
          ) : null}
        </main>
        <footer className="workspace-footer">
          <span>{shellStatus}</span>
          <span>Assignments and lighting read on startup</span>
        </footer>
      </div>
    </div>
  );
}
