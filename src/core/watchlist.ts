import type { TitleSummary } from './models';
import { KEYS, readJSON, writeJSON, type KeyValueStore } from './storage';

export interface WatchlistEntry {
  item: TitleSummary;
  addedAt: number;
}

type Listener = (entries: WatchlistEntry[]) => void;

/** Observable watchlist. Maps to an `@Observable final class Watchlist` in Swift. */
export class Watchlist {
  private entries: WatchlistEntry[];
  private listeners = new Set<Listener>();

  constructor(private store: KeyValueStore) {
    this.entries = readJSON<WatchlistEntry[]>(store, KEYS.watchlist, []);
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== KEYS.watchlist) return;
        this.entries = readJSON<WatchlistEntry[]>(store, KEYS.watchlist, []);
        this.emit();
      });
    }
  }

  all = () => this.entries;

  has(item: Pick<TitleSummary, 'id' | 'mediaType'>) {
    return this.entries.some((e) => e.item.id === item.id && e.item.mediaType === item.mediaType);
  }

  toggle(item: TitleSummary): boolean {
    const present = this.has(item);
    this.entries = present
      ? this.entries.filter((e) => !(e.item.id === item.id && e.item.mediaType === item.mediaType))
      : [{ item, addedAt: Date.now() }, ...this.entries];
    writeJSON(this.store, KEYS.watchlist, this.entries);
    this.emit();
    return !present;
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit() {
    for (const fn of this.listeners) fn(this.entries);
  }
}
