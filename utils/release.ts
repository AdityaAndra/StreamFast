import { useEffect, useSyncExternalStore } from 'react';
import type { SearchResult } from '../types';

/**
 * Where a title is in its release, from TMDB's release dates in every country:
 *  - 'soon': not in cinemas or out digitally anywhere yet. Only shown in Coming Soon (and search,
 *            My List, person and franchise pages), with its date instead of a Play button.
 *  - 'cam':  in cinemas somewhere, but not out digitally anywhere yet, so only cinema recordings
 *            exist. Shown everywhere with a CAM badge.
 *  - 'hd':   out to rent, buy or stream (or on disc / TV) in at least one country.
 * It moves on by itself: on its cinema day a title leaves Coming Soon with a CAM badge, and the badge
 * goes on its first digital release anywhere. TV shows are 'soon' until their first episode airs.
 */
export type Release = 'soon' | 'cam' | 'hd';

/** t = first cinema release, p = first premiere, d = first digital / disc / TV release (see api/release.js). */
interface Dates {
  t: string | null;
  p: string | null;
  d: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Today as YYYY-MM-DD in the viewer's own time zone. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const ageDays = (iso: string, now: string) => (Date.parse(now) - Date.parse(iso)) / 86400000;

/** In cinemas this long with no digital date on TMDB: an older film whose digital dates were never added. */
const OLD_DAYS = 365;
/** No release dates on TMDB at all: CAM for this long after the main date, then HD. */
const NO_DATA_CAM_DAYS = 90;
/** Movies whose main date is older than this are taken as out in HD without asking (catalogue, classics). */
const SKIP_CHECK_DAYS = 400;
const BATCH = 40;

const dates = new Map<number, Dates>();
const pending = new Map<number, Promise<void>>();
const resolvers = new Map<number, () => void>();
const queue = new Set<number>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version += 1;
  listeners.forEach((l) => l());
};

const mainDate = (item: SearchResult) => (item.media_type === 'movie' ? item.release_date : item.first_air_date) || '';

const needsCheck = (item: SearchResult, now: string) => {
  if (item.media_type !== 'movie') return false;
  const m = item.release_date;
  return !m || ageDays(m, now) < SKIP_CHECK_DAYS;
};

const firstOf = (list: any[], types: number[]) => {
  let best: string | null = null;
  for (const c of list || []) {
    for (const r of c?.release_dates || []) {
      if (!types.includes(r?.type)) continue;
      const d = String(r?.release_date || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!best || d < best)) best = d;
    }
  }
  return best;
};

/** Store a movie's dates from a TMDB release_dates list (the title window and player already load it). */
export const seedRelease = (id: number, results: unknown) => {
  if (!Array.isArray(results)) return;
  const next: Dates = { t: firstOf(results, [2, 3]), p: firstOf(results, [1]), d: firstOf(results, [4, 5, 6]) };
  const prev = dates.get(id);
  if (prev && prev.t === next.t && prev.p === next.p && prev.d === next.d) return;
  dates.set(id, next);
  bump();
};

export const releaseOf = (item: SearchResult): Release => {
  const now = todayIso();
  const main = mainDate(item);
  if (item.media_type === 'tv') return main && main > now ? 'soon' : 'hd';
  const r = dates.get(item.id);
  if (r) {
    if (r.d && r.d <= now) return 'hd';
    if (r.t && r.t <= now) return ageDays(r.t, now) > OLD_DAYS ? 'hd' : 'cam';
    if (r.t || r.d) return 'soon';
    if (r.p) return r.p <= now && ageDays(r.p, now) > OLD_DAYS ? 'hd' : 'soon';
    // TMDB lists no release dates at all: go by the main date.
    if (!main) return 'hd';
    if (main > now) return 'soon';
    return ageDays(main, now) <= NO_DATA_CAM_DAYS ? 'cam' : 'hd';
  }
  // Not looked up (yet): only the main date is known.
  return main && main > now ? 'soon' : 'hd';
};

const flush = () => {
  flushTimer = null;
  const ids = [...queue].sort((a, b) => a - b);
  queue.clear();
  for (let k = 0; k < ids.length; k += BATCH) {
    const chunk = ids.slice(k, k + BATCH);
    fetch(`/api/release?ids=${chunk.join(',')}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: Record<string, Partial<Dates> | null>) => {
        let changed = false;
        for (const id of chunk) {
          const v = data?.[id];
          if (v && typeof v === 'object') {
            dates.set(id, { t: v.t || null, p: v.p || null, d: v.d || null });
            changed = true;
          }
        }
        if (changed) bump();
      })
      .catch(() => undefined)
      .then(() => {
        for (const id of chunk) {
          pending.delete(id);
          const done = resolvers.get(id);
          resolvers.delete(id);
          done?.();
        }
      });
  }
};

/** Look up release dates for these titles (batched with any other lookups asked for at the same moment). */
export const loadReleases = (items: (SearchResult | null | undefined)[]): Promise<void> => {
  const now = todayIso();
  const waits: Promise<void>[] = [];
  for (const i of items) {
    if (!i || !needsCheck(i, now) || dates.has(i.id)) continue;
    let p = pending.get(i.id);
    if (!p) {
      p = new Promise<void>((resolve) => resolvers.set(i.id, resolve));
      pending.set(i.id, p);
      queue.add(i.id);
    }
    waits.push(p);
  }
  if (queue.size && !flushTimer) flushTimer = setTimeout(flush, 25);
  return Promise.all(waits).then(() => undefined);
};

/** Rows, banners and lists: titles that are out (in cinemas or digitally). Coming-soon titles are left out. */
export const onlyOut = async <T extends SearchResult>(items: T[]): Promise<T[]> => {
  await loadReleases(items);
  return items.filter((i) => releaseOf(i) !== 'soon');
};

/** Coming Soon rows and lists: only titles that aren't out anywhere yet. */
export const onlySoon = async <T extends SearchResult>(items: T[]): Promise<T[]> => {
  await loadReleases(items);
  return items.filter((i) => releaseOf(i) === 'soon');
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getVersion = () => version;
/** Re-renders when new release dates arrive. */
export const useReleaseVersion = () => useSyncExternalStore(subscribe, getVersion, getVersion);

/** This title's release state (looked up if needed). */
export const useRelease = (item: SearchResult | null | undefined): Release | undefined => {
  useReleaseVersion();
  const id = item?.id;
  const type = item?.media_type;
  useEffect(() => {
    if (item) void loadReleases([item]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, type]);
  return item ? releaseOf(item) : undefined;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** When a coming-soon title comes out, e.g. "Dec 16" ("Dec 16, 2027" in another year); '' if unknown. */
export const comingDate = (item: SearchResult): string => {
  const now = todayIso();
  const r = item.media_type === 'movie' ? dates.get(item.id) : undefined;
  const next = [r?.t, r?.d, mainDate(item)].filter((x): x is string => !!x && x > now).sort()[0];
  if (!next) return '';
  const [y, m, d] = next.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${String(y) !== now.slice(0, 4) ? `, ${y}` : ''}`;
};
