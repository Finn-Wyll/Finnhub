import type { MediaType } from './models';
import { KEYS, readJSON, writeJSON, type KeyValueStore } from './storage';

/**
 * Watch progress, stored in VidFast's MEDIA_DATA shape so its messages can be
 * merged as they arrive. Keys are `m{id}` for films and `t{id}` for series.
 * Maps to an `@Observable final class WatchProgress` in Swift.
 */

export interface Watched {
  watched: number;
  duration: number;
}

export interface EpisodeProgress {
  season: number;
  episode: number;
  progress: Watched;
  last_updated: number;
}

export interface MediaProgress {
  id: number;
  type: MediaType;
  title?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  progress: Watched;
  last_season_watched?: number;
  last_episode_watched?: number;
  show_progress?: Record<string, EpisodeProgress>;
  last_updated: number;
}

export type ProgressMap = Record<string, MediaProgress>;

/** Below this many seconds there is nothing worth resuming. */
const MIN_RESUME = 30;
/** Past this share of the runtime (or within the last two minutes) counts as finished. */
const FINISHED_SHARE = 0.95;

export const progressKey = (type: MediaType, id: number) => `${type === 'movie' ? 'm' : 't'}${id}`;
export const episodeKey = (season: number, episode: number) => `s${season}e${episode}`;

export function isFinished(p: Watched | undefined) {
  if (!p || !p.duration) return false;
  return p.watched >= p.duration * FINISHED_SHARE || p.duration - p.watched <= 120;
}

/** Seconds to resume from, or 0 to start at the beginning. */
export function resumeAt(p: Watched | undefined) {
  if (!p || p.watched < MIN_RESUME || isFinished(p)) return 0;
  return Math.floor(p.watched);
}

type Listener = (all: ProgressMap) => void;

export class WatchProgress {
  private data: ProgressMap;
  private listeners = new Set<Listener>();

  constructor(private store: KeyValueStore) {
    this.data = sanitize(readJSON<unknown>(store, KEYS.progress, {}));
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key !== KEYS.progress) return;
        this.data = sanitize(readJSON<unknown>(store, KEYS.progress, {}));
        this.emit();
      });
    }
  }

  all = () => this.data;

  get(type: MediaType, id: number): MediaProgress | undefined {
    return this.data[progressKey(type, id)];
  }

  /** Where playback of this film or episode should begin. */
  resumeFor(type: MediaType, id: number, season: number, episode: number) {
    const entry = this.get(type, id);
    if (!entry) return 0;
    return resumeAt(type === 'movie' ? entry.progress : entry.show_progress?.[episodeKey(season, episode)]?.progress);
  }

  /** Merge a VidFast MEDIA_DATA payload. Newer entries (by last_updated) win, per title and per episode. */
  merge(incoming: unknown) {
    const next = sanitize(incoming);
    let changed = false;
    const out: ProgressMap = { ...this.data };
    for (const [key, entry] of Object.entries(next)) {
      const merged = mergeEntry(out[key], entry);
      if (merged !== out[key]) {
        out[key] = merged;
        changed = true;
      }
    }
    if (changed) this.commit(out);
  }

  /** Record a position reported by the player itself. */
  record(r: {
    type: MediaType;
    id: number;
    season: number;
    episode: number;
    watched: number;
    duration: number;
    meta?: { title?: string; poster_path?: string | null; backdrop_path?: string | null };
  }) {
    if (!(r.duration > 0)) return;
    const now = Date.now();
    const key = progressKey(r.type, r.id);
    const prev = this.data[key];
    const progress = { watched: Math.max(0, Math.min(r.watched, r.duration)), duration: r.duration };
    const entry: MediaProgress = {
      ...prev,
      ...stripUndefined(r.meta ?? {}),
      id: r.id,
      type: r.type,
      progress,
      last_updated: now,
    };
    if (r.type === 'tv') {
      entry.last_season_watched = r.season;
      entry.last_episode_watched = r.episode;
      entry.show_progress = {
        ...prev?.show_progress,
        [episodeKey(r.season, r.episode)]: { season: r.season, episode: r.episode, progress, last_updated: now },
      };
    }
    this.commit({ ...this.data, [key]: entry });
  }

  /** Fill in a saved title's name and artwork where they are missing. Never creates an entry. */
  describe(type: MediaType, id: number, meta: { title: string; poster_path: string | null; backdrop_path: string | null }) {
    const key = progressKey(type, id);
    const prev = this.data[key];
    if (!prev) return;
    const next = {
      ...prev,
      title: prev.title || meta.title,
      poster_path: prev.poster_path || meta.poster_path,
      backdrop_path: prev.backdrop_path || meta.backdrop_path,
    };
    if (next.title === prev.title && next.poster_path === prev.poster_path && next.backdrop_path === prev.backdrop_path) return;
    this.commit({ ...this.data, [key]: next });
  }

  remove(type: MediaType, id: number) {
    const key = progressKey(type, id);
    if (!this.data[key]) return;
    const out = { ...this.data };
    delete out[key];
    this.commit(out);
  }

  subscribe = (fn: Listener) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private commit(next: ProgressMap) {
    this.data = next;
    writeJSON(this.store, KEYS.progress, next);
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn(this.data);
  }
}

function mergeEntry(prev: MediaProgress | undefined, incoming: MediaProgress): MediaProgress {
  if (!prev) return incoming;
  const episodes = { ...prev.show_progress };
  let episodesChanged = false;
  for (const [k, ep] of Object.entries(incoming.show_progress ?? {})) {
    if (!episodes[k] || ep.last_updated > episodes[k].last_updated) {
      episodes[k] = ep;
      episodesChanged = true;
    }
  }
  const newer = incoming.last_updated > prev.last_updated;
  if (!newer && !episodesChanged) return prev;
  const base = newer ? { ...prev, ...incoming } : { ...prev };
  // Missing artwork or title in a message never erases what is already known.
  base.title = incoming.title || prev.title;
  base.poster_path = incoming.poster_path || prev.poster_path;
  base.backdrop_path = incoming.backdrop_path || prev.backdrop_path;
  if (prev.show_progress || incoming.show_progress) base.show_progress = episodes;
  return base;
}

/** Keep only well-formed entries; storage and messages are untrusted. */
function sanitize(raw: unknown): ProgressMap {
  const out: ProgressMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<MediaProgress> | null;
    if (!e || typeof e !== 'object' || !/^[mt]\d+$/.test(key)) continue;
    const type: MediaType = key[0] === 'm' ? 'movie' : 'tv';
    const id = Number(key.slice(1));
    const progress = watched(e.progress);
    if (!progress || !isNum(e.last_updated)) continue;
    const entry: MediaProgress = {
      id,
      type,
      progress,
      last_updated: e.last_updated,
      title: typeof e.title === 'string' ? e.title : undefined,
      poster_path: typeof e.poster_path === 'string' ? e.poster_path : null,
      backdrop_path: typeof e.backdrop_path === 'string' ? e.backdrop_path : null,
    };
    if (type === 'tv') {
      if (isNum(e.last_season_watched)) entry.last_season_watched = e.last_season_watched;
      if (isNum(e.last_episode_watched)) entry.last_episode_watched = e.last_episode_watched;
      const eps: Record<string, EpisodeProgress> = {};
      for (const [k, ep] of Object.entries((e.show_progress ?? {}) as Record<string, Partial<EpisodeProgress>>)) {
        const p = watched(ep?.progress);
        if (!p || !isNum(ep?.season) || !isNum(ep?.episode) || !isNum(ep?.last_updated)) continue;
        eps[k] = { season: ep.season, episode: ep.episode, progress: p, last_updated: ep.last_updated };
      }
      entry.show_progress = eps;
    }
    out[key] = entry;
  }
  return out;
}

function watched(p: unknown): Watched | null {
  const w = p as Partial<Watched> | null;
  return w && isNum(w.watched) && isNum(w.duration) ? { watched: w.watched, duration: w.duration } : null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export interface ContinueTarget {
  season: number;
  episode: number;
  /** Seconds to start from (0 for a fresh episode). */
  at: number;
  /** `resume` continues a partly watched item; `next` starts the episode after a finished one. */
  kind: 'resume' | 'next';
}

/**
 * What "continue watching" should open for a title, or null if nothing is in
 * progress. For series, `seasons` (from the title's details) finds the episode
 * after a finished one; without it, a finished episode yields `next` with no target.
 */
export function continueTarget(
  entry: MediaProgress | undefined,
  seasons?: { seasonNumber: number; episodeCount: number }[],
): ContinueTarget | null {
  if (!entry) return null;
  if (entry.type === 'movie') {
    const at = resumeAt(entry.progress);
    return at ? { season: 1, episode: 1, at, kind: 'resume' } : null;
  }
  const s = entry.last_season_watched;
  const e = entry.last_episode_watched;
  if (!s || !e) return null;
  const p = entry.show_progress?.[episodeKey(s, e)]?.progress ?? entry.progress;
  if (!isFinished(p)) {
    const at = resumeAt(p);
    return at ? { season: s, episode: e, at, kind: 'resume' } : { season: s, episode: e, at: 0, kind: 'resume' };
  }
  if (!seasons) return null;
  const current = seasons.find((x) => x.seasonNumber === s);
  if (current && e < current.episodeCount) return { season: s, episode: e + 1, at: 0, kind: 'next' };
  const following = seasons.filter((x) => x.seasonNumber > s && x.episodeCount > 0).sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  return following ? { season: following.seasonNumber, episode: 1, at: 0, kind: 'next' } : null;
}

/** Share of the title watched, 0-1, for progress bars. */
export function watchedShare(p: Watched | undefined) {
  return p && p.duration > 0 ? Math.min(1, Math.max(0, p.watched / p.duration)) : 0;
}
