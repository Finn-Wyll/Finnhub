import type {
  Episode,
  Genre,
  MediaType,
  Page,
  Person,
  SearchResult,
  SortKey,
  TitleDetail,
  TitleSummary,
} from '../models';
import { toDetail, toEpisodes, toPage, toPerson, toSearchResults, toSummary } from './mappers';
import type { RawDetail, RawList, RawPerson, RawSeason, RawTitle } from './raw';

export type TmdbErrorKind = 'auth' | 'notFound' | 'rateLimit' | 'network' | 'unknown';

export class TmdbError extends Error {
  constructor(
    public kind: TmdbErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

export interface TmdbConfig {
  apiBase: string;
  imageBase: string;
  /** v3 API key or v4 read access token (JWT, starts with "eyJ"). */
  credential: string;
  language?: string;
}

export type ImageSize =
  | 'w92' | 'w154' | 'w185' | 'w300' | 'w342' | 'w500' | 'w780' | 'w1280' | 'h632' | 'original';

type Query = Record<string, string | number | undefined>;

interface CacheEntry {
  at: number;
  value: Promise<unknown>;
}

const TTL_MS = 10 * 60 * 1000;

export const MOVIE_LISTS = ['popular', 'top_rated', 'now_playing', 'upcoming'] as const;
export const TV_LISTS = ['popular', 'top_rated', 'on_the_air', 'airing_today'] as const;
export type MovieList = (typeof MOVIE_LISTS)[number];
export type TvList = (typeof TV_LISTS)[number];

/**
 * Thin, typed TMDB v3 client. Pure TypeScript with no DOM or React
 * dependency, so the same surface can be re-implemented in Swift as an
 * `actor TMDBClient` with `async throws` methods (see docs/SWIFT_PORT.md).
 */
export class TmdbClient {
  private cache = new Map<string, CacheEntry>();

  constructor(private config: TmdbConfig) {}

  get isBearer() {
    return this.config.credential.startsWith('eyJ');
  }

  image(path: string | null | undefined, size: ImageSize = 'w500'): string | null {
    if (!path) return null;
    return `${this.config.imageBase}/${size}${path}`;
  }

  /** Builds a responsive srcset for an image path. */
  srcSet(path: string | null | undefined, sizes: ImageSize[]): string | undefined {
    if (!path) return undefined;
    return sizes
      .filter((s) => s.startsWith('w'))
      .map((s) => `${this.config.imageBase}/${s}${path} ${s.slice(1)}w`)
      .join(', ');
  }

  private async request<T>(path: string, query: Query = {}, signal?: AbortSignal): Promise<T> {
    const url = new URL(`${this.config.apiBase}${path}`);
    url.searchParams.set('language', this.config.language ?? 'en-US');
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.isBearer) headers.authorization = `Bearer ${this.config.credential}`;
    else url.searchParams.set('api_key', this.config.credential);

    const key = url.toString();
    let hit = this.cache.get(key);
    if (!hit || Date.now() - hit.at >= TTL_MS) {
      // The shared request is never tied to one caller's signal, so an aborted
      // caller (route change, React StrictMode) cannot poison the cache.
      const value = (async () => {
        let res: Response;
        try {
          res = await fetch(url, { headers });
        } catch {
          throw new TmdbError('network', 'Could not reach TMDB. Check your connection.');
        }
        if (!res.ok) {
          const kind: TmdbErrorKind =
            res.status === 401 ? 'auth' : res.status === 404 ? 'notFound' : res.status === 429 ? 'rateLimit' : 'unknown';
          const messages: Record<TmdbErrorKind, string> = {
            auth: 'TMDB rejected the API key.',
            notFound: 'That title could not be found.',
            rateLimit: 'TMDB is rate limiting requests. Try again in a moment.',
            network: 'Could not reach TMDB.',
            unknown: `TMDB returned an error (${res.status}).`,
          };
          throw new TmdbError(kind, messages[kind], res.status);
        }
        return (await res.json()) as unknown;
      })();
      hit = { at: Date.now(), value };
      this.cache.set(key, hit);
      // Never cache failures.
      value.catch(() => {
        if (this.cache.get(key)?.value === value) this.cache.delete(key);
      });
    }
    return withAbort(hit.value as Promise<T>, signal);
  }

  /** Verifies the credential. Resolves on success, throws TmdbError otherwise. */
  async validate(signal?: AbortSignal): Promise<void> {
    await this.request('/configuration', {}, signal);
  }

  async trending(type: MediaType | 'all', window: 'day' | 'week' = 'week', signal?: AbortSignal) {
    const raw = await this.request<RawList<RawTitle>>(`/trending/${type}/${window}`, {}, signal);
    return toPage(
      { ...raw, results: raw.results.filter((r) => r.media_type !== 'person') },
      (r) => toSummary(r, type === 'all' ? undefined : type),
    );
  }

  async movieList(list: MovieList, page = 1, signal?: AbortSignal) {
    const raw = await this.request<RawList<RawTitle>>(`/movie/${list}`, { page }, signal);
    return toPage(raw, (r) => toSummary(r, 'movie'));
  }

  async tvList(list: TvList, page = 1, signal?: AbortSignal) {
    const raw = await this.request<RawList<RawTitle>>(`/tv/${list}`, { page }, signal);
    return toPage(raw, (r) => toSummary(r, 'tv'));
  }

  async discover(
    type: MediaType,
    opts: { genre?: number; sort?: SortKey; page?: number },
    signal?: AbortSignal,
  ): Promise<Page<TitleSummary>> {
    let sort: string = opts.sort ?? 'popularity.desc';
    if (type === 'tv' && sort === 'primary_release_date.desc') sort = 'first_air_date.desc';
    if (type === 'tv' && sort === 'revenue.desc') sort = 'popularity.desc';
    const raw = await this.request<RawList<RawTitle>>(
      `/discover/${type}`,
      {
        page: opts.page ?? 1,
        sort_by: sort,
        with_genres: opts.genre,
        include_adult: 'false',
        // Keep rating sorts meaningful.
        'vote_count.gte': sort.startsWith('vote_average') ? 300 : undefined,
        // Do not surface unreleased titles in "newest".
        'primary_release_date.lte': type === 'movie' ? today() : undefined,
        'first_air_date.lte': type === 'tv' ? today() : undefined,
      },
      signal,
    );
    return toPage(raw, (r) => toSummary(r, type));
  }

  async genres(type: MediaType, signal?: AbortSignal): Promise<Genre[]> {
    const raw = await this.request<{ genres: Genre[] }>(`/genre/${type}/list`, {}, signal);
    return raw.genres;
  }

  async detail(type: MediaType, id: number, signal?: AbortSignal): Promise<TitleDetail> {
    const append =
      type === 'movie'
        ? 'videos,credits,images,recommendations,similar,release_dates'
        : 'videos,credits,aggregate_credits,images,recommendations,similar,content_ratings,external_ids';
    const raw = await this.request<RawDetail>(
      `/${type}/${id}`,
      { append_to_response: append, include_image_language: 'en,null', include_video_language: 'en,null' },
      signal,
    );
    return toDetail(raw, type);
  }

  async season(tvId: number, seasonNumber: number, signal?: AbortSignal): Promise<Episode[]> {
    const raw = await this.request<RawSeason>(`/tv/${tvId}/season/${seasonNumber}`, {}, signal);
    return toEpisodes(raw);
  }

  async search(query: string, page = 1, signal?: AbortSignal): Promise<Page<SearchResult>> {
    const raw = await this.request<RawList<RawTitle | RawPerson>>(
      '/search/multi',
      { query, page, include_adult: 'false' },
      signal,
    );
    return toSearchResults(raw);
  }

  async person(id: number, signal?: AbortSignal): Promise<Person> {
    const raw = await this.request<RawPerson>(`/person/${id}`, { append_to_response: 'combined_credits' }, signal);
    return toPerson(raw);
  }
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
