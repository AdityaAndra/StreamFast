import React, { useSyncExternalStore } from 'react';

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
  | { name: 'not-found' };

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

export const navigate = (to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) => {
  if (to === currentLocation()) {
    if (!opts.keepScroll) window.scrollTo({ top: 0 });
    return;
  }
  // Remember where we were so "Back" lands in the same spot.
  window.history.replaceState({ ...(window.history.state || {}), scrollY: window.scrollY }, '');
  const idx = Number(window.history.state?.idx || 0);
  if (opts.replace) window.history.replaceState({ scrollY: 0, idx }, '', to);
  else window.history.pushState({ scrollY: 0, idx: idx + 1 }, '', to);
  pendingRestoreY = null;
  emit();
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
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
    window.scrollTo({ top: Math.min(target, Math.max(0, max)) });
    if (max < target && tries++ < 40) requestAnimationFrame(attempt);
  };
  requestAnimationFrame(attempt);
};

export const parseRoute = (loc: string): Route => {
  const url = new URL(loc, window.location.origin);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/browse') return { name: 'home' };
  if (path === '/movies') return { name: 'movies' };
  if (path === '/tv' || path === '/tv-shows') return { name: 'tv' };
  if (path === '/latest') return { name: 'latest' };
  if (path === '/my-list') return { name: 'my-list' };
  if (path === '/guide') return { name: 'guide' };
  if (path === '/search') return { name: 'search', q: url.searchParams.get('q') || '' };
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
