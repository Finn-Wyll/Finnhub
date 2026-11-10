import type {
  CastMember,
  Episode,
  MediaType,
  Page,
  Person,
  PersonSummary,
  SearchResult,
  TitleDetail,
  TitleSummary,
  Video,
} from '../models';
import type { RawDetail, RawList, RawPerson, RawSeason, RawTitle, RawVideo } from './raw';

const yearOf = (date?: string | null) => {
  if (!date) return null;
  const y = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
};

export function toSummary(raw: RawTitle, fallbackType?: MediaType): TitleSummary {
  const mediaType: MediaType =
    raw.media_type === 'movie' || raw.media_type === 'tv'
      ? raw.media_type
      : fallbackType ?? (raw.title !== undefined ? 'movie' : 'tv');
  const date = (mediaType === 'movie' ? raw.release_date : raw.first_air_date) || null;
  return {
    id: raw.id,
    mediaType,
    title: raw.title ?? raw.name ?? 'Untitled',
    overview: raw.overview ?? '',
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    date,
    year: yearOf(date),
    rating: raw.vote_average ?? 0,
    voteCount: raw.vote_count ?? 0,
    genreIds: raw.genre_ids ?? raw.genres?.map((g) => g.id) ?? [],
  };
}

export function toPage<T>(raw: RawList<RawTitle>, map: (r: RawTitle) => T): Page<T> {
  return {
    page: raw.page,
    totalPages: Math.min(raw.total_pages, 500), // TMDB caps paging at 500
    totalResults: raw.total_results,
    results: raw.results.map(map),
  };
}

export function toVideo(v: RawVideo): Video {
  return {
    key: v.key,
    name: v.name,
    site: v.site,
    type: v.type,
    official: v.official ?? false,
    publishedAt: v.published_at ?? null,
  };
}

/** Best trailer: official YouTube trailer, newest first, then teaser, then anything. */
export function pickTrailer(videos: Video[]): Video | null {
  const yt = videos.filter((v) => v.site === 'YouTube');
  const score = (v: Video) =>
    (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) + (v.official ? 1 : 0);
  return (
    [...yt].sort(
      (a, b) => score(b) - score(a) || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
    )[0] ?? null
  );
}

const PREFERRED_REGION = 'US';

function certificationOf(raw: RawDetail, mediaType: MediaType): string | null {
  if (mediaType === 'movie') {
    const region =
      raw.release_dates?.results.find((r) => r.iso_3166_1 === PREFERRED_REGION) ??
      raw.release_dates?.results[0];
    const cert = region?.release_dates.find((d) => d.certification)?.certification;
    return cert || null;
  }
  const rating =
    raw.content_ratings?.results.find((r) => r.iso_3166_1 === PREFERRED_REGION) ??
    raw.content_ratings?.results[0];
  return rating?.rating || null;
}

export function toDetail(raw: RawDetail, mediaType: MediaType): TitleDetail {
  const base = toSummary({ ...raw, media_type: mediaType }, mediaType);
  const videos = (raw.videos?.results ?? []).map(toVideo);

  let cast: CastMember[];
  if (mediaType === 'tv' && raw.aggregate_credits?.cast?.length) {
    cast = raw.aggregate_credits.cast.slice(0, 24).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.roles?.[0]?.character ?? '',
      profilePath: c.profile_path,
    }));
  } else {
    cast = (raw.credits?.cast ?? []).slice(0, 24).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? '',
      profilePath: c.profile_path,
    }));
  }

  const crew = raw.credits?.crew ?? [];
  const uniqueBy = <T extends { id: number }>(list: T[]) =>
    list.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);

  const logos = raw.images?.logos ?? [];
  const logo =
    logos.find((l) => l.iso_639_1 === 'en') ?? logos.find((l) => l.iso_639_1 === null) ?? null;

  const runtime =
    mediaType === 'movie' ? raw.runtime ?? null : raw.episode_run_time?.[0] ?? null;

  return {
    ...base,
    tagline: raw.tagline || null,
    genres: raw.genres ?? [],
    runtime: runtime || null,
    certification: certificationOf(raw, mediaType),
    status: raw.status ?? null,
    originalLanguage: raw.original_language ?? 'en',
    logoPath: logo?.file_path ?? null,
    cast,
    directors: uniqueBy(crew.filter((c) => c.job === 'Director')),
    writers: uniqueBy(crew.filter((c) => c.job === 'Screenplay' || c.job === 'Writer')).slice(0, 4),
    creators: (raw.created_by ?? []).map((c) => ({ id: c.id, name: c.name, job: 'Creator' })),
    videos,
    trailer: pickTrailer(videos),
    recommendations: (raw.recommendations?.results ?? [])
      .map((r) => toSummary(r, mediaType))
      .filter((t) => t.posterPath),
    similar: (raw.similar?.results ?? []).map((r) => toSummary(r, mediaType)).filter((t) => t.posterPath),
    seasons: (raw.seasons ?? [])
      .filter((s) => s.season_number > 0 && s.episode_count > 0)
      .map((s) => ({
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        airDate: s.air_date,
        posterPath: s.poster_path,
      })),
    numberOfSeasons: raw.number_of_seasons ?? null,
    numberOfEpisodes: raw.number_of_episodes ?? null,
    networks: (raw.networks ?? []).map((n) => n.name),
    productionCompanies: (raw.production_companies ?? []).map((c) => c.name),
    budget: raw.budget || null,
    revenue: raw.revenue || null,
    homepage: raw.homepage || null,
    imdbId: raw.imdb_id ?? raw.external_ids?.imdb_id ?? null,
  };
}

export function toEpisodes(raw: RawSeason): Episode[] {
  return raw.episodes.map((e) => ({
    id: e.id,
    seasonNumber: e.season_number,
    episodeNumber: e.episode_number,
    name: e.name,
    overview: e.overview ?? '',
    stillPath: e.still_path,
    airDate: e.air_date,
    runtime: e.runtime,
    rating: e.vote_average ?? 0,
  }));
}

export function toPersonSummary(raw: RawPerson): PersonSummary {
  return {
    id: raw.id,
    name: raw.name,
    profilePath: raw.profile_path ?? null,
    knownForDepartment: raw.known_for_department ?? null,
  };
}

export function toPerson(raw: RawPerson): Person {
  const all = [...(raw.combined_credits?.cast ?? []), ...(raw.combined_credits?.crew ?? [])]
    .filter((c) => c.media_type === 'movie' || c.media_type === 'tv')
    .filter((c) => c.poster_path);
  const seen = new Set<string>();
  const credits = all
    .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .filter((c) => {
      const k = `${c.media_type}-${c.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 40)
    .map((c) => toSummary(c));
  return {
    ...toPersonSummary(raw),
    biography: raw.biography ?? '',
    birthday: raw.birthday ?? null,
    deathday: raw.deathday ?? null,
    placeOfBirth: raw.place_of_birth ?? null,
    credits,
  };
}

export function toSearchResults(raw: RawList<RawTitle | RawPerson>): Page<SearchResult> {
  const results: SearchResult[] = [];
  for (const r of raw.results) {
    if (r.media_type === 'person') {
      results.push({ kind: 'person', item: toPersonSummary(r as RawPerson) });
    } else if (r.media_type === 'movie' || r.media_type === 'tv') {
      results.push({ kind: 'title', item: toSummary(r as RawTitle) });
    }
  }
  return {
    page: raw.page,
    totalPages: Math.min(raw.total_pages, 500),
    totalResults: raw.total_results,
    results,
  };
}
