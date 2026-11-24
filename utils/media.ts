import type { SearchResult } from '../types';
import { GENRES, TMDB_IMG } from '../constants';

export type ImageSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original';

export const getTitle = (item: SearchResult): string =>
  item.media_type === 'movie' ? item.title : item.name;

export const getYear = (item: SearchResult): string => {
  const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
  return date ? date.slice(0, 4) : '';
};

export const getRating = (item: SearchResult): string | null =>
  typeof item.vote_average === 'number' && item.vote_average > 0 ? item.vote_average.toFixed(1) : null;

export const getGenres = (item: SearchResult, max = 3): string[] =>
  (item.genre_ids || [])
    .map((id) => GENRES[id])
    .filter((genre): genre is string => Boolean(genre))
    .slice(0, max);

export const tmdbImage = (path: string | null | undefined, size: ImageSize = 'w500'): string | null =>
  path ? `${TMDB_IMG}/${size}${path}` : null;

export const isSameMedia = (a: SearchResult, b: SearchResult) =>
  a.id === b.id && a.media_type === b.media_type;
