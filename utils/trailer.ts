import type { SearchResult } from '../types';
import { tmdbGet } from '../services/tmdb';
import type { TitleDetails } from '../services/tmdb';
import { loadCached, peekCache, useCachedData } from './useCachedData';

/**
 * The best YouTube trailer for a title (for the muted previews).
 * Trailer > Teaser, official first, English first, then the sharper / newer upload.
 * Cached per title (null = no usable trailer), shared by the billboard, hover cards and title window.
 */

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
  name?: string;
  iso_639_1?: string | null;
  size?: number;
  published_at?: string;
}

const VIDEO_KEY = /^[\w-]{6,20}$/;

const rank = (v: TmdbVideo): number =>
  (v.type === 'Trailer' ? 8 : 0) + (v.official ? 4 : 0) + (v.iso_639_1 === 'en' ? 2 : !v.iso_639_1 ? 1 : 0) + ((v.size || 0) >= 1080 ? 0.5 : 0);

export const pickTrailer = (videos: readonly TmdbVideo[] | null | undefined): string | null => {
  const pool = (videos || []).filter(
    (v) => !!v && v.site === 'YouTube' && typeof v.key === 'string' && VIDEO_KEY.test(v.key) && (v.type === 'Trailer' || v.type === 'Teaser')
  );
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => rank(b) - rank(a) || String(b.published_at || '').localeCompare(String(a.published_at || '')));
  return sorted[0].key;
};

const trailerKey = (type: 'movie' | 'tv', id: number) => `trailer:${type}:${id}`;

const fetchTrailer = async (type: 'movie' | 'tv', id: number, lang?: string): Promise<string | null> => {
  // The title window's data (often already loaded or prefetched) has the English videos in it.
  const details = peekCache<TitleDetails>(`title:${type}:${id}`);
  const fromDetails = pickTrailer(details?.videos?.results as TmdbVideo[] | undefined);
  if (fromDetails) return fromDetails;
  const langs = ['en', 'null', lang && lang !== 'en' && /^[a-z]{2}$/.test(lang) ? lang : ''].filter(Boolean).join(',');
  const data = (await tmdbGet(`/${type}/${id}/videos`, { include_video_language: langs })) as { results?: TmdbVideo[] } | null;
  return pickTrailer(data?.results);
};

const languageOf = (item: SearchResult): string | undefined => {
  const l = (item as unknown as { original_language?: unknown }).original_language;
  return typeof l === 'string' ? l : undefined;
};

/** Warm the trailer for a title (no-op if it's cached). Never rejects. */
export const loadTrailer = (item: SearchResult): Promise<string | null> =>
  loadCached<string | null>(trailerKey(item.media_type, item.id), () => fetchTrailer(item.media_type, item.id, languageOf(item))).catch(() => null);

/**
 * The trailer's YouTube id: undefined while looking it up, null if there's none (or it failed).
 * Pass enabled = false to skip the lookup (e.g. previews switched off).
 */
export const useTrailer = (item: SearchResult | null | undefined, enabled = true): string | null | undefined => {
  const key = item && enabled ? trailerKey(item.media_type, item.id) : null;
  const { data, error } = useCachedData<string | null>(key, () =>
    item ? fetchTrailer(item.media_type, item.id, languageOf(item)) : Promise.resolve(null)
  );
  if (!key) return undefined;
  if (error) return null;
  return data;
};
