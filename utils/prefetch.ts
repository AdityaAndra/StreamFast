import type { SearchResult } from '../types';
import { getTitleDetails, TitleDetails } from '../services/tmdb';
import { loadCached, peekCache } from './useCachedData';
import { tmdbImage } from './media';

/**
 * "Instant" title windows: when you rest on a card (hover or keyboard focus), fetch the title's details
 * into the shared cache (same key the title window reads) and warm its big backdrop image.
 */
const warmed = new Set<string>();
const images = new Set<string>();

const preloadImage = (src: string | null) => {
  if (!src || images.has(src)) return;
  images.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
};

export const prefetchTitle = (item: SearchResult) => {
  if (!item || (item.media_type !== 'movie' && item.media_type !== 'tv')) return;
  preloadImage(tmdbImage(item.backdrop_path, 'w1280'));
  const key = `title:${item.media_type}:${item.id}`;
  if (warmed.has(key) || peekCache(key) !== undefined) return;
  warmed.add(key);
  loadCached<TitleDetails>(key, () => getTitleDetails(item.media_type, item.id)).then(
    (d) => preloadImage(tmdbImage(d.backdrop_path, 'w1280')),
    () => {
      warmed.delete(key);
    }
  );
};

/** Prefetch after a short rest on the card (sweeping the pointer across a row fetches nothing). Returns a cancel. */
export const schedulePrefetch = (item: SearchResult, delay = 180): (() => void) => {
  const t = window.setTimeout(() => prefetchTitle(item), delay);
  return () => window.clearTimeout(t);
};
