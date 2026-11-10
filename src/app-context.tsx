import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { TmdbClient } from './core/tmdb/client';
import { KEYS, webStore } from './core/storage';
import { Watchlist } from './core/watchlist';
import { env } from './lib/env';

export type ThemePref = 'system' | 'dark' | 'light';

interface AppState {
  client: TmdbClient | null;
  credential: string;
  credentialSource: 'env' | 'user' | 'none';
  setCredential: (value: string | null) => void;
  makeClient: (credential: string) => TmdbClient;
  watchlist: Watchlist;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
}

const Ctx = createContext<AppState | null>(null);
const watchlist = new Watchlist(webStore);

const makeClient = (credential: string) =>
  new TmdbClient({ apiBase: env.apiBase, imageBase: env.imageBase, credential });

export function AppProvider({ children }: { children: ReactNode }) {
  const [userKey, setUserKey] = useState(() => webStore.get(KEYS.apiKey) ?? '');
  const [theme, setThemeState] = useState<ThemePref>(() => (webStore.get(KEYS.theme) as ThemePref) || 'system');

  const credential = userKey || env.apiKey;
  const credentialSource = userKey ? 'user' : env.apiKey ? 'env' : 'none';
  const client = useMemo(() => (credential ? makeClient(credential) : null), [credential]);

  const setCredential = useCallback((value: string | null) => {
    if (value) webStore.set(KEYS.apiKey, value);
    else webStore.remove(KEYS.apiKey);
    setUserKey(value ?? '');
  }, []);

  const setTheme = useCallback((t: ThemePref) => {
    webStore.set(KEYS.theme, t);
    setThemeState(t);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo<AppState>(
    () => ({ client, credential, credentialSource, setCredential, makeClient, watchlist, theme, setTheme }),
    [client, credential, credentialSource, setCredential, theme, setTheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** The configured client. Only call inside routes guarded by the onboarding gate. */
export function useTmdb(): TmdbClient {
  const { client } = useApp();
  if (!client) throw new Error('TMDB client is not configured');
  return client;
}

export function useWatchlist() {
  const { watchlist } = useApp();
  const entries = useSyncExternalStore(watchlist.subscribe, watchlist.all, watchlist.all);
  return { entries, has: watchlist.has.bind(watchlist), toggle: watchlist.toggle.bind(watchlist) };
}
