import { BookmarkSimple, FilmSlate, GearSix, House, MagnifyingGlass, Television } from '@phosphor-icons/react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { IconButton } from './Button';

const LINKS = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/movies', label: 'Films', icon: FilmSlate },
  { to: '/tv', label: 'Series', icon: Television },
  { to: '/watchlist', label: 'Watchlist', icon: BookmarkSimple },
];

/**
 * Translucent top bar. It sits over the hero and gains its material only once
 * content scrolls underneath (IntersectionObserver on a sentinel, no scroll listener).
 */
export function TopNav() {
  const [solid, setSolid] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const sentinel = document.getElementById('top-sentinel');
    if (!sentinel) return;
    const io = new IntersectionObserver(([e]) => setSolid(!e.isIntersecting));
    io.observe(sentinel);
    return () => io.disconnect();
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(target.tagName) && !target.isContentEditable) {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 transition-[background-color,backdrop-filter,border-color] duration-300 ${
        solid ? 'glass !rounded-none border-x-0 border-t-0 !shadow-none' : 'border-b border-transparent'
      }`}
    >
      {/* Legibility scrim over hero art; taller than the bar so it has no visible edge. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-bg/80 via-bg/30 to-transparent transition-opacity duration-300 ${solid ? 'opacity-0' : 'opacity-100'}`}
      />
      <a
        href="#main"
        className="absolute left-4 top-2 -translate-y-20 rounded-full bg-text px-4 py-2 text-sm text-bg focus:translate-y-0"
      >
        Skip to content
      </a>
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-[1600px] items-center gap-8 px-4 md:px-12">
        <NavLink to="/" aria-label="Finnhub home" className="press rounded-lg">
          <Logo />
        </NavLink>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `press relative rounded-full px-3.5 py-2 text-[0.9375rem] font-medium ${
                    isActive ? 'text-text' : 'text-text-2 hover:text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive && <span className="absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full bg-accent" aria-hidden />}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <NavLink
            to="/search"
            className="press glass hidden h-10 w-56 items-center gap-2 rounded-full px-4 text-sm text-text-2 hover:text-text md:flex"
          >
            <MagnifyingGlass size={16} aria-hidden />
            <span>Search</span>
            <kbd className="ml-auto rounded-md border border-line px-1.5 font-mono text-xs text-text-3">/</kbd>
          </NavLink>
          <IconButton label="Settings" onClick={() => navigate('/settings')}>
            <GearSix size={18} aria-hidden />
          </IconButton>
        </div>
      </nav>
    </header>
  );
}

/** Bottom tab bar on small screens, in the thumb zone. */
export function TabBar() {
  const tabs = [...LINKS.slice(0, 3), { to: '/search', label: 'Search', icon: MagnifyingGlass }, LINKS[3]];
  return (
    <nav
      aria-label="Tabs"
      className="glass fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 rounded-full md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, icon: Icon, ...rest }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={'end' in rest ? rest.end : undefined}
              className={({ isActive }) =>
                `press flex h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium ${
                  isActive ? 'text-text' : 'text-text-3'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
