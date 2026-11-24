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

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Shareable page URL for a title, e.g. /movie/603-the-matrix */
export const titlePath = (item: Pick<SearchResult, 'id' | 'media_type'> & { title?: string; name?: string }) => {
  const name = (item as any).title || (item as any).name || '';
  const slug = slugify(name);
  return `/${item.media_type}/${item.id}${slug ? `-${slug}` : ''}`;
};

export const getMatch = (item: SearchResult): number | null =>
  typeof item.vote_average === 'number' && item.vote_average > 0 ? Math.min(99, Math.round(item.vote_average * 10 + 2)) : null;

/** Released in the last 30 days (Netflix "Recently added"). */
export const isRecent = (item: SearchResult): boolean => {
  const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
  if (!date) return false;
  const age = (Date.now() - new Date(date).getTime()) / 86400000;
  return age >= 0 && age <= 30;
};

/** In-site player URL: /watch/movie/603 or /watch/tv/1399/1/3 */
export const watchPath = (item: { id: number; media_type: 'movie' | 'tv' }, p?: { season?: number; episode?: number }) =>
  item.media_type === 'movie' ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}/${p?.season || 1}/${p?.episode || 1}`;
