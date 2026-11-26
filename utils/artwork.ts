import { useEffect, useReducer, useSyncExternalStore } from 'react';
import type { SearchResult } from '../types';

/* ---------- Title logos (batched, cached in memory + localStorage) ---------- */

export type Logo = { p: string; r: number } | null;
/** Per-title metadata from /api/logos: logo + IMDb rating. */
export type Meta = { p: string | null; r: number; b?: string | null; imdb?: string | null; ir?: number | null; iv?: number | null } | null;
export type Imdb = { rating: number; votes: number | null; id: string | null } | null;

const LS_KEY = 'sf_meta_v4';
const MAX_STORED = 1500;
// Saved logos / IMDb ratings are refreshed after a week (ratings change, new logos get added).
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const mem = new Map<string, Meta>();
const savedAt = new Map<string, number>();

try {
  localStorage.removeItem('vf_logos_v1');
  localStorage.removeItem('vf_meta_v2');
  localStorage.removeItem('sf_meta_v2');
  localStorage.removeItem('sf_meta_v3');
} catch {
  /* ignore */
}
const pending = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let queue: string[] = [];
let flushTimer: number | undefined;
let persistTimer: number | undefined;

try {
  const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Record<string, { v: Meta; t: number }>;
  const now = Date.now();
  // Skip failed lookups (null) and anything older than a week: those get fetched again.
  Object.keys(raw).forEach((k) => {
    const e = raw[k];
    if (e && e.v && typeof e.t === 'number' && now - e.t < MAX_AGE_MS) {
      mem.set(k, e.v);
      savedAt.set(k, e.t);
    }
  });
} catch {
  /* ignore */
}

const persist = () => {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      // Never store failed lookups (null), or those titles would stay without a logo / rating forever.
      const entries = [...mem.entries()]
        .filter(([, v]) => v !== null)
        .slice(-MAX_STORED)
        .map(([k, v]) => [k, { v, t: savedAt.get(k) ?? Date.now() }] as const);
      localStorage.setItem(LS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* storage full: ignore */
    }
  }, 1000);
};

const notify = (key: string) => listeners.get(key)?.forEach((fn) => fn());

const flush = async () => {
  flushTimer = undefined;
  const batch = queue;
  queue = [];
  for (let i = 0; i < batch.length; i += 20) {
    const chunk = batch.slice(i, i + 20);
    try {
      const res = await fetch(`/api/logos?ids=${chunk.join(',')}`);
      const json = res.ok ? await res.json() : {};
      chunk.forEach((k) => {
        mem.set(k, json[k] ?? null);
        savedAt.set(k, Date.now());
      });
    } catch {
      chunk.forEach((k) => mem.set(k, null));
    }
    chunk.forEach((k) => {
      pending.delete(k);
      notify(k);
    });
  }
  persist();
};

export const logoKey = (item: Pick<SearchResult, 'id' | 'media_type'>) => `${item.media_type}:${item.id}`;

const request = (key: string) => {
  if (mem.has(key) || pending.has(key)) return;
  pending.add(key);
  queue.push(key);
  if (!flushTimer) flushTimer = window.setTimeout(flush, 30);
};

export const prefetchLogos = (items: SearchResult[]) => items.forEach((i) => request(logoKey(i)));

function useMeta(item: Pick<SearchResult, 'id' | 'media_type'> | null | undefined): Meta | undefined {
  const key = item ? logoKey(item) : null;
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!key || mem.has(key)) return;
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(force);
    request(key);
    return () => {
      set!.delete(force);
    };
  }, [key]);
  if (!key) return undefined;
  return mem.has(key) ? (mem.get(key) as Meta) : undefined;
}

/** undefined = still loading, null = no logo (show text title) */
export function useLogo(item: Pick<SearchResult, 'id' | 'media_type'> | null | undefined): Logo | undefined {
  const m = useMeta(item);
  if (m === undefined) return undefined;
  return m && m.p ? { p: m.p, r: m.r } : null;
}

/** Card art: undefined = still loading; titled = artwork with the title printed on it (or null). */
export function useCardArt(item: Pick<SearchResult, 'id' | 'media_type'> | null | undefined): { titled: string | null } | undefined {
  const m = useMeta(item);
  if (m === undefined) return undefined;
  return { titled: (m && m.b) || null };
}

/** undefined = still loading, null = no IMDb rating available */
export function useImdb(item: Pick<SearchResult, 'id' | 'media_type'> | null | undefined): Imdb | undefined {
  const m = useMeta(item);
  if (m === undefined) return undefined;
  return m && typeof m.ir === 'number' && m.ir > 0 ? { rating: m.ir, votes: m.iv ?? null, id: m.imdb ?? null } : null;
}

/* ---------- Responsive cards-per-row (Netflix breakpoints) ---------- */

const computePerRow = () => {
  const w = window.innerWidth;
  return w >= 1800 ? 6 : w >= 1100 ? 5 : w >= 800 ? 4 : w >= 500 ? 3 : 2;
};
let perRow = computePerRow();
const perRowSubs = new Set<() => void>();
window.addEventListener(
  'resize',
  () => {
    const next = computePerRow();
    if (next !== perRow) {
      perRow = next;
      perRowSubs.forEach((fn) => fn());
    }
  },
  { passive: true }
);

export const usePerRow = () =>
  useSyncExternalStore(
    (cb) => {
      perRowSubs.add(cb);
      return () => perRowSubs.delete(cb);
    },
    () => perRow
  );

/** Mouse/trackpad devices get Netflix's paging slider + hover previews; touch gets native swiping. */
export const CAN_HOVER = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Top 10 membership (for the red TOP 10 badge) ---------- */

const top10 = new Set<string>();
export const setTop10 = (items: SearchResult[]) => items.slice(0, 10).forEach((i) => top10.add(logoKey(i)));
export const isTop10 = (item: SearchResult) => top10.has(logoKey(item));
