import { useEffect, useReducer, useSyncExternalStore } from 'react';
import type { SearchResult } from '../types';

/* ---------- Title logos (batched, cached in memory + localStorage) ---------- */

export type Logo = { p: string; r: number } | null;

const LS_KEY = 'vf_logos_v1';
const MAX_STORED = 1500;
const mem = new Map<string, Logo>();
const pending = new Set<string>();
const listeners = new Map<string, Set<() => void>>();
let queue: string[] = [];
let flushTimer: number | undefined;
let persistTimer: number | undefined;

try {
  const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  Object.keys(raw).forEach((k) => mem.set(k, raw[k]));
} catch {
  /* ignore */
}

const persist = () => {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      const entries = [...mem.entries()].slice(-MAX_STORED);
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
      chunk.forEach((k) => mem.set(k, json[k] ?? null));
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

/** undefined = still loading, null = no logo (show text title) */
export function useLogo(item: Pick<SearchResult, 'id' | 'media_type'> | null | undefined): Logo | undefined {
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
  return mem.has(key) ? (mem.get(key) as Logo) : undefined;
}

/* ---------- Responsive cards-per-row (Netflix breakpoints) ---------- */

const computePerRow = () => {
  const w = window.innerWidth;
  return w >= 1400 ? 6 : w >= 1100 ? 5 : w >= 800 ? 4 : w >= 500 ? 3 : 2;
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
