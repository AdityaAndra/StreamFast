import React, { useSyncExternalStore } from 'react';
import { scrollToY } from './smoothScroll';

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
  | { name: 'guide' }
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

window.addEventListener('popstate', (e) => {
  pendingRestoreY = typeof e.state?.scrollY === 'number' ? e.state.scrollY : 0;
  emit();
});

const isTitleLoc = (loc: string) => /^\/(movie|tv)\/\d+/.test(new URL(loc, window.location.origin).pathname);

export const navigate = (to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) => {
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
  }
  if (opts.replace) window.history.replaceState({ scrollY: 0, idx, ...extra }, '', to);
  else window.history.pushState({ scrollY: 0, idx: nextIdx, ...extra }, '', to);
  pendingRestoreY = null;
  emit();
  if (!keepScroll) scrollToY(0);
};

/** The page shown behind the title window (defaults to Home on a direct visit). */
export const titleBackground = (): string => {
  const bg = window.history.state?.bg;
  return typeof bg === 'string' && !isTitleLoc(bg) ? bg : '/';
};

/** Close the title window: go back past every title opened from it, to the page behind. */
export const closeTitleWindow = () => {
  const st = window.history.state || {};
  const idx = Number(st.idx || 0);
  const tStart = typeof st.tStart === 'number' ? st.tStart : 0;
  if (tStart > 0 && idx >= tStart) window.history.go(-(idx - tStart + 1));
  else navigate(titleBackground(), { replace: true, keepScroll: true });
};

export const goBack = (fallback = '/') => {
  if (Number(window.history.state?.idx || 0) > 0) window.history.back();
  else navigate(fallback, { replace: true });
};

/** Restore the scroll position after a back/forward navigation (retries while content streams in). */
export const consumeScrollRestore = () => {
  if (pendingRestoreY === null) return;
  const target = pendingRestoreY;
  pendingRestoreY = null;
  let tries = 0;
  const attempt = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollToY(Math.min(target, Math.max(0, max)));
    if (max < target && tries++ < 40) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
};

export const parseRoute = (loc: string): Route => {
  const url = new URL(loc, window.location.origin);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return { name: 'home' };
  if (path === '/movies') return { name: 'movies' };
  if (path === '/tv' || path === '/tv-shows') return { name: 'tv' };
  if (path === '/latest') return { name: 'latest' };
  if (path === '/my-list' || path === '/my-content') return { name: 'my-list' };
  if (path === '/guide') return { name: 'guide' };
  if (path === '/search') return { name: 'search', q: url.searchParams.get('q') || '' };
  if (path === '/explore' || path === '/categories') return { name: 'explore' };
  if (path === '/languages' || path === '/browse-by-languages') return { name: 'languages', search: url.search };
  if (path === '/browse') return { name: 'browse', search: url.search };
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

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const useLocationString = () => useSyncExternalStore(subscribe, () => snapshot);
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
