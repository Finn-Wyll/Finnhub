/** Subset of the TMDB v3 response shapes that this app reads. */

export interface RawList<T> {
  page: number;
  total_pages: number;
  total_results: number;
  results: T[];
}

export interface RawTitle {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity?: number;
}

export interface RawPerson {
  id: number;
  media_type?: 'person';
  name: string;
  profile_path?: string | null;
  known_for_department?: string | null;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  combined_credits?: { cast: RawTitle[]; crew: (RawTitle & { job?: string })[] };
}

export interface RawVideo {
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
}

export interface RawImage {
  file_path: string;
  iso_639_1: string | null;
  vote_average: number;
  aspect_ratio: number;
}

export interface RawDetail extends RawTitle {
  tagline?: string;
  runtime?: number;
  episode_run_time?: number[];
  status?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: {
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }[];
  networks?: { name: string }[];
  production_companies?: { name: string }[];
  created_by?: { id: number; name: string }[];
  budget?: number;
  revenue?: number;
  homepage?: string;
  imdb_id?: string | null;
  external_ids?: { imdb_id?: string | null };
  credits?: {
    cast: { id: number; name: string; character?: string; profile_path: string | null; order?: number }[];
    crew: { id: number; name: string; job: string }[];
  };
  aggregate_credits?: {
    cast: { id: number; name: string; profile_path: string | null; roles?: { character: string }[] }[];
  };
  videos?: { results: RawVideo[] };
  images?: { logos: RawImage[]; backdrops: RawImage[] };
  recommendations?: RawList<RawTitle>;
  similar?: RawList<RawTitle>;
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string; type: number }[] }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
}

export interface RawSeason {
  season_number: number;
  episodes: {
    id: number;
    season_number: number;
    episode_number: number;
    name: string;
    overview?: string;
    still_path: string | null;
    air_date: string | null;
    runtime: number | null;
    vote_average?: number;
  }[];
}
