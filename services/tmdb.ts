import type { TMDBResponse, SearchResult, TVDetails, MovieSearchResult, SeasonDetails, ImagesResponse, TVSearchResult } from '../types';

// All TMDB calls go through our own /api/tmdb endpoint (a Vercel serverless function, see api/tmdb.js),
// so the TMDB API key never ships to the browser.
const API_ENDPOINT = '/api/tmdb';

// Small in-memory cache so moving between pages feels instant. Only successful responses are cached.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: any }>();

const fetchFromTMDB = async (path: string, params: Record<string, string> = {}, signal?: AbortSignal) => {
    const query = new URLSearchParams({ path, ...params }).toString();
    const hit = cache.get(query);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
        return hit.data;
    }

    const response = await fetch(`${API_ENDPOINT}?${query}`, { signal });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ status_message: 'An unknown error occurred' }));
        throw new Error(errorData.status_message || `Request failed with status ${response.status}`);
    }
    const data = await response.json();
    cache.set(query, { at: Date.now(), data });
    return data;
};

export const searchMulti = async (query: string, signal?: AbortSignal): Promise<SearchResult[]> => {
  const data: TMDBResponse = await fetchFromTMDB('/search/multi', { query }, signal);
  return data.results.filter(
    (item): item is SearchResult => item.media_type === 'movie' || item.media_type === 'tv'
  ).sort((a, b) => b.popularity - a.popularity);
};

export const getTrending = async (signal?: AbortSignal): Promise<SearchResult[]> => {
    const data: TMDBResponse = await fetchFromTMDB('/trending/all/week', {}, signal);
    return data.results.filter(
      (item): item is SearchResult => (item.media_type === 'movie' || item.media_type === 'tv')
    );
};

export const getPopularMovies = async (signal?: AbortSignal): Promise<MovieSearchResult[]> => {
    const data = await fetchFromTMDB('/movie/popular', {}, signal);
    return data.results.map((movie: any) => ({ ...movie, media_type: 'movie' }));
};

export const getTopRatedMovies = async (signal?: AbortSignal): Promise<MovieSearchResult[]> => {
    const data = await fetchFromTMDB('/movie/top_rated', {}, signal);
    return data.results.map((movie: any) => ({ ...movie, media_type: 'movie' }));
};

export const getUpcomingMovies = async (signal?: AbortSignal): Promise<MovieSearchResult[]> => {
    const data = await fetchFromTMDB('/movie/upcoming', {}, signal);
    return data.results.map((movie: any) => ({ ...movie, media_type: 'movie' }));
};

export const getPopularTvShows = async (signal?: AbortSignal): Promise<TVSearchResult[]> => {
    const data = await fetchFromTMDB('/tv/popular', {}, signal);
    return data.results.map((tvShow: any) => ({ ...tvShow, media_type: 'tv' }));
};

export const getTopRatedTvShows = async (signal?: AbortSignal): Promise<TVSearchResult[]> => {
    const data = await fetchFromTMDB('/tv/top_rated', {}, signal);
    return data.results.map((tvShow: any) => ({ ...tvShow, media_type: 'tv' }));
};

export const getOnTheAirTvShows = async (signal?: AbortSignal): Promise<TVSearchResult[]> => {
    const data = await fetchFromTMDB('/tv/on_the_air', {}, signal);
    return data.results.map((tvShow: any) => ({ ...tvShow, media_type: 'tv' }));
};

export const getTvDetails = async (id: number, signal?: AbortSignal): Promise<TVDetails> => {
  return fetchFromTMDB(`/tv/${id}`, {}, signal);
};

export const getMovieDetails = async (id: number, signal?: AbortSignal): Promise<MovieSearchResult> => {
    const movie = await fetchFromTMDB(`/movie/${id}`, {}, signal);
    // Ensure media_type is present for consistency
    return { ...movie, media_type: 'movie' };
};

export const getSeasonDetails = async (tvId: number, seasonNumber: number, signal?: AbortSignal): Promise<SeasonDetails> => {
    return fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`, {}, signal);
};

export const getImages = async (mediaId: number, mediaType: 'movie' | 'tv', signal?: AbortSignal): Promise<ImagesResponse> => {
    // By including 'null' in include_image_language, we can fetch posters without text.
    return fetchFromTMDB(`/${mediaType}/${mediaId}/images`, { include_image_language: 'en,null' }, signal);
};

// ---------- Netflix-style row sources ----------

const asMovies = (data: any): MovieSearchResult[] => (data.results || []).map((m: any) => ({ ...m, media_type: 'movie' }));
const asTv = (data: any): TVSearchResult[] => (data.results || []).map((t: any) => ({ ...t, media_type: 'tv' }));
const withArt = <T extends SearchResult>(items: T[]) => items.filter((i) => i.backdrop_path || i.poster_path);

export const getTrendingMovies = async (window: 'day' | 'week' = 'day', signal?: AbortSignal) =>
  withArt(asMovies(await fetchFromTMDB(`/trending/movie/${window}`, {}, signal)));

export const getTrendingTv = async (window: 'day' | 'week' = 'day', signal?: AbortSignal) =>
  withArt(asTv(await fetchFromTMDB(`/trending/tv/${window}`, {}, signal)));

export const getNowPlayingMovies = async (signal?: AbortSignal) =>
  withArt(asMovies(await fetchFromTMDB('/movie/now_playing', {}, signal)));

export const getAiringTodayTv = async (signal?: AbortSignal) =>
  withArt(asTv(await fetchFromTMDB('/tv/airing_today', {}, signal)));

/** /discover with sensible quality filters so genre rows look curated. */
export const discover = async (type: 'movie' | 'tv', params: Record<string, string>, signal?: AbortSignal): Promise<SearchResult[]> => {
  const data = await fetchFromTMDB(
    `/discover/${type}`,
    { sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': type === 'movie' ? '150' : '60', ...params },
    signal
  );
  return withArt(type === 'movie' ? asMovies(data) : asTv(data));
};

export interface TitleDetails {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  tagline?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  vote_average?: number;
  popularity: number;
  genres?: { id: number; name: string }[];
  seasons?: { id: number; name: string; season_number: number; episode_count: number; air_date: string; poster_path: string | null; overview: string }[];
  created_by?: { id: number; name: string }[];
  credits?: { cast: { id: number; name: string; character?: string }[]; crew: { id: number; name: string; job: string }[] };
  recommendations?: { results: any[] };
  similar?: { results: any[] };
  videos?: { results: { key: string; site: string; type: string; official?: boolean; name: string }[] };
  images?: { logos: { file_path: string; iso_639_1: string | null; aspect_ratio: number; vote_average: number }[]; backdrops: { file_path: string; iso_639_1: string | null }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
}

/** Everything the title page needs in one request. */
export const getTitleDetails = async (type: 'movie' | 'tv', id: number, signal?: AbortSignal): Promise<TitleDetails> => {
  const append = ['credits', 'recommendations', 'similar', 'videos', 'images', type === 'tv' ? 'content_ratings' : 'release_dates'].join(',');
  const data = await fetchFromTMDB(`/${type}/${id}`, { append_to_response: append, include_image_language: 'en,null' }, signal);
  return { ...data, media_type: type };
};

/** Raw (cached) TMDB GET through our proxy — used by the Browse / filter pages. */
export const tmdbGet = (path: string, params: Record<string, string> = {}, signal?: AbortSignal) => fetchFromTMDB(path, params, signal);

export interface CollectionDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  parts: any[];
}

export const getCollection = async (id: number, signal?: AbortSignal): Promise<CollectionDetails> => fetchFromTMDB(`/collection/${id}`, {}, signal);
