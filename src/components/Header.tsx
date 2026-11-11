import type { ThemeMode } from '@/core/theme';
import { hrefFor } from '@/core/router';

interface Props {
  theme: ThemeMode;
  onToggleTheme: () => void;
  active: 'home' | 'wall';
}

export default function Header({ theme, onToggleTheme, active }: Props) {
  return (
    <header className="header">
      <div className="header__inner">
        <a className="brand" href={hrefFor({ page: 'home' })}>
          PLACES<span className="brand__dot">.</span>PAGE
        </a>
        <nav className="header__nav">
          <a
            className={'header__link' + (active === 'home' ? ' header__link--active' : '')}
            href={hrefFor({ page: 'home' })}
          >
            Home
          </a>
          <a
            className={'header__link' + (active === 'wall' ? ' header__link--active' : '')}
            href={hrefFor({ page: 'wall' })}
          >
            Wall
          </a>
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
          </button>
          <a
            className="icon-btn"
            href="https://github.com/macEngine/places_page"
            target="_blank"
            rel="noreferrer noopener"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2 0-.4-.5-1.6.2-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.3v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3z" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  );
}
