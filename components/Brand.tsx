import React, { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../types';
import { getNowPlayingMovies, getOnTheAirTvShows } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { getTitle, tmdbImage, titlePath } from '../utils/media';
import { Link } from '../utils/router';
import { BellIcon } from './Icons';

/** StreamFast logo: a sliced red play mark with motion trails, and a two-weight wordmark
 *  (light STREAM, heavy red FAST with a top sheen). Text uses the site's Inter font. */
export const StreamFastLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="-4 0 218 40" className={`sf-logo sf-logo ${className}`} role="img" aria-label="StreamFast">
    <defs>
      <linearGradient id="sf-red" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stopColor="#ff3b47" />
        <stop offset="0.55" stopColor="#e50914" />
        <stop offset="1" stopColor="#8e050c" />
      </linearGradient>
      <linearGradient id="sf-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="sf-trail" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#e50914" />
        <stop offset="1" stopColor="#e50914" stopOpacity="0" />
      </linearGradient>
      <mask id="sf-cut">
        <rect x="-4" width="44" height="40" fill="#fff" />
        <rect x="-4" y="14.4" width="44" height="1.8" fill="#000" />
        <rect x="-4" y="23.8" width="44" height="1.8" fill="#000" />
      </mask>
    </defs>
    <g mask="url(#sf-cut)">
      <path d="M11 7.5 L31.5 20 L11 32.5 Z" fill="url(#sf-red)" stroke="url(#sf-red)" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M11 7.5 L31.5 20 L11 32.5 Z" fill="url(#sf-sheen)" />
    </g>
    <rect x="1" y="9.6" width="7.5" height="2.8" rx="1.4" fill="url(#sf-trail)" opacity="0.7" />
    <rect x="-3.5" y="18.6" width="12" height="2.8" rx="1.4" fill="url(#sf-trail)" />
    <rect x="1" y="27.6" width="7.5" height="2.8" rx="1.4" fill="url(#sf-trail)" opacity="0.7" />
    <g style={{ fontFamily: '"Inter Variable", Inter, Arial, sans-serif' }}>
      <text x="42" y="29" fontSize="24" fontWeight="300" fill="#f5f5f1" textLength="103" lengthAdjust="spacing" letterSpacing="1.6">
        STREAM
      </text>
      <text x="146" y="29" fontSize="24" fontWeight="800" fill="url(#sf-red)" textLength="65" lengthAdjust="spacing">
        FAST
      </text>
      <text x="146" y="29" fontSize="24" fontWeight="800" fill="url(#sf-sheen)" textLength="65" lengthAdjust="spacing" aria-hidden="true">
        FAST
      </text>
    </g>
  </svg>
);

/** Profile avatar (rounded square with a smile, in StreamFast red). */
export const Avatar: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="flex-shrink-0">
    <defs>
      <linearGradient id="sf-av" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ff4652" />
        <stop offset="1" stopColor="#8f050d" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="6" fill="url(#sf-av)" />
    <rect width="32" height="16" rx="6" fill="#fff" fillOpacity="0.08" />
    <circle cx="11" cy="12.5" r="2.2" fill="#fff" />
    <circle cx="21" cy="12.5" r="2.2" fill="#fff" />
    <path d="M9.4 19.2c3.6 3.9 9.6 3.9 13.2 0" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const SEEN_KEY = 'sf_bell_seen';

const interleave = (a: SearchResult[], b: SearchResult[]) => {
  const out: SearchResult[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
};

const ago = (date?: string) => {
  if (!date) return '';
  const days = Math.round((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 0) return 'Coming soon';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} week${days >= 14 ? 's' : ''} ago`;
  return `${Math.round(days / 30)} month${days >= 60 ? 's' : ''} ago`;
};

/** Netflix-style notifications: new arrivals and new episodes. */
export const NotificationsBell: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) || '';
    } catch {
      return '';
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  const { data } = useCachedData<SearchResult[]>(ready ? 'bell' : null, async () => {
    const [movies, shows] = await Promise.all([getNowPlayingMovies(), getOnTheAirTvShows()]);
    return interleave(movies.slice(0, 6), shows.slice(0, 6)).filter((i) => i.backdrop_path).slice(0, 10);
  });

  const stamp = data ? data.map((i) => i.id).join(',') : '';
  const unread = data && stamp !== seen ? data.length : 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (stamp) {
      setSeen(stamp);
      try {
        localStorage.setItem(SEEN_KEY, stamp);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} aria-expanded={open} className="relative flex h-9 w-9 items-center justify-center text-white transition-transform duration-200 hover:scale-105">
        <BellIcon className="h-[22px] w-[22px]" />
        {unread > 0 && (
          <span className="absolute right-[3px] top-[2px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-netflix-red px-[4px] text-[10px] font-bold leading-none text-white ring-2 ring-[#141414]">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          data-lenis-prevent
          className="absolute right-[-3.5rem] top-[calc(100%+0.8rem)] z-50 max-h-[min(72vh,560px)] w-[min(92vw,25rem)] overflow-y-auto overscroll-contain rounded-xl bg-[#181818]/[0.98] py-2 shadow-[0_18px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-md animate-dropdown-in sm:right-0"
        >
          <p className="px-4 pb-2 pt-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8c8c8c]">Notifications</p>
          {(data || []).map((item) => {
            const date = item.media_type === 'movie' ? item.release_date : item.first_air_date;
            return (
              <Link
                key={`${item.media_type}-${item.id}`}
                to={titlePath(item)}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3.5 px-4 py-2.5 transition-colors duration-150 hover:bg-white/[0.06]"
              >
                <img src={tmdbImage(item.backdrop_path, 'w300') || ''} alt="" loading="lazy" className="aspect-video w-[7.2rem] flex-shrink-0 rounded-md object-cover" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-white">{item.media_type === 'movie' ? 'New Arrival' : 'New Episodes'}</span>
                  <span className="block truncate text-[14px] text-netflix-text">{getTitle(item)}</span>
                  <span className="block text-[12px] text-[#8c8c8c]">{item.media_type === 'movie' ? ago(date) : 'This week'}</span>
                </span>
              </Link>
            );
          })}
          {!data && <p className="px-4 py-6 text-center text-sm text-netflix-muted">Loading…</p>}
        </div>
      )}
    </div>
  );
};
