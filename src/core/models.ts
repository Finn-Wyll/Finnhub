/**
 * Domain models. These are framework-agnostic and deliberately flat so they
 * map directly onto Swift structs (`struct Title: Identifiable, Codable`).
 * UI code only ever sees these, never raw TMDB payloads.
 */

export type MediaType = 'movie' | 'tv';

export interface TitleSummary {
  id: number;
  mediaType: MediaType;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  /** ISO date (release date for movies, first air date for TV). */
  date: string | null;
  year: number | null;
  /** 0-10 */
  rating: number;
  voteCount: number;
  genreIds: number[];
}

export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
}

export interface Video {
  key: string;
  name: string;
  site: 'YouTube' | 'Vimeo' | string;
  type: 'Trailer' | 'Teaser' | 'Clip' | 'Featurette' | string;
  official: boolean;
  publishedAt: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface Episode {
  id: number;
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string | null;
  runtime: number | null;
  rating: number;
}

export interface TitleDetail extends TitleSummary {
  tagline: string | null;
  genres: Genre[];
  /** minutes; for TV this is the typical episode runtime */
  runtime: number | null;
  certification: string | null;
  status: string | null;
  originalLanguage: string;
  logoPath: string | null;
  cast: CastMember[];
  directors: CrewMember[];
  creators: CrewMember[];
  writers: CrewMember[];
  videos: Video[];
  trailer: Video | null;
  recommendations: TitleSummary[];
  similar: TitleSummary[];
  seasons: SeasonSummary[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  networks: string[];
  productionCompanies: string[];
  budget: number | null;
  revenue: number | null;
  homepage: string | null;
  imdbId: string | null;
}

export interface Person {
  id: number;
  name: string;
  biography: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  credits: TitleSummary[];
}

export interface PersonSummary {
  id: number;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
}

export type SearchResult =
  | { kind: 'title'; item: TitleSummary }
  | { kind: 'person'; item: PersonSummary };

export interface Page<T> {
  page: number;
  totalPages: number;
  totalResults: number;
  results: T[];
}

export type SortKey = 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc' | 'revenue.desc';
