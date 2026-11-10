/** Web-only configuration, read from Vite env at build time. */
export const env = {
  apiBase: (import.meta.env.VITE_TMDB_API_BASE as string | undefined) || 'https://api.themoviedb.org/3',
  imageBase: (import.meta.env.VITE_TMDB_IMAGE_BASE as string | undefined) || 'https://image.tmdb.org/t/p',
  apiKey: (import.meta.env.VITE_TMDB_API_KEY as string | undefined) || '',
};
