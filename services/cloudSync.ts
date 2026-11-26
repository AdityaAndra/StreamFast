/**
 * Cloud sync for signed-in users (Supabase table public.user_data, one row per user per key).
 *
 * The browser's localStorage stays the source the app reads from; this module keeps it in step with
 * the cloud:
 *  - on sign-in / page load with a session: pull every row, MERGE with what's saved here, write the
 *    result back to localStorage (screens refresh via notifyRemoteDataApplied) and upload it;
 *  - after that, every local save (notifyLocalDataChange in the save paths) is uploaded after a short
 *    debounce, batched by key (read-merge-write, so another device's newer items are never dropped);
 *  - when the tab becomes visible again (at most every 30s), pull + merge so another device's
 *    progress shows up.
 * Signing out stops syncing and leaves this browser's data alone.
 *
 * Merge rules
 *  - progress, my_list: union by title (media_type + id); the copy with the newest savedAt wins;
 *    newest first. A title removed on a device leaves a "removed at" marker (tombstone) so the other
 *    devices don't bring it back; saving it again later (newer savedAt) wins over the marker.
 *  - recent_searches: union (case-insensitive), newest first, capped at MAX_RECENT; cleared entries
 *    leave markers too.
 *  - notifications: read / already-alerted ids are unioned; the desktop-alerts switch is a setting.
 *  - theme, default_server, region (+ alerts switch): a value changed on this device since the last
 *    sync is uploaded; otherwise the cloud value wins if there is one, else the local one is uploaded.
 *
 * localStorage key names and the shape of what's stored there are unchanged. Sync bookkeeping
 * (last-synced ids, tombstones, setting values) lives in its own key, sf_sync_meta.
 * Errors (offline, Supabase down) never reach the UI: they're logged once and retried on the next
 * change, when the tab is shown again, or when the browser comes back online.
 */
import type { MyListItem, WatchProgressItem } from '../types';
import { SYNC_KEYS, onLocalDataChange, notifyRemoteDataApplied } from './storage';
import type { SyncKey } from './storage';
import { MAX_RECENT } from '../utils/recentSearches';
import { supabase } from './supabase';

/* ---------- where each synced thing lives in localStorage (names unchanged) ---------- */
const LS = {
  progress: 'streamfast_continue_watching', // services/storage.ts
  my_list: 'streamfast_my_list', // services/storage.ts
  theme: 'streamfast_player_theme', // services/storage.ts
  default_server: 'sf_server', // pages/WatchPage.tsx
  recent_searches: 'streamfast_recent_searches', // utils/recentSearches.ts
  seen: 'sf_bell_seen', // components/Brand.tsx (notifications read)
  notified: 'sf_bell_notified', // components/Brand.tsx (desktop alerts already shown)
  alerts: 'sf_bell_alerts', // components/Brand.tsx ('1' / '0')
  region: 'sf_region', // utils/brands.ts
} as const;
const META_KEY = 'sf_sync_meta';

const DEBOUNCE_MS = 1500;
/** Watching saves progress every 5s; upload it at most this often while it keeps changing. */
const PROGRESS_GAP_MS = 30000;
/** Pull again when the tab is shown, at most this often. */
const PULL_EVERY_MS = 30000;
const TOMBSTONE_TTL_MS = 120 * 86400000;
const MAX_TOMBSTONES = 500;
const MAX_IDS = 400; // same cap the bell uses
/** user_data.value is limited to 512 kB; keep each list comfortably below that. */
const MAX_VALUE_CHARS = 400000;

type ListKey = 'progress' | 'my_list' | 'recent_searches';
type ScalarKey = 'theme' | 'default_server' | 'region' | 'alerts';
const LIST_KEYS: readonly ListKey[] = ['progress', 'my_list', 'recent_searches'];
const SCALAR_KEYS: readonly ScalarKey[] = ['theme', 'default_server', 'region', 'alerts'];

interface Meta {
  uid: string;
  /** ids in each list after the last sync (to notice removals made here) */
  known: Partial<Record<ListKey, string[]>>;
  /** id -> when it was removed */
  removed: Partial<Record<ListKey, Record<string, number>>>;
  /** recent searches have no timestamps of their own: when each was searched (lower-case query) */
  recentAt: Record<string, number>;
  /** setting values as last agreed with the cloud */
  synced: Partial<Record<ScalarKey, string | null>>;
}

interface Entry {
  id: string;
  at: number;
  value: unknown;
}

interface Row {
  key: string;
  value: unknown;
}

/* ---------- small helpers ---------- */
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const readRaw = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

const writeRaw = (k: string, v: string | null): void => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* storage full or blocked */
  }
};

const parseJSON = (raw: string | null): unknown => {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

const readArray = (k: string): unknown[] => {
  const v = parseJSON(readRaw(k));
  return Array.isArray(v) ? (v as unknown[]) : [];
};

/** JSON with sorted object keys, to compare values regardless of key order (jsonb reorders keys). */
const stable = (x: unknown): string => {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (isObj(x)) {
    const o = x;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(x === undefined ? null : x);
};

/* ---------- titles (Continue Watching / My List) ---------- */
const mediaId = (x: unknown): string | null => {
  if (!isObj(x) || !isObj(x.media)) return null;
  const { id, media_type } = x.media;
  return typeof id === 'number' && (media_type === 'movie' || media_type === 'tv') ? `${media_type}:${id}` : null;
};

const savedAtOf = (x: unknown): number => (isObj(x) && typeof x.savedAt === 'number' ? x.savedAt : 0);

/** Items coming from the cloud must look like what the UI expects (title / name present). */
const validMedia = (m: unknown): boolean =>
  isObj(m) &&
  typeof m.id === 'number' &&
  ((m.media_type === 'movie' && typeof m.title === 'string') || (m.media_type === 'tv' && typeof m.name === 'string'));

const isProgressItem = (x: unknown): x is WatchProgressItem => isObj(x) && validMedia(x.media) && typeof x.savedAt === 'number' && isObj(x.progress);
const isMyListItem = (x: unknown): x is MyListItem => isObj(x) && validMedia(x.media) && typeof x.savedAt === 'number';

const titleEntries = (items: unknown[]): Entry[] =>
  items.flatMap((x): Entry[] => {
    const id = mediaId(x);
    return id ? [{ id, at: savedAtOf(x), value: x }] : [];
  });

/* ---------- generic list merge ---------- */
const parseRemoved = (x: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (isObj(x)) {
    for (const [k, v] of Object.entries(x)) if (typeof v === 'number' && Number.isFinite(v) && k.length <= 300) out[k] = v;
  }
  return out;
};

/** Union by id (newest copy wins, local wins ties), minus anything removed after it was saved. */
const mergeEntries = (cloud: Entry[], local: Entry[], removed: Record<string, number>): Entry[] => {
  const map = new Map<string, Entry>();
  for (const e of [...cloud, ...local]) {
    const prev = map.get(e.id);
    if (!prev || e.at >= prev.at) map.set(e.id, e);
  }
  return [...map.values()]
    .filter((e) => {
      const gone = removed[e.id];
      return gone === undefined || gone < e.at;
    })
    .sort((a, b) => b.at - a.at);
};

const mergeRemoved = (a: Record<string, number>, b: Record<string, number>, present: Entry[], now: number): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    for (const [id, t] of Object.entries(src)) {
      const cur = out[id];
      if (cur === undefined || t > cur) out[id] = t;
    }
  }
  // A newer copy is back in the list: the marker isn't needed any more.
  for (const e of present) {
    const t = out[e.id];
    if (t !== undefined && t < e.at) delete out[e.id];
  }
  const kept = Object.entries(out)
    .filter(([, t]) => now - t < TOMBSTONE_TTL_MS)
    .sort((x, y) => y[1] - x[1])
    .slice(0, MAX_TOMBSTONES);
  return Object.fromEntries(kept);
};

/** Drop the oldest entries until the JSON fits in a user_data row. */
const fitForCloud = <T,>(items: T[]): T[] => {
  let out = items;
  while (out.length > 1 && JSON.stringify(out).length > MAX_VALUE_CHARS) {
    out = out.slice(0, Math.max(1, Math.floor(out.length * 0.9)));
  }
  return out;
};

/* ---------- bookkeeping ---------- */
const freshMeta = (uid: string): Meta => ({ uid, known: {}, removed: {}, recentAt: {}, synced: {} });

const loadMeta = (uid: string): Meta => {
  const m = parseJSON(readRaw(META_KEY));
  // Another account was synced here before: start its bookkeeping afresh (data itself is kept).
  if (!isObj(m) || m.uid !== uid) return freshMeta(uid);
  const meta = freshMeta(uid);
  const known = m.known;
  if (isObj(known)) {
    for (const k of LIST_KEYS) {
      const ids = known[k];
      if (Array.isArray(ids)) meta.known[k] = ids.filter((x): x is string => typeof x === 'string');
    }
  }
  const removed = m.removed;
  if (isObj(removed)) {
    for (const k of LIST_KEYS) meta.removed[k] = parseRemoved(removed[k]);
  }
  meta.recentAt = parseRemoved(m.recentAt);
  const synced = m.synced;
  if (isObj(synced)) {
    for (const k of SCALAR_KEYS) {
      const v = synced[k];
      if (typeof v === 'string' || v === null) meta.synced[k] = v;
    }
  }
  return meta;
};

const saveMeta = (meta: Meta): void => writeRaw(META_KEY, JSON.stringify(meta));

/** Recent searches saved here, with the time each was searched (assigned the first time we see it). */
const localRecentEntries = (meta: Meta, now: number): Entry[] => {
  const list = readArray(LS.recent_searches).filter((q): q is string => typeof q === 'string');
  const known = meta.known.recent_searches || [];
  const seen = new Set<string>();
  const out: Entry[] = [];
  list.forEach((q, i) => {
    const id = q.toLowerCase();
    if (seen.has(id)) return;
    seen.add(id);
    let at = meta.recentAt[id];
    // A search always goes to the front of the list, so a new front item was just searched.
    if (at === undefined || (i === 0 && known[0] !== id)) {
      at = now - i;
      meta.recentAt[id] = at;
    }
    out.push({ id, at, value: q });
  });
  return out;
};

const localEntries = (key: ListKey, meta: Meta, now: number): Entry[] =>
  key === 'recent_searches' ? localRecentEntries(meta, now) : titleEntries(readArray(LS[key]));

/** Notice titles / searches removed on this device since the last sync and remember when. */
const scanRemovals = (meta: Meta, keys: readonly SyncKey[], now: number): void => {
  for (const key of LIST_KEYS) {
    if (!keys.includes(key)) continue;
    const ids = localEntries(key, meta, now).map((e) => e.id);
    const prev = meta.known[key];
    if (prev) {
      const present = new Set(ids);
      const removed = meta.removed[key] || (meta.removed[key] = {});
      for (const id of prev) if (!present.has(id)) removed[id] = Math.max(removed[id] || 0, now);
    }
    meta.known[key] = ids;
  }
};

/* ---------- per-key merge ---------- */
interface MergeResult {
  /** localStorage was updated with data from the cloud */
  changed: boolean;
  /** new cloud value to upload (undefined = cloud already up to date) */
  upload?: unknown;
  /** setting values to record once the upload succeeded */
  syncedAfterUpload?: Partial<Record<ScalarKey, string | null>>;
}

const mergeList = (key: ListKey, exists: boolean, cloudValue: unknown, meta: Meta, now: number): MergeResult => {
  const cloud: Record<string, unknown> = exists && isObj(cloudValue) ? cloudValue : {};
  const cloudItems = Array.isArray(cloud.items) ? (cloud.items as unknown[]) : [];
  let cloudEntries: Entry[];
  if (key === 'recent_searches') {
    cloudEntries = cloudItems.flatMap((x): Entry[] =>
      isObj(x) && typeof x.q === 'string' && x.q.trim() && x.q.length <= 200 && typeof x.at === 'number'
        ? [{ id: x.q.toLowerCase(), at: x.at, value: x.q }]
        : []
    );
  } else {
    cloudEntries = titleEntries(cloudItems.filter((x) => (key === 'progress' ? isProgressItem(x) : isMyListItem(x))));
  }
  const local = localEntries(key, meta, now);
  const removedBoth = mergeRemoved(meta.removed[key] || {}, parseRemoved(cloud.removed), [], now);
  let merged = mergeEntries(cloudEntries, local, removedBoth);
  if (key === 'recent_searches') merged = merged.slice(0, MAX_RECENT);
  const removed = mergeRemoved(removedBoth, {}, merged, now);

  // Write back to this browser (same shape as before: an array, newest first).
  const localValue = merged.map((e) => e.value);
  const beforeRaw = readRaw(LS[key]);
  let changed = false;
  if (stable(localValue) !== stable(parseJSON(beforeRaw) ?? [])) {
    if (localValue.length || beforeRaw !== null) writeRaw(LS[key], JSON.stringify(localValue));
    changed = true;
  }
  meta.known[key] = merged.map((e) => e.id);
  meta.removed[key] = removed;
  if (key === 'recent_searches') meta.recentAt = Object.fromEntries(merged.map((e): [string, number] => [e.id, e.at]));

  const items = key === 'recent_searches' ? merged.map((e) => ({ q: e.value, at: e.at })) : fitForCloud(localValue);
  const next = { items, removed };
  return { changed, upload: !exists || stable(next) !== stable(cloudValue) ? next : undefined };
};

const validScalar = (key: ScalarKey, v: unknown): v is string | null => {
  if (v === null) return true;
  if (typeof v !== 'string' || v.length > 200) return false;
  if (key === 'theme') {
    const t = parseJSON(v);
    return isObj(t) && typeof t.name === 'string' && typeof t.hex === 'string' && /^#[0-9a-f]{3,8}$/i.test(t.hex);
  }
  if (key === 'region') return /^[A-Z]{2}$/.test(v);
  if (key === 'alerts') return v === '0' || v === '1';
  return /^[\w .-]{0,40}$/.test(v); // server name ('' / null = Auto)
};

/** One setting: changed here since the last sync -> upload; else the cloud wins if it has one. */
const mergeScalar = (key: ScalarKey, lsKey: string, hasCloud: boolean, cloudV: unknown, meta: Meta): { changed: boolean; value: string | null; upload: boolean } => {
  const local = readRaw(lsKey);
  const synced = meta.synced[key];
  const dirty = synced !== undefined && local !== synced;
  // null = "not set", except for the default server where it means Auto was chosen.
  const cloudOk = hasCloud && validScalar(key, cloudV) && (cloudV !== null || key === 'default_server');
  if (dirty || !cloudOk) {
    const upload = cloudOk ? cloudV !== local : local !== null;
    if (!upload && cloudOk) meta.synced[key] = local; // already the same on both sides
    return { changed: false, value: local, upload };
  }
  const v = cloudV as string | null;
  meta.synced[key] = v;
  if (v === local) return { changed: false, value: v, upload: false };
  writeRaw(lsKey, v);
  return { changed: true, value: v, upload: false };
};

const mergeSetting = (key: 'theme' | 'default_server' | 'region', exists: boolean, cloudValue: unknown, meta: Meta): MergeResult => {
  const cloudV = isObj(cloudValue) ? cloudValue.v : undefined;
  const r = mergeScalar(key, LS[key], exists && isObj(cloudValue) && 'v' in cloudValue, cloudV, meta);
  if (!r.upload) return { changed: r.changed };
  const syncedAfterUpload: Partial<Record<ScalarKey, string | null>> = {};
  syncedAfterUpload[key] = r.value;
  return { changed: r.changed, upload: { v: r.value }, syncedAfterUpload };
};

const unionIds = (a: unknown, b: unknown): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of [a, b]) {
    if (!Array.isArray(list)) continue;
    for (const x of list) {
      if (typeof x !== 'string' || x.length > 200 || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
  }
  return out.slice(-MAX_IDS);
};

const mergeNotifications = (exists: boolean, cloudValue: unknown, meta: Meta): MergeResult => {
  const cloud: Record<string, unknown> = exists && isObj(cloudValue) ? cloudValue : {};
  let changed = false;
  const sets: Record<'seen' | 'notified', string[]> = { seen: [], notified: [] };
  for (const part of ['seen', 'notified'] as const) {
    const raw = readRaw(LS[part]);
    const local = parseJSON(raw);
    const merged = unionIds(cloud[part], Array.isArray(local) ? local : []);
    sets[part] = merged;
    if (stable(merged) !== stable(Array.isArray(local) ? local : [])) {
      if (merged.length || raw !== null) writeRaw(LS[part], JSON.stringify(merged));
      changed = true;
    }
  }
  const alerts = mergeScalar('alerts', LS.alerts, exists && isObj(cloudValue) && 'alerts' in cloudValue, cloud.alerts, meta);
  const next = { seen: sets.seen, notified: sets.notified, alerts: alerts.value };
  const upload = !exists || stable(next) !== stable(cloudValue) ? next : undefined;
  return {
    changed: changed || alerts.changed,
    upload,
    syncedAfterUpload: upload !== undefined && alerts.upload ? { alerts: alerts.value } : undefined,
  };
};

const mergeKey = (key: SyncKey, exists: boolean, value: unknown, meta: Meta, now: number): MergeResult => {
  switch (key) {
    case 'progress':
    case 'my_list':
    case 'recent_searches':
      return mergeList(key, exists, value, meta, now);
    case 'notifications':
      return mergeNotifications(exists, value, meta);
    default:
      return mergeSetting(key, exists, value, meta);
  }
};

/** Everything that would be uploaded for a key, to skip saves that didn't change anything. */
const localSignature = (key: SyncKey): string =>
  key === 'notifications' ? [readRaw(LS.seen), readRaw(LS.notified), readRaw(LS.alerts)].join('\u0000') : String(readRaw(LS[key]));

/* ---------- status (shown in the profile menu) ---------- */
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'error';
let status: SyncStatus = 'off';
const statusListeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l());
};
export const getSyncStatus = (): SyncStatus => status;
export const subscribeSyncStatus = (cb: () => void): (() => void) => {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
};

/* ---------- engine ---------- */
let userId: string | null = null;
let generation = 0;
let queue: Promise<void> = Promise.resolve();
const pending = new Set<SyncKey>();
const lastSig = new Map<SyncKey, string>();
let timer: number | undefined;
let lastProgressSync = 0;
let lastPull = 0;
let warned = false;
let unsubscribeLocal: (() => void) | null = null;

const syncKeys = async (keys: SyncKey[], gen: number): Promise<void> => {
  const client = supabase;
  const uid = userId;
  if (!client || !uid || gen !== generation) return;
  setStatus('syncing');
  try {
    // Note removals made here before reading the cloud (and again right before merging, below).
    const early = loadMeta(uid);
    scanRemovals(early, keys, Date.now());
    saveMeta(early);

    const { data, error } = await client.from('user_data').select('key, value').in('key', keys);
    if (error) throw error;
    if (gen !== generation) return;

    const rows = new Map<string, unknown>();
    for (const r of (data || []) as unknown as Row[]) rows.set(r.key, r.value);

    // Synchronous from here until the upload: nothing else can write localStorage in between.
    const now = Date.now();
    const meta = loadMeta(uid);
    scanRemovals(meta, keys, now);
    const changed: SyncKey[] = [];
    const upserts: { user_id: string; key: SyncKey; value: unknown; updated_at: string }[] = [];
    const afterUpload: Partial<Record<ScalarKey, string | null>> = {};
    for (const key of keys) {
      const res = mergeKey(key, rows.has(key), rows.get(key), meta, now);
      if (res.changed) changed.push(key);
      if (res.upload !== undefined) {
        upserts.push({ user_id: uid, key, value: res.upload, updated_at: new Date(now).toISOString() });
        Object.assign(afterUpload, res.syncedAfterUpload || {});
      }
    }
    saveMeta(meta);
    keys.forEach((k) => lastSig.set(k, localSignature(k)));
    if (changed.length) notifyRemoteDataApplied(changed);

    if (upserts.length) {
      const { error: upError } = await client.from('user_data').upsert(upserts, { onConflict: 'user_id,key' });
      if (upError) throw upError;
      // Only now do the uploaded settings count as agreed with the cloud.
      const latest = loadMeta(uid);
      Object.assign(latest.synced, afterUpload);
      saveMeta(latest);
    }
    if (keys.includes('progress')) lastProgressSync = Date.now();
    warned = false;
    if (gen === generation) setStatus('synced');
  } catch (err) {
    if (gen !== generation) return;
    keys.forEach((k) => {
      pending.add(k);
      lastSig.delete(k);
    });
    setStatus('error');
    if (!warned) {
      warned = true;
      console.warn('[StreamFast] Cloud sync failed; your changes are kept here and will sync later.', err);
    }
  }
};

/** Run sync jobs one at a time; keysFn picks the keys when the job actually starts. */
const enqueue = (keysFn: () => SyncKey[]): Promise<void> => {
  const gen = generation;
  const job = queue.then(async () => {
    if (gen !== generation) return;
    const keys = keysFn();
    if (keys.length) await syncKeys(keys, gen);
  });
  queue = job.catch(() => undefined);
  return job;
};

const takePending = (): SyncKey[] => {
  const keys = SYNC_KEYS.filter((k) => pending.has(k));
  pending.clear();
  return keys;
};

const flush = (): Promise<void> => {
  window.clearTimeout(timer);
  timer = undefined;
  return enqueue(takePending);
};

const schedule = () => {
  if (!userId || !pending.size) return;
  window.clearTimeout(timer);
  let wait = DEBOUNCE_MS;
  if ([...pending].every((k) => k === 'progress')) wait = Math.max(wait, lastProgressSync + PROGRESS_GAP_MS - Date.now());
  timer = window.setTimeout(() => {
    void flush();
  }, wait);
};

const pullAll = () => {
  lastPull = Date.now();
  pending.clear();
  window.clearTimeout(timer);
  timer = undefined;
  void enqueue(() => [...SYNC_KEYS]);
};

const onLocalChange = (key: SyncKey) => {
  if (!userId) return;
  if (lastSig.get(key) === localSignature(key)) return; // saved, but nothing actually changed
  pending.add(key);
  schedule();
};

const onVisibility = () => {
  if (!userId) return;
  if (document.visibilityState === 'hidden') {
    if (pending.size) void flush();
    return;
  }
  if (Date.now() - lastPull >= PULL_EVERY_MS) pullAll();
  else if (pending.size) schedule();
};

const onOnline = () => {
  if (userId && pending.size) void flush();
};

/** Start syncing for a signed-in user (idempotent). */
export const startCloudSync = (uid: string): void => {
  if (!supabase) return;
  if (userId === uid) return;
  stopCloudSync();
  userId = uid;
  generation++;
  unsubscribeLocal = onLocalDataChange(onLocalChange);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('online', onOnline);
  pullAll();
};

/** Stop syncing (sign-out). Data saved in this browser is left as it is. */
export const stopCloudSync = (): void => {
  generation++;
  window.clearTimeout(timer);
  timer = undefined;
  pending.clear();
  lastSig.clear();
  unsubscribeLocal?.();
  unsubscribeLocal = null;
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('online', onOnline);
  userId = null;
  setStatus('off');
};

/** Upload anything still waiting (e.g. right before signing out). */
export const flushCloudSync = (): Promise<void> => (userId ? flush() : Promise.resolve());
