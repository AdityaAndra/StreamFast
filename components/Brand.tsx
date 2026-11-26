import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, WatchProgress } from '../types';
import { getNowPlayingMovies, getAiringTodayTv, tmdbGet } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { getTitle, tmdbImage, titlePath } from '../utils/media';
import { Link, navigate } from '../utils/router';
import { useAppContext } from '../contexts/AppContext';
import { BellIcon } from './Icons';

/** StreamFast logo: a sliced red play mark with motion trails, and a two-weight wordmark
 *  (light STREAM, heavy red FAST with a top sheen). Text uses the site's Inter font. */
export const StreamFastLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="-4 0 218 40" className={`sf-logo ${className}`} role="img" aria-label="StreamFast">
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

/* ===================== Notifications =====================
   Real notifications, built from TMDB's actual air / release dates:
   - For you: new episodes / seasons of shows in your Continue Watching and My List (only ones you
     haven't watched yet), upcoming episodes in the next 2 weeks, and My List movies that just came out
     or are coming soon.
   - New on StreamFast: movies now in cinemas and shows with a new episode airing today.
   Desktop alerts (optional, browser permission) pop up for new "For you" items while the site is open. */

const SEEN_KEY = 'sf_bell_seen';
const NOTIFIED_KEY = 'sf_bell_notified';
const ALERTS_KEY = 'sf_bell_alerts';
const DAY = 86400000;
const REFRESH_MS = 30 * 60 * 1000;
const MAX_TRACKED = 24;

interface Note {
  id: string;
  label: string;
  title: string;
  sub: string;
  when: number;
  upcoming: boolean;
  img: string | null;
  to: string;
  personal: boolean;
}

const readSet = (key: string): Set<string> => {
  try {
    const v = localStorage.getItem(key) || '';
    return new Set(v.startsWith('[') ? (JSON.parse(v) as string[]) : []);
  } catch {
    return new Set();
  }
};
const writeSet = (key: string, s: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...s].slice(-400)));
  } catch {
    /* ignore */
  }
};

/** "2026-11-24" -> local midnight timestamp. */
const day = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).getTime() : NaN);
const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
};

const relDay = (ts: number) => {
  const diff = Math.round((ts - startOfToday()) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
  if (diff > 0) return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const d = -diff;
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.round(d / 7)} week${d >= 14 ? 's' : ''} ago`;
  return `${Math.round(d / 30)} month${d >= 60 ? 's' : ''} ago`;
};

const img = (path?: string | null) => tmdbImage(path, 'w300');

interface Tracked {
  media: SearchResult;
  progress?: WatchProgress;
}

/** True when your saved progress is already at or past this episode. */
const watchedPast = (p: WatchProgress | undefined, s: number, e: number) =>
  !!p?.season && (p.season > s || (p.season === s && (p.episode || 0) >= e));

const buildPersonal = async (tracked: Tracked[]): Promise<Note[]> => {
  const today = startOfToday();
  const results = await Promise.all(
    tracked.map(async ({ media, progress }): Promise<Note[]> => {
      try {
        const name = getTitle(media);
        const to = titlePath(media);
        if (media.media_type === 'tv') {
          const d: any = await tmdbGet(`/tv/${media.id}`);
          const out: Note[] = [];
          const last = d.last_episode_to_air;
          const nxt = d.next_episode_to_air;
          if (last?.air_date) {
            const t = day(last.air_date);
            if (t <= today && today - t <= 30 * DAY && !watchedPast(progress, last.season_number, last.episode_number)) {
              const premiere = last.episode_number === 1 && last.season_number > 1;
              out.push({
                id: `tv-${media.id}-s${last.season_number}e${last.episode_number}`,
                label: premiere ? 'New Season' : 'New Episode',
                title: name,
                sub: premiere ? `Season ${last.season_number} is now available` : `S${last.season_number}:E${last.episode_number}${last.name ? ` · ${last.name}` : ''}`,
                when: t,
                upcoming: false,
                img: img(last.still_path) || img(d.backdrop_path || media.backdrop_path),
                to,
                personal: true,
              });
            }
          }
          if (nxt?.air_date) {
            const t = day(nxt.air_date);
            if (t > today && t - today <= 14 * DAY) {
              const premiere = nxt.episode_number === 1;
              out.push({
                id: `tv-${media.id}-next-s${nxt.season_number}e${nxt.episode_number}`,
                label: premiere ? 'Season Premiere' : 'Coming Soon',
                title: name,
                sub: `${premiere ? `Season ${nxt.season_number}` : `S${nxt.season_number}:E${nxt.episode_number}`} · ${relDay(t)}`,
                when: t,
                upcoming: true,
                img: img(d.backdrop_path || media.backdrop_path),
                to,
                personal: true,
              });
            }
          }
          return out;
        }
        const m: any = await tmdbGet(`/movie/${media.id}`);
        const t = day(m.release_date);
        if (Number.isNaN(t)) return [];
        if (t <= today && today - t <= 30 * DAY) {
          return [{ id: `movie-${media.id}-out`, label: 'Now Available', title: name, sub: `Released ${relDay(t).toLowerCase()}`, when: t, upcoming: false, img: img(m.backdrop_path || media.backdrop_path), to, personal: true }];
        }
        if (t > today && t - today <= 30 * DAY) {
          return [{ id: `movie-${media.id}-soon`, label: 'Coming Soon', title: name, sub: `Out ${relDay(t)}`, when: t, upcoming: true, img: img(m.backdrop_path || media.backdrop_path), to, personal: true }];
        }
        return [];
      } catch {
        return [];
      }
    })
  );
  return results.flat();
};

const buildArrivals = async (): Promise<Note[]> => {
  const today = startOfToday();
  const [movies, shows] = await Promise.all([getNowPlayingMovies().catch(() => []), getAiringTodayTv().catch(() => [])]);
  const m: Note[] = movies
    .filter((x) => x.backdrop_path && x.release_date && day(x.release_date) <= today && today - day(x.release_date) <= 45 * DAY)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 5)
    .map((x) => ({ id: `new-movie-${x.id}`, label: 'New Arrival', title: getTitle(x), sub: `In cinemas · ${relDay(day(x.release_date))}`, when: day(x.release_date), upcoming: false, img: img(x.backdrop_path), to: titlePath(x), personal: false }));
  const stamp = new Date(today).toISOString().slice(0, 10);
  const s: Note[] = shows
    .filter((x) => x.backdrop_path)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 5)
    .map((x) => ({ id: `air-tv-${x.id}-${stamp}`, label: 'New Episode', title: getTitle(x), sub: 'Airing today', when: today, upcoming: false, img: img(x.backdrop_path), to: titlePath(x), personal: false }));
  const out: Note[] = [];
  for (let i = 0; i < Math.max(m.length, s.length); i++) {
    if (s[i]) out.push(s[i]);
    if (m[i]) out.push(m[i]);
  }
  return out;
};

const canAlert = () => typeof window !== 'undefined' && 'Notification' in window;

const showAlert = (n: Note) => {
  try {
    const a = new Notification(`${n.label}: ${n.title}`, { body: n.sub, icon: n.img || '/favicon.svg', tag: n.id });
    a.onclick = () => {
      window.focus();
      navigate(n.to);
      a.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
};

/** Netflix-style bell with real, personal notifications. */
export const NotificationsBell: React.FC = () => {
  const { continueWatchingList, myList } = useAppContext();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => readSet(SEEN_KEY));
  const [alerts, setAlerts] = useState(() => {
    try {
      return localStorage.getItem(ALERTS_KEY) === '1' && canAlert() && Notification.permission === 'granted';
    } catch {
      return false;
    }
  });
  const [blocked, setBlocked] = useState(() => canAlert() && Notification.permission === 'denied');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  // Shows / movies you follow: Continue Watching (with your progress) + My List, newest first.
  const tracked = useMemo(() => {
    const map = new Map<string, Tracked & { at: number }>();
    for (const cw of continueWatchingList) map.set(`${cw.media.media_type}-${cw.media.id}`, { media: cw.media, progress: cw.progress, at: cw.savedAt });
    for (const ml of myList) {
      const k = `${ml.media.media_type}-${ml.media.id}`;
      if (!map.has(k)) map.set(k, { media: ml.media, at: ml.savedAt });
    }
    return [...map.values()].sort((a, b) => b.at - a.at).slice(0, MAX_TRACKED);
  }, [continueWatchingList, myList]);
  const trackedKey = tracked.map((x) => `${x.media.media_type}${x.media.id}:${x.progress?.season || ''}.${x.progress?.episode || ''}`).join(',');

  // Refresh every 30 minutes while the site is open.
  const [tick, setTick] = useState(() => Math.floor(Date.now() / REFRESH_MS));
  useEffect(() => {
    const t = window.setInterval(() => setTick(Math.floor(Date.now() / REFRESH_MS)), 60000);
    return () => window.clearInterval(t);
  }, []);

  const personal = useCachedData<Note[]>(ready ? `bell:me:${tick}:${trackedKey}` : null, () => buildPersonal(tracked));
  const arrivals = useCachedData<Note[]>(ready ? `bell:new:${tick}` : null, buildArrivals);

  const forYou = useMemo(() => {
    const list = personal.data || [];
    const avail = list.filter((n) => !n.upcoming).sort((a, b) => b.when - a.when);
    const soon = list.filter((n) => n.upcoming).sort((a, b) => a.when - b.when);
    return [...avail, ...soon];
  }, [personal.data]);
  const newOn = useMemo(() => {
    const mine = new Set(forYou.map((n) => n.to));
    return (arrivals.data || []).filter((n) => !mine.has(n.to)).slice(0, 8);
  }, [arrivals.data, forYou]);
  const all = useMemo(() => [...forYou, ...newOn], [forYou, newOn]);
  const unread = all.filter((n) => !seen.has(n.id)).length;
  const loading = !personal.data && !arrivals.data;

  // Desktop alerts for new "For you" items that are out now (each one only once).
  useEffect(() => {
    if (!alerts || !personal.data || !canAlert() || Notification.permission !== 'granted') return;
    const done = readSet(NOTIFIED_KEY);
    const fresh = personal.data.filter((n) => !n.upcoming && !done.has(n.id) && !seen.has(n.id));
    fresh.slice(0, 3).forEach(showAlert);
    if (fresh.length) {
      fresh.forEach((n) => done.add(n.id));
      writeSet(NOTIFIED_KEY, done);
    }
  }, [alerts, personal.data, seen]);

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

  // What you saw in the panel is marked as read when it CLOSES, so the red "new" dots stay
  // visible while you're looking at them.
  const shownRef = useRef<string[]>([]);
  useEffect(() => {
    if (open) {
      shownRef.current = all.map((n) => n.id);
      return;
    }
    const shown = shownRef.current;
    if (!shown.length) return;
    shownRef.current = [];
    setSeen((prev) => {
      if (shown.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      shown.forEach((id) => next.add(id));
      writeSet(SEEN_KEY, next);
      return next;
    });
  }, [open, all]);

  const toggleAlerts = async () => {
    if (!canAlert()) return;
    if (alerts) {
      setAlerts(false);
      try {
        localStorage.setItem(ALERTS_KEY, '0');
      } catch {
        /* ignore */
      }
      return;
    }
    const perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    setBlocked(perm === 'denied');
    if (perm !== 'granted') return;
    // Everything already in the panel counts as known; only new ones pop up from now on.
    const done = readSet(NOTIFIED_KEY);
    all.forEach((n) => done.add(n.id));
    writeSet(NOTIFIED_KEY, done);
    try {
      localStorage.setItem(ALERTS_KEY, '1');
    } catch {
      /* ignore */
    }
    setAlerts(true);
    try {
      new Notification('StreamFast alerts are on', { body: "We'll let you know when new episodes of your shows come out.", icon: '/favicon.svg', tag: 'sf-alerts-on' });
    } catch {
      /* ignore */
    }
  };

  const row = (n: Note) => (
    <Link
      key={n.id}
      to={n.to}
      role="menuitem"
      onClick={() => setOpen(false)}
      className="flex items-center gap-3.5 px-4 py-2.5 transition-colors duration-150 hover:bg-white/[0.06]"
    >
      <span className="relative flex-shrink-0">
        {n.img ? (
          <img src={n.img} alt="" loading="lazy" className="aspect-video w-[7.2rem] rounded-md object-cover" />
        ) : (
          <span className="block aspect-video w-[7.2rem] rounded-md bg-[#2a2a2a]" />
        )}
        {!seen.has(n.id) && <span className="absolute -left-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-netflix-red" role="img" aria-label="New" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${n.upcoming ? 'text-[#b3b3b3]' : 'text-white'}`}>{n.label}</span>
        <span className="block truncate text-[14px] text-netflix-text">{n.title}</span>
        <span className="block truncate text-[12px] text-[#8c8c8c]">
          {n.sub}
          {!n.upcoming && n.personal ? ` · ${relDay(n.when)}` : ''}
        </span>
      </span>
    </Link>
  );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} aria-haspopup="menu" aria-expanded={open} className="relative flex h-9 w-9 items-center justify-center text-white transition-transform duration-200 hover:scale-105">
        <BellIcon className="h-[22px] w-[22px]" />
        {unread > 0 && (
          <span className="absolute right-[3px] top-[2px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-netflix-red px-[4px] text-[10px] font-bold leading-none text-white ring-2 ring-[#141414]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          data-lenis-prevent
          className="absolute right-[-3.5rem] top-[calc(100%+0.8rem)] z-50 max-h-[min(72vh,560px)] w-[min(92vw,25rem)] overflow-y-auto overscroll-contain rounded-xl bg-[#181818]/[0.98] py-2 shadow-[0_18px_50px_rgba(0,0,0,0.7)] ring-1 ring-white/10 backdrop-blur-md animate-dropdown-in sm:right-0"
        >
          <p className="px-4 pb-2 pt-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8c8c8c]">For you</p>
          {forYou.map(row)}
          {personal.data && !forYou.length && (
            <p className="px-4 pb-3 text-[13px] leading-snug text-netflix-muted">
              {tracked.length ? "You're all caught up. New episodes of your shows will show up here." : 'Add shows to My List or start watching, and new episodes will show up here.'}
            </p>
          )}
          {!personal.data && tracked.length > 0 && <p className="px-4 pb-3 text-[13px] text-netflix-muted">Checking your shows…</p>}

          {newOn.length > 0 && (
            <>
              <p className="mt-1 border-t border-white/10 px-4 pb-2 pt-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8c8c8c]">New on StreamFast</p>
              {newOn.map(row)}
            </>
          )}
          {loading && <p className="px-4 py-6 text-center text-sm text-netflix-muted">Loading…</p>}

          {canAlert() && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 px-4 pb-1 pt-3">
              <span className="min-w-0 text-[12px] leading-snug text-[#a3a3a3]">
                {blocked ? 'Desktop alerts are blocked in your browser settings.' : 'Desktop alerts for new episodes of your shows'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={alerts}
                aria-label="Desktop alerts"
                disabled={blocked}
                onClick={toggleAlerts}
                className={`relative h-[22px] w-[40px] flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${alerts ? 'bg-netflix-red' : 'bg-[#4d4d4d]'}`}
              >
                <span className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${alerts ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
