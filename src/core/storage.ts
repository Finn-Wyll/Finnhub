/**
 * Tiny key-value abstraction. On the web it is backed by localStorage; on
 * macOS it maps to UserDefaults (or a JSON file in Application Support).
 * Every access is guarded: storage can throw in private windows.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();

export const webStore: KeyValueStore = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

export function readJSON<T>(store: KeyValueStore, key: string, fallback: T): T {
  const raw = store.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(store: KeyValueStore, key: string, value: unknown) {
  store.set(key, JSON.stringify(value));
}

export const KEYS = {
  apiKey: 'finnhub.tmdb.key',
  watchlist: 'finnhub.watchlist.v1',
  theme: 'finnhub.theme',
  recent: 'finnhub.recentSearches',
} as const;
