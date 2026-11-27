import React, { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { jumpToY, scrollToY } from './smoothScroll';

/**
 * Tiny History-API router: real URLs (/movie/603-the-matrix, /tv/1399, /search?q=dune, …),
 * back/forward support and scroll restoration, with no extra dependency.
 */

export type Route =
  | { name: 'home' }
  | { name: 'movies' }
  | { name: 'tv' }
  | { name: 'latest' }
  | { name: 'my-list' }
  | { name: 'search'; q: string }
  | { name: 'title'; mediaType: 'movie' | 'tv'; id: number; play: boolean }
  | { name: 'explore' }
  | { name: 'languages'; search: string }
  | { name: 'browse'; search: string }
  | { name: 'brands'; kind: BrandKind }
  | { name: 'company'; key: string; search: string }
  | { name: 'provider'; id: number; search: string }
  | { name: 'franchise'; id: number }
  | { name: 'person'; id: number }
  | { name: 'watch'; mediaType: 'movie' | 'tv'; id: number; season?: number; episode?: number; t?: number }
  | { name: 'login'; next: string }
  | { name: 'signup'; next: string }
  | { name: 'forgot-password' }
  | { name: 'reset-password' }
  | { name: 'not-found' };

export type BrandKind = 'studios' | 'production' | 'providers' | 'franchises';
const BRAND_LISTS: Record<string, BrandKind> = { '/studios': 'studios', '/production-houses': 'production', '/streaming': 'providers', '/franchises': 'franchises' };

const listeners = new Set<() => void>();
const currentLocation = () => window.location.pathname + window.location.search;
let snapshot = currentLocation();
let pendingRestoreY: number | null = null;

const emit = () => {
  snapshot = currentLocation();
  listeners.forEach((l) => l());
};

/* ---------- Dialogs and Back ----------
 * A dialog (trailer, photo viewer, Get Link, player theme, reset) adds a step to the history while it's
 * open, so Back and the two-finger trackpad swipe close the dialog instead of leaving the page under it.
 * Closing it any other way (X, Esc, clicking outside) removes that step again. A step whose dialog is
 * already closed (left behind when a link inside a dialog opened another page) is skipped over. */
interface Layer { id: number; close: () => void }
const layers: Layer[] = [];
let layerSeq = 0;
let lastIdx = Number(window.history.state?.idx || 0);
let layerBack = false;
let layerBackTimer = 0;
let queuedNav: (() => void) | null = null;

const finishLayerBack = () => {
  layerBack = false;
  window.clearTimeout(layerBackTimer);
  const next = queuedNav;
  queuedNav = null;
  next?.();
};

/** While a dialog's own step is being removed, a navigation waits for it (or it would be undone). */
const waitForLayerBack = (run: () => void) => {
  if (!layerBack) return false;
  queuedNav = run;
  return true;
};

window.addEventListener('popstate', (e) => {
  const st = (e.state || {}) as Record<string, unknown>;
  const idx = Number(st.idx || 0);
  const backwards = idx < lastIdx;
  lastIdx = idx;
  const ours = layerBack;
  const here = typeof st.layer === 'number' ? st.layer : 0;
  // Close every dialog whose step we just went back past (newest first).
  const gone = layers.filter((l) => l.id > here);
  if (gone.length) {
    gone.forEach((l) => layers.splice(layers.indexOf(l), 1));
    gone.reverse().forEach((l) => l.close());
  }
  // The step of a dialog that is already closed shows nothing new: step over it.
  if (here && !layers.some((l) => l.id === here)) {
    window.history.go(backwards ? -1 : 1);
    return;
  }
  const changed = currentLocation() !== snapshot;
  pendingRestoreY = changed ? (typeof st.scrollY === 'number' ? st.scrollY : 0) : null;
  emit();
  if (ours) finishLayerBack();
});

/** Close a dialog with Back / the trackpad swipe (see above). Call it in the dialog with its open state. */
export const useCloseOnBack = (open: boolean, onClose: () => void) => {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const held = React.useRef<{ layer: Layer; timer: number } | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let h = held.current;
    if (h && h.timer) {
      // React ran the effect twice (development): keep the step that was already added.
      window.clearTimeout(h.timer);
      h.timer = 0;
    } else {
      const layer: Layer = { id: ++layerSeq, close: () => closeRef.current() };
      layers.push(layer);
      const st = window.history.state || {};
      const idx = Number(st.idx || 0) + 1;
      window.history.pushState({ ...st, scrollY: window.scrollY, idx, layer: layer.id }, '');
      lastIdx = idx;
      h = held.current = { layer, timer: 0 };
    }
    const mine = h;
    return () => {
      mine.timer = window.setTimeout(() => {
        mine.timer = 0;
        if (held.current === mine) held.current = null;
        const i = layers.indexOf(mine.layer);
        if (i < 0) return; // closed by Back: its step is already gone
        layers.splice(i, 1);
        if (window.history.state?.layer === mine.layer.id) {
          layerBack = true;
          window.clearTimeout(layerBackTimer);
          layerBackTimer = window.setTimeout(finishLayerBack, 700);
          window.history.back();
        }
      }, 0);
    };
  }, [open]);
};

/** Small view details kept on the current history step (season picked, list expanded, scroll inside the
 *  title window), so coming Back to that step shows the same thing. They don't change the address. */
export const saveEntryState = (patch: Record<string, unknown>) => {
  window.history.replaceState({ ...(window.history.state || {}), ...patch }, '');
};
export const readEntryState = <T,>(key: string): T | undefined => (window.history.state || {})[key] as T | undefined;

const isTitleLoc = (loc: string) => /^\/(movie|tv)\/\d+/.test(new URL(loc, window.location.origin).pathname);
const isWatchLoc = (loc: string) => /^\/watch\//.test(new URL(loc, window.location.origin).pathname);
const isSearchLoc = (loc: string) => /^\/search/.test(new URL(loc, window.location.origin).pathname);

/* ---------- Page transitions ----------
 * Page-to-page navigation runs inside the View Transitions API where the browser has it: the old page
 * fades out and the new one fades/lifts in (GPU snapshots, see index.css). Title windows, the player and
 * typing in search keep their own behaviour. Browsers without the API just switch pages as before. */
type ViewTransitionLike = { finished: Promise<unknown>; ready?: Promise<unknown>; updateCallbackDone?: Promise<unknown> };
let transitionsRunning = 0;
const withViewTransition = (update: () => void): boolean => {
  const doc = document as unknown as { startViewTransition?: (cb: () => void) => ViewTransitionLike };
  if (typeof doc.startViewTransition !== 'function' || document.visibilityState !== 'visible') return false;
  const root = document.documentElement;
  transitionsRunning++;
  root.classList.add('sf-vt');
  const done = () => {
    transitionsRunning = Math.max(0, transitionsRunning - 1);
    if (!transitionsRunning) root.classList.remove('sf-vt');
  };
  try {
    const t = doc.startViewTransition.call(document, () => flushSync(update));
    t.ready?.catch(() => undefined);
    t.updateCallbackDone?.catch(() => undefined);
    t.finished.then(done, done);
    return true;
  } catch {
    done();
    return false;
  }
};

export const navigate = (to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) => {
  if (waitForLayerBack(() => navigate(to, opts))) return;
  if (to === currentLocation()) {
    if (!opts.keepScroll) scrollToY(0);
    return;
  }
  // Remember where we were so "Back" lands in the same spot.
  window.history.replaceState({ ...(window.history.state || {}), scrollY: window.scrollY }, '');
  const st = window.history.state || {};
  const idx = Number(st.idx || 0);
  const nextIdx = opts.replace ? idx : idx + 1;
  let extra: Record<string, unknown> = {};
  let keepScroll = opts.keepScroll;
  // Titles open as a window over the page you were on (like Netflix): remember that page.
  if (isTitleLoc(to)) {
    keepScroll = true;
    extra = isTitleLoc(currentLocation())
      ? { bg: typeof st.bg === 'string' ? st.bg : '/', tStart: typeof st.tStart === 'number' ? st.tStart : idx }
      : { bg: currentLocation(), tStart: nextIdx };
  } else if (isWatchLoc(to)) {
    // Remember the page behind the player (and the title window it came from, if any).
    const cur = currentLocation();
    // fromY = how far the page behind was scrolled, so Back can show the title window over that exact spot.
    extra = isWatchLoc(cur)
      ? { from: st.from, fromT: st.fromT, fromY: st.fromY }
      : isTitleLoc(cur)
        ? { from: typeof st.bg === 'string' ? st.bg : '/', fromT: typeof st.tStart === 'number' ? st.tStart : idx, fromY: window.scrollY }
        : { from: cur, fromT: nextIdx, fromY: window.scrollY };
  }
  const from = currentLocation();
  // Changing only the address's ?options (tabs, filters, sort) keeps what this step remembers.
  const samePath = new URL(to, window.location.origin).pathname === new URL(from, window.location.origin).pathname;
  if (opts.replace) {
    const { layer: _layer, ...keep } = st as Record<string, unknown>;
    window.history.replaceState({ ...(samePath ? keep : {}), scrollY: keepScroll ? window.scrollY : 0, idx, ...extra }, '', to);
  } else window.history.pushState({ scrollY: 0, idx: nextIdx, ...extra }, '', to);
  lastIdx = nextIdx;
  pendingRestoreY = null;
  const update = () => {
    emit();
    if (!keepScroll) scrollToY(0);
  };
  const pageToPage =
    !opts.replace && !keepScroll &&
    !isTitleLoc(to) && !isWatchLoc(to) && !isSearchLoc(to) &&
    !isTitleLoc(from) && !isWatchLoc(from) && !isSearchLoc(from);
  if (!pageToPage || !withViewTransition(update)) update();
};

/** Leave the player for the title's window, shown over the page you were browsing before (Netflix's back). */
export const openTitleFromWatch = (titleLoc: string) => {
  if (waitForLayerBack(() => openTitleFromWatch(titleLoc))) return;
  const st = window.history.state || {};
  const idx = Number(st.idx || 0);
  const from = typeof st.from === 'string' && !isWatchLoc(st.from) && !isTitleLoc(st.from) ? st.from : '/';
  const tStart = typeof st.fromT === 'number' ? st.fromT : idx;
  // Put the page behind back where you were scrolled before the player opened (not the top of it).
  const y = typeof st.fromY === 'number' && st.fromY > 0 ? st.fromY : 0;
  window.history.replaceState({ scrollY: y, idx, bg: from, tStart }, '', titleLoc);
  pendingRestoreY = y > 0 ? y : null;
  emit();
};

/** The page shown behind the title window (defaults to Home on a direct visit). */
export const titleBackground = (): string => {
  const bg = window.history.state?.bg;
  return typeof bg === 'string' && !isTitleLoc(bg) ? bg : '/';
};

/** Close the title window: go back past every title opened from it, to the page behind. */
export const closeTitleWindow = () => {
  if (waitForLayerBack(closeTitleWindow)) return;
  const st = window.history.state || {};
  const idx = Number(st.idx || 0);
  const tStart = typeof st.tStart === 'number' ? st.tStart : 0;
  if (tStart > 0 && idx >= tStart) window.history.go(-(idx - tStart + 1));
  else navigate(titleBackground(), { replace: true, keepScroll: true });
};

export const goBack = (fallback = '/') => {
  if (waitForLayerBack(() => goBack(fallback))) return;
  if (Number(window.history.state?.idx || 0) > 0) window.history.back();
  else navigate(fallback, { replace: true });
};

/** Restore the scroll position after a back/forward navigation.
 *  Rows may still be streaming in, the closing title window may still be releasing the page lock,
 *  and the smooth-scroll library may resync after it resumes, so for 2.5s we keep putting you back
 *  on the saved spot if anything moves you, until you scroll yourself. */
let restoreRun = 0;
export const consumeScrollRestore = () => {
  if (pendingRestoreY === null) return;
  const target = pendingRestoreY;
  pendingRestoreY = null;
  const run = ++restoreRun;
  const started = Date.now();
  let userMoved = false;
  const stop = () => {
    userMoved = true;
    window.removeEventListener('wheel', stop, true);
    window.removeEventListener('touchstart', stop, true);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', stop, true);
  };
  const onKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) stop();
  };
  window.addEventListener('wheel', stop, { capture: true, passive: true });
  window.addEventListener('touchstart', stop, { capture: true, passive: true });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', stop, true);
  const attempt = () => {
    if (run !== restoreRun || userMoved) return stop();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = Math.min(target, Math.max(0, max));
    if (Math.abs(window.scrollY - y) > 2) jumpToY(y);
    if (Date.now() - started < 2500) window.setTimeout(attempt, 40);
    else stop();
  };
  attempt();
};

export const parseRoute = (loc: string): Route => {
  const url = new URL(loc, window.location.origin);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'home' };
  if (path === '/movies') return { name: 'movies' };
  if (path === '/tv' || path === '/tv-shows') return { name: 'tv' };
  if (path === '/latest') return { name: 'latest' };
  if (path === '/my-list' || path === '/my-content') return { name: 'my-list' };
  // The old How-to-use guide was removed; old links land on Home.
  if (path === '/guide') return { name: 'home' };
  if (path === '/search') return { name: 'search', q: url.searchParams.get('q') || '' };
  if (path === '/explore' || path === '/categories') return { name: 'explore' };
  if (path === '/languages' || path === '/browse-by-languages') return { name: 'languages', search: url.search };
  if (path === '/browse') return { name: 'browse', search: url.search };
  if (path === '/login' || path === '/signin') return { name: 'login', next: safeNext(url.searchParams.get('next')) };
  if (path === '/signup') return { name: 'signup', next: safeNext(url.searchParams.get('next')) };
  if (path === '/forgot-password') return { name: 'forgot-password' };
  if (path === '/reset-password') return { name: 'reset-password' };
  if (BRAND_LISTS[path]) return { name: 'brands', kind: BRAND_LISTS[path] };
  let b = path.match(/^\/(?:studio|production|company)\/([a-z0-9-]+)/);
  if (b) return { name: 'company', key: b[1], search: url.search };
  b = path.match(/^\/provider\/(\d+)/);
  if (b) return { name: 'provider', id: Number(b[1]), search: url.search };
  b = path.match(/^\/watch\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?/);
  if (b) {
    const t = Number(url.searchParams.get('t'));
    return { name: 'watch', mediaType: b[1] as 'movie' | 'tv', id: Number(b[2]), season: b[3] ? Number(b[3]) : undefined, episode: b[4] ? Number(b[4]) : undefined, t: t > 0 ? t : undefined };
  }
  b = path.match(/^\/(?:person|name)\/(\d+)/);
  if (b) return { name: 'person', id: Number(b[1]) };
  b = path.match(/^\/franchise\/(\d+)/);
  if (b) return { name: 'franchise', id: Number(b[1]) };
  const m = path.match(/^\/(?:title\/)?(movie|tv)\/(\d+)/);
  if (m) return { name: 'title', mediaType: m[1] as 'movie' | 'tv', id: Number(m[2]), play: url.searchParams.get('play') === '1' };
  return { name: 'not-found' };
};

/* ---------- Account pages ---------- */

export const AUTH_ROUTES: readonly Route['name'][] = ['login', 'signup', 'forgot-password', 'reset-password'];
const AUTH_PATHS = ['/login', '/signin', '/signup', '/forgot-password', '/reset-password'];

/** Where to go after signing in: only a path on this site, never back to an account page. */
export const safeNext = (raw: string | null | undefined): string => {
  if (!raw || raw[0] !== '/' || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return AUTH_PATHS.includes(path) ? '/' : raw;
};

/** /login, remembering the page you're on so signing in brings you back to it. */
export const signInPath = (): string => {
  const next = safeNext(currentLocation());
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
};

/** Leave an account page for `next`. Titles and the player open over Home (they remember the page
 *  behind them, which must not be the sign-in page). */
export const navigateAfterAuth = (next: string) => {
  const to = safeNext(next);
  if (to !== '/' && (isTitleLoc(to) || isWatchLoc(to))) {
    navigate('/', { replace: true });
    navigate(to);
    return;
  }
  navigate(to, { replace: true });
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useLocationString = () => useSyncExternalStore(subscribe, () => snapshot);

/** A view option kept in the page's address (?key=value): tabs, filters, sort orders.
 *  - Back, Forward and the trackpad swipe step through it. `push: true` makes the change its own step,
 *    like opening a page (use it for tabs); otherwise the current step is updated (filters, sort).
 *  - A refresh or a shared link opens the same view, and coming Back to the page restores it.
 *  An empty value, or the fallback, removes it from the address. */
export const useQueryParam = (key: string, fallback = ''): [string, (value: string, opts?: { push?: boolean }) => void] => {
  const loc = useLocationString();
  const value = React.useMemo(() => new URL(loc, window.location.origin).searchParams.get(key) ?? fallback, [loc, key, fallback]);
  const set = React.useCallback(
    (v: string, opts: { push?: boolean } = {}) => {
      const url = new URL(currentLocation(), window.location.origin);
      if (!v || v === fallback) url.searchParams.delete(key);
      else url.searchParams.set(key, v);
      navigate(url.pathname + url.search, { replace: !opts.push, keepScroll: true });
    },
    [key, fallback]
  );
  return [value, set];
};
export const useRoute = (): Route => {
  const loc = useLocationString();
  return React.useMemo(() => parseRoute(loc), [loc]);
};

type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; replace?: boolean };

/** <a> that navigates in-app on a normal click but still supports open-in-new-tab / middle-click. */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(({ to, replace, onClick, target, ...rest }, ref) => (
  <a
    ref={ref}
    href={to}
    target={target}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || target === '_blank') return;
      e.preventDefault();
      navigate(to, { replace });
    }}
    {...rest}
  />
));
Link.displayName = 'Link';
