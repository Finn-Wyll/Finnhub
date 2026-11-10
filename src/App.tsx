import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './app-context';
import { TabBar, TopNav } from './components/Nav';
import Home from './routes/Home';
import NotFound from './routes/NotFound';
import Onboarding from './routes/Onboarding';

const Browse = lazy(() => import('./routes/Browse'));
const Title = lazy(() => import('./routes/Title'));
const Search = lazy(() => import('./routes/Search'));
const Person = lazy(() => import('./routes/Person'));
const Watchlist = lazy(() => import('./routes/Watchlist'));
const Settings = lazy(() => import('./routes/Settings'));
const Player = lazy(() => import('./routes/Player'));

function Gate({ children }: { children: React.ReactNode }) {
  const { client } = useApp();
  return client ? <>{children}</> : <Onboarding />;
}

function Shell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return (
    <Gate>
      <div id="top-sentinel" className="absolute inset-x-0 top-0 h-2" aria-hidden />
      <TopNav />
      <main id="main" tabIndex={-1} className="min-h-[100dvh] pb-24 outline-none md:pb-0">
        <Suspense fallback={<div className="min-h-[100dvh]" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="mx-auto max-w-[1600px] px-4 pb-28 pt-6 text-sm text-text-3 md:px-12 md:pb-10">
        Catalogue data and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
      <TabBar />
      <ScrollRestoration />
    </Gate>
  );
}

function PlayerShell() {
  return (
    <Gate>
      <Suspense fallback={<div className="fixed inset-0 bg-[#08080a]" />}>
        <Player />
      </Suspense>
    </Gate>
  );
}

const router = createBrowserRouter([
  { path: '/watch/:type/:id', element: <PlayerShell /> },
  { path: '/watch/:type/:id/:season/:episode', element: <PlayerShell /> },
  {
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'movies', element: <Browse type="movie" /> },
      { path: 'tv', element: <Browse type="tv" /> },
      { path: 'title/:type/:id', element: <Title /> },
      { path: 'person/:id', element: <Person /> },
      { path: 'search', element: <Search /> },
      { path: 'watchlist', element: <Watchlist /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export default function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
