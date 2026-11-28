import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import { getTitleDetails, getSeasonDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { notifyLocalDataChange } from '../services/storage';
import { getTitle, tmdbImage, titlePath, watchPath } from '../utils/media';
import { goBack, navigate, openTitleFromWatch } from '../utils/router';
import { PlayIcon } from '../components/Icons';
import { comingSentence, seedRelease, useRelease } from '../utils/release';
import VIDFAST_SERVERS from '../data/vidfast-servers.json';
import { PROVIDERS, PROVIDER_TIMEOUT_MS, TrackOption, SELECTABLE_PROVIDERS, DIRECT_PROVIDER_ID } from '../utils/embedProviders';

const VIDFAST_ORIGINS = [
  'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io', 'https://vidfast.me', 'https://vidfast.net',
  'https://vidfast.pm', 'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz',
];
// VidFast's documented embed domain; unlike vidfast.pro it reports play / pause / progress to us.
const VIDFAST_EMBED_MOVIE = 'https://vidfast.vc/movie/';
const VIDFAST_EMBED_TV = 'https://vidfast.vc/tv/';
const STUCK_MS = 15000;
/** Autoplay guard: autoPlay once made VidFast's player load over and over. If, with autoplay on, the
 *  player reloads itself this many times, or isn't ready after AUTOPLAY_READY_MS, we turn autoplay off
 *  (for this visit) and load it the old way, where you press Play once. */
const AUTOPLAY_MAX_LOADS = 3;
const AUTOPLAY_READY_MS = 25000;
const AUTOPLAY_OFF_KEY = 'sf-autoplay-off';
const autoplayAllowed = () => {
  try {
    return sessionStorage.getItem(AUTOPLAY_OFF_KEY) !== '1';
  } catch {
    return true;
  }
};
const SAVE_EVERY_MS = 5000;
// VidFast hides its controls 3s after the last mouse move (measured), with a 250ms fade.
const IDLE_MS = 3000;
/** VidFast's idle timer (react-idle-timer) only counts one mouse event per 200ms: the first one, then
 *  nothing until 200ms have passed. So its 3s can start up to 200ms before your last move. Ours counts
 *  mouse moves the same way, or ours would stay up to 0.2s longer than VidFast's. */
const EVENTS_THROTTLE_MS = 200;
/** When the mouse comes to rest, its last few pixels land in the open window (only VidFast sees them).
 *  If VidFast's next 200ms slot falls inside that tail, it counts one more move: so do we. */
const TAIL_MS = 30;
const REST_MS = 60;
/** Pause screen shows this long after pausing (Netflix waits a few seconds; we use 2s). */
const PAUSE_SCREEN_MS = 2000;
/** Hover sync: the open window left around the pointer so its moves reach VidFast (half its width, px).
 *  Always this small, even when the mouse moves fast: a bigger window let the last part of a fast move
 *  (as the mouse slows down) reach only VidFast, so its controls stayed up while ours had already gone.
 *  Any nudge of more than ~4px reaches our cover and wakes our controls too. */
const HOLE = 4;
/** While the mouse moves, the window also stretches ahead of the pointer to where its next move will
 *  land (one move ahead, a bit more), so that next move reaches VidFast and the one after reaches us:
 *  both pages keep seeing the mouse, so both bars come up and go together. */
const LEAD = 1.4;
const STEP_MAX = 160;
const FINE_POINTER = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
/** VidFast adds a picture-in-picture button when the browser supports it (4 buttons on the right instead of 3). */
const HAS_PIP = typeof document !== 'undefined' && !!(document as any).pictureInPictureEnabled;
/** VidFast's servers, as its own server menu lists them (badge + details). "Auto" lets the player pick.
    Kept in sync with VidFast every 6 hours by .github/workflows/vidfast-servers.yml: new servers appear here,
    removed ones disappear (a saved default that no longer exists falls back to Auto). */
const SERVER_INFO: { name: string; badge: string; details: string }[] = (VIDFAST_SERVERS as { name: string; badge?: string; details?: string }[])
  .filter((x) => x && typeof x.name === 'string' && x.name)
  .map((x) => ({ name: x.name, badge: x.badge || '', details: x.details || '' }));
const SERVERS = SERVER_INFO.map((x) => x.name);

/* VidFast's own icon style: 24px grid, 1.5 stroke, round joins. */
/** Bold back arrow (Netflix-style): heavy shaft and head with rounded ends. */
const VfBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 12H5" />
    <path d="M11 5L4 12L11 19" />
  </svg>
);
const VfCloud = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.4776 10.0001C17.485 10 17.4925 10 17.5 10C19.9853 10 22 12.0147 22 14.5C22 16.9853 19.9853 19 17.5 19H7C4.23858 19 2 16.7614 2 14C2 11.4003 3.98398 9.26407 6.52042 9.0227M17.4776 10.0001C17.4924 9.83536 17.5 9.66856 17.5 9.5C17.5 6.46243 15.0376 4 12 4C9.12324 4 6.76233 6.20862 6.52042 9.0227M17.4776 10.0001C17.3753 11.1345 16.9286 12.1696 16.2428 13M6.52042 9.0227C6.67826 9.00768 6.83823 9 7 9C8.12582 9 9.16474 9.37209 10.0005 10" />
  </svg>
);
const VfStar = ({ filled }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M11.109 3.74829C11.48 3.02037 12.52 3.02037 12.891 3.74829L15.0785 8.0407C15.2237 8.32561 15.4964 8.5239 15.8122 8.5742L20.5671 9.33147C21.373 9.45983 21.6941 10.4474 21.1178 11.0252L17.7138 14.4383C17.4883 14.6644 17.3844 14.9846 17.4341 15.3001L18.1843 20.0635C18.3114 20.8702 17.4703 21.4808 16.7426 21.1102L12.4539 18.9254C12.1687 18.7801 11.8313 18.7801 11.5461 18.9254L7.25739 21.1102C6.52973 21.4808 5.68859 20.8702 5.81565 20.0635L6.56594 15.3001C6.61562 14.9846 6.51167 14.6644 6.28617 14.4383L2.88217 11.0252C2.3059 10.4474 2.62703 9.45983 3.43294 9.33147L8.18782 8.5742C8.50362 8.5239 8.77632 8.32561 8.92151 8.0407L11.109 3.74829Z" />
  </svg>
);
const VfChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9.00005 6C9.00005 6 15 10.4189 15 12C15 13.5812 9 18 9 18" />
  </svg>
);
const VfPlaying = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12Z" fill="#1abc9c" opacity="0.4" />
    <path fill="#16a085" d="M16.4375 12.4512C16.2355 13.1675 15.281 13.6736 13.3719 14.6859C11.5263 15.6645 10.6035 16.1538 9.8599 15.9571C9.55246 15.8758 9.27234 15.7214 9.04643 15.5086C8.5 14.9941 8.5 13.9961 8.5 12C8.5 10.0039 8.5 9.00592 9.04643 8.49137C9.27234 8.27864 9.55246 8.12421 9.8599 8.04289C10.6035 7.84617 11.5263 8.33547 13.3719 9.31407C15.281 10.3264 16.2355 10.8325 16.4375 11.5488C16.5208 11.8445 16.5208 12.1555 16.4375 12.4512Z" />
  </svg>
);
/** Netflix's own Episodes icon (EpisodesMedium). */
const VfEpisodes = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M8 5h14v8h2V5a2 2 0 0 0-2-2H8zm10 4H4V7h14a2 2 0 0 1 2 2v8h-2zM0 13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm14 6v-6H2v6z" />
  </svg>
);
/** Netflix's ArrowLeftMedium (episodes panel header). */
const NfArrowLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M6.414 11H21v2H6.414l5.293 5.293-1.414 1.414-7-7a1 1 0 0 1 0-1.414l7-7 1.414 1.414z" />
  </svg>
);
/** Netflix's animated "Now Playing" bars. */
const NfNowBars = () => (
  <svg viewBox="0 0 36 36" className="nf-ep-bars" aria-hidden="true">
    <rect x="1" y="8" width="4" height="20" />
    <rect x="9" y="2" width="4" height="32" />
    <rect x="17" y="0" width="4" height="36" />
    <rect x="25" y="6" width="4" height="24" />
    <rect x="31" y="12" width="4" height="12" />
  </svg>
);
/* Our own CineLite / VidRift controls, drawn in the same 24px VidFast icon style as everything above. */
const VfPlaySmall = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14Z" />
  </svg>
);
const VfPauseSmall = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
const VfQuality = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 15l3-4 2.5 3L16 9l3 3" />
  </svg>
);
const VfVolume = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const VfMuted = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
    <path d="M16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const VfSubtitles = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M6.5 14.5h3M10.5 9.5h7M6.5 9.5h1.5M13.5 14.5h4" />
  </svg>
);
const VfAudio = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" />
    <path d="M6 11a6 6 0 0 0 12 0M12 19v2" />
  </svg>
);
/* VidRift's full custom bar: skip ±10s and our own fullscreen toggle (its native chrome is hidden entirely). */
const VfSkipBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 9-9" />
    <path d="M3 5v5h5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">10</text>
  </svg>
);
const VfSkipForward = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-9-9" />
    <path d="M21 5v5h-5" />
    <text x="12" y="15.5" fontSize="7.5" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle">10</text>
  </svg>
);
const VfFsEnter = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H5a1 1 0 0 0-1 1v4M15 4h4a1 1 0 0 1 1 1v4M9 20H5a1 1 0 0 1-1-1v-4M15 20h4a1 1 0 0 0 1-1v-4" />
  </svg>
);
const VfFsExit = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9h4a1 1 0 0 0 1-1V4M20 9h-4a1 1 0 0 1-1-1V4M4 15h4a1 1 0 0 1 1 1v4M20 15h-4a1 1 0 0 0-1 1v4" />
  </svg>
);
/** "Servers & Mode" — the global provider/source picker (works for every provider, not just one). */
const VfServers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="6" rx="1.5" />
    <rect x="3" y="14" width="18" height="6" rx="1.5" />
    <path d="M7 7h.01M7 17h.01" strokeWidth="2.2" />
  </svg>
);
/** CineLite's own quality values (its docs list these five). */
const CINELITE_QUALITIES: TrackOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '4k', label: '4K' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];
const SERVER_KEY = 'sf_server';
const loadServer = () => {
  try {
    const v = localStorage.getItem(SERVER_KEY);
    return v && SERVERS.includes(v) ? v : '';
  } catch {
    return '';
  }
};
const toSearchResult = (d: TitleDetails): SearchResult => {
  const base = {
    id: d.id, poster_path: d.poster_path, backdrop_path: d.backdrop_path, overview: d.overview,
    popularity: d.popularity, vote_average: d.vote_average, genre_ids: (d.genres || []).map((g) => g.id),
  };
  return d.media_type === 'movie'
    ? { ...base, media_type: 'movie', title: d.title || '', original_title: d.original_title || '', release_date: d.release_date || '' }
    : { ...base, media_type: 'tv', name: d.name || '', original_name: d.original_name || '', first_air_date: d.first_air_date || '' };
};
/** "1:02:03" for an hour or more, else "12:34". Used by VidRift's own scrubber/time readout. */
const formatTime = (secs: number) => {
  const s = Math.max(0, Math.floor(isFinite(secs) ? secs : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

interface WatchPageProps {
  mediaType: 'movie' | 'tv';
  id: number;
  season?: number;
  episode?: number;
  startAt?: number;
}

/** Netflix-style /watch page: full-screen VidFast player with title overlay, episodes panel and next episode. */

const WatchPage: React.FC<WatchPageProps> = ({ mediaType, id, season: seasonProp, episode: episodeProp, startAt }) => {
  const { data } = useCachedData<TitleDetails>(`title:${mediaType}:${id}`, () => getTitleDetails(mediaType, id));
  const { saveItem, continueWatchingList, playerTheme } = useAppContext();
  const item = useMemo(() => (data ? toSearchResult(data) : null), [data]);
  useEffect(() => {
    if (data && mediaType === 'movie') seedRelease(id, (data as any).release_dates?.results);
  }, [data, mediaType, id]);
  // Not out yet: VidFast has nothing to play (it shows a 404), so this page says when it comes out instead.
  const notOut = useRelease(item) === 'soon';
  const saved = continueWatchingList.find((cw) => cw.media.id === id && cw.media.media_type === mediaType);

  const season = mediaType === 'tv' ? seasonProp || saved?.progress.season || 1 : undefined;
  const episode = mediaType === 'tv' ? episodeProp || saved?.progress.episode || 1 : undefined;

  const seasonData = useCachedData<SeasonDetails>(season ? `season:${id}:${season}` : null, () => getSeasonDetails(id, season!));
  const episodes = seasonData.data?.episodes || [];
  const current = episodes.find((e) => e.episode_number === episode);

  const seasons = useMemo(() => (data?.seasons || []).filter((s) => s.season_number > 0 && s.episode_count > 0), [data]);
  const next = useMemo(() => {
    if (mediaType !== 'tv' || !season || !episode) return null;
    if (episodes.length && episode < episodes[episodes.length - 1].episode_number) return { season, episode: episode + 1 };
    const ns = seasons.find((s) => s.season_number === season + 1);
    return ns ? { season: ns.season_number, episode: 1 } : null;
  }, [mediaType, season, episode, episodes, seasons]);

  /* ---------- player src (resume where you left off) ---------- */
  // Multi-source fallback: CineLite first (its own backend, instant start, real 4K), then six
  // third-party embeds in order. We switch to the next one if the current provider hasn't proved
  // it's actually playing (a real ready/progress signal) within PROVIDER_TIMEOUT_MS.
  const [providerIndex, setProviderIndex] = useState(0);
  const providerIndexRef = useRef(providerIndex);
  providerIndexRef.current = providerIndex;
  // "Servers & Mode" manual override (see the sf-mode-menu below): null while the usual
  // auto-cascade is driving things; a provider id once the viewer has picked one themselves.
  // Picking "Direct" sets this to CineLite's id; picking anything in "Embed" sets it to that
  // provider's id (including VidRift's own two looks, native and our custom bar).
  const [manualProviderId, setManualProviderId] = useState<string | null>(null);
  // "Servers & Mode" panel: open/closed, and whether its Embed section is expanded to show the
  // Source list (closed by default each time the panel opens unless we're already on an embed
  // provider, in which case it opens pre-expanded to show what's currently picked).
  const [modeMenu, setModeMenu] = useState(false);
  const [embedExpanded, setEmbedExpanded] = useState(false);
  const provider = useMemo(
    () => (manualProviderId ? SELECTABLE_PROVIDERS.find((p) => p.id === manualProviderId) || PROVIDERS[providerIndex] : PROVIDERS[providerIndex]),
    [manualProviderId, providerIndex],
  );
  const [defaultServer, setDefaultServer] = useState<string>(loadServer);
  const [server, setServer] = useState<string>(loadServer);
  // Where to restart after a server switch, tied to the episode it belongs to, so the next episode's
  // first render never reuses it (which loaded the player twice).
  const [switchAt, setSwitchAt] = useState<{ ep: string; t: number } | undefined>(undefined);
  const [autoplay, setAutoplay] = useState(autoplayAllowed);
  const turnOffAutoplay = useCallback(() => {
    try {
      sessionStorage.setItem(AUTOPLAY_OFF_KEY, '1');
    } catch {
      /* private mode */
    }
    setAutoplay(false);
  }, []);
  const turnOffAutoplayRef = useRef(turnOffAutoplay);
  turnOffAutoplayRef.current = turnOffAutoplay;
  const epKey = `${season}:${episode}`;
  const lastTime = useRef(0);
  const volKey = useRef('');
  useEffect(() => setSwitchAt(undefined), [season, episode]);
  // A fresh title starts back at the primary source; a provider that works (or fails) for one
  // episode of the same show is kept for the next episode too, instead of retrying a dead primary
  // every time.
  useEffect(() => {
    setProviderIndex(0);
    setManualProviderId(null); // a fresh title always starts back on the usual auto-cascade
  }, [id]);

  // When VidFast moves to the next episode on its own we only update the address bar: the player is
  // already playing that episode, so rebuilding its address would reload it from the start.
  const autoAdvanced = useRef<string | null>(null);
  const srcRef = useRef('');
  const src = useMemo(() => {
    if (autoAdvanced.current === `${id}:${season}:${episode}` && srcRef.current) return srcRef.current;
    // Our page shows the title and server picker itself (Netflix layout), so hide VidFast's.
    // autoPlay: the video starts by itself once loaded (it used to make the player load over and over;
    // VidFast fixed that, and the guard below turns it off again if it ever comes back).
    const theme = `theme=${playerTheme.hex.replace('#', '')}&title=false&hideServer=true${server ? `&server=${server}` : ''}${autoplay ? '&autoPlay=true' : ''}`;
    let resume = (switchAt && switchAt.ep === epKey ? switchAt.t : undefined) ?? startAt;
    if (resume === undefined && saved?.progress.watched && saved.progress.duration) {
      const same = mediaType === 'movie' || (saved.progress.season === season && saved.progress.episode === episode);
      const nearEnd = saved.progress.watched > saved.progress.duration - 90;
      if (same && saved.progress.watched > 30 && !nearEnd) resume = Math.floor(saved.progress.watched);
    }
    const t = resume ? `&startAt=${resume}` : '';
    if (provider.id === 'vidfast') {
      return mediaType === 'movie'
        ? `${VIDFAST_EMBED_MOVIE}${id}?${theme}${t}`
        : `${VIDFAST_EMBED_TV}${id}/${season}/${episode}?nextButton=true&autoNext=true&${theme}${t}`;
    }
    // Other providers: build their own URL shape. They don't have VidFast's internal server list,
    // so `server` (VidFast-only) isn't passed; `resume` and the page theme still apply to all.
    const opts = { autoplay, startAt: resume, theme: playerTheme.hex.replace('#', '') };
    return mediaType === 'movie'
      ? provider.movieUrl(id, opts)
      : provider.tvUrl(id, season!, episode!, opts);
    // Only rebuild when the episode or the active provider changes, not on every progress save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, season, episode, playerTheme.hex, server, switchAt, autoplay, provider]);
  srcRef.current = src;

  /* ---------- overlay chrome ----------
     The player is VidFast's page inside ours, so mouse moves over it never reach us.
     Our bottom bits (title, server, episodes) show while paused, for a few seconds after
     play / seek / opening, and while the pointer is over them. The back arrow always stays. */
  const [chrome, setChrome] = useState(false);
  const [started, setStarted] = useState(false);
  // VidFast's player has loaded the video (it knows its length) but it hasn't played yet: its control
  // bar is up then (paused), so ours shows with it.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const loadCount = useRef(0);
  const gotReply = useRef(false);
  // VidFast's saved progress for this video when we first heard it (see the MEDIA_DATA handler).
  const mediaBase = useRef<number | null>(null);
  const [stuck, setStuck] = useState(false);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState(false);
  const [serverMenu, setServerMenu] = useState(false);
  const [qualityMenu, setQualityMenu] = useState(false);
  const [vrState, setVrState] = useState<{ volume: number; muted: boolean; subtitle: string; subtitles: TrackOption[]; audio: string; audios: TrackOption[] }>({
    volume: 1,
    muted: false,
    subtitle: 'off',
    subtitles: [],
    audio: '',
    audios: [],
  });
  const [vrMenu, setVrMenu] = useState<'subtitles' | 'audio' | null>(null);
  // VidRift's own scrubber: real currentTime/duration from vidrift:state, and a live drag preview
  // (non-null only while the pointer is down) so incoming updates never fight a scrub in progress.
  const [vrProgress, setVrProgress] = useState<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  // Whether OUR box (not the iframe) is the fullscreen element — drives the fullscreen icon and,
  // for VidRift, is echoed back to the player so it knows the state fs=parent put it in charge of.
  const [isFullscreen, setIsFullscreen] = useState(false);
  const idle = useRef<number | undefined>(undefined);
  // Netflix-style pause screen: appears 2s after you pause (and stop moving the mouse), never blocks clicks.
  const [pauseShow, setPauseShow] = useState(false);
  // Our controls stay where they are under the pause screen (like VidFast's), so its fade reveals both together.
  const pauseShowRef = useRef(false);
  pauseShowRef.current = pauseShow;
  const lastActive = useRef(0);
  // When our controls hide (performance.now() time); a wake only ever moves it later.
  const deadline = useRef(0);
  // VidFast's video is playing (from its last status reply).
  const playingRef = useRef(false);
  // A play we've been told about but whose video hasn't started moving yet (still loading).
  const startPending = useRef<{ ct: number; at: number } | null>(null);
  const scheduleHide = useCallback((at: number) => {
    // Infinity = held up until you next touch the player (see holdUntilActive).
    if (deadline.current !== Infinity && at <= deadline.current) return;
    deadline.current = at;
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      // VidFast only hides its bar while the video is playing; otherwise it stays up until you next
      // move the mouse, click or press a key. Ours does the same.
      if (!playingRef.current) {
        deadline.current = Infinity;
        return;
      }
      setChrome(false);
    }, Math.max(0, at - performance.now()));
  }, []);
  const show = useCallback(() => {
    lastActive.current = Date.now();
    if (pauseShowRef.current) setPauseShow(false);
    setChrome(true);
  }, []);
  /** Show now; hide 3s after time `t` (performance.now()), e.g. the moment playback really started. */
  const wakeAt = useCallback((t: number) => {
    show();
    scheduleHide(t + IDLE_MS);
  }, [show, scheduleHide]);
  const wake = useCallback(() => wakeAt(performance.now()), [wakeAt]);
  const wakeRef = useRef(wake);
  wakeRef.current = wake;
  const wakeAtRef = useRef(wakeAt);
  wakeAtRef.current = wakeAt;
  // When VidFast's player opened (its 3s timer starts then), and whether this video has started yet.
  const vfMountAt = useRef(0);
  const firstStartDone = useRef(false);
  const firstStartAt = useRef(0);
  // Mouse moves, counted the way VidFast's idle timer counts them (see EVENTS_THROTTLE_MS / TAIL_MS).
  const lastHandled = useRef(-1e9);
  const lastMove = useRef(0);
  const restTimer = useRef(0);
  const mouseActivity = useCallback((t: number) => {
    show();
    lastMove.current = t;
    if (t - lastHandled.current >= EVENTS_THROTTLE_MS || deadline.current <= performance.now() || deadline.current === Infinity) {
      lastHandled.current = t;
      scheduleHide(t + IDLE_MS);
    }
    window.clearTimeout(restTimer.current);
    restTimer.current = window.setTimeout(() => {
      const slot = lastHandled.current + EVENTS_THROTTLE_MS;
      if (slot <= lastMove.current + TAIL_MS) {
        lastHandled.current = slot;
        scheduleHide(slot + IDLE_MS);
      }
    }, REST_MS);
  }, [show, scheduleHide]);
  const mouseActivityRef = useRef(mouseActivity);
  mouseActivityRef.current = mouseActivity;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  useEffect(() => {
    if (!paused || !started || panel || serverMenu) {
      setPauseShow(false);
      return;
    }
    const t = window.setInterval(() => {
      if (!pauseShowRef.current && Date.now() - lastActive.current >= PAUSE_SCREEN_MS) setPauseShow(true);
    }, 200);
    return () => window.clearInterval(t);
  }, [paused, started, panel, serverMenu]);
  // New video (or server): hidden while VidFast loads. If nothing plays for a while, offer the server button.
  useEffect(() => {
    setStarted(false);
    setReady(false);
    readyRef.current = false;
    playingRef.current = false;
    gotReply.current = false;
    mediaBase.current = null;
    loadCount.current = 0;
    vfMountAt.current = 0;
    firstStartDone.current = false;
    setPaused(false);
    setChrome(false);
    setStuck(false);
    setQualityMenu(false);
    setVrMenu(null);
    setVrState({ volume: 1, muted: false, subtitle: 'off', subtitles: [], audio: '', audios: [] });
    setVrProgress({ currentTime: 0, duration: 0 });
    setScrubTime(null);
    setModeMenu(false);
    const t = window.setTimeout(() => setStuck(true), STUCK_MS);
    // Autoplay guard: never got ready -> load it again without autoplay.
    const g = autoplay
      ? window.setTimeout(() => {
          if (!readyRef.current) turnOffAutoplayRef.current();
        }, AUTOPLAY_READY_MS)
      : 0;
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(g);
      window.clearTimeout(idle.current);
      window.clearTimeout(restTimer.current);
      deadline.current = 0;
      lastHandled.current = -1e9;
      startPending.current = null;
    };
  }, [src]);

  // Multi-source fallback: if this provider hasn't proved it's playing within PROVIDER_TIMEOUT_MS,
  // move to the next one. Resets whenever the src changes (new episode, or an earlier switch),
  // same as the reset effect above, so the clock always measures the CURRENT provider's load time.
  useEffect(() => {
    // A manual "Servers & Mode" pick means the viewer chose this provider on purpose: never
    // second-guess it by auto-advancing to the next one in the cascade.
    if (notOut || manualProviderId) return;
    const t = window.setTimeout(() => {
      if (readyRef.current) return; // this provider came up in time
      setProviderIndex((i) => (i + 1 < PROVIDERS.length ? i + 1 : i));
    }, PROVIDER_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [src, notOut, manualProviderId]);


  /* ---------- progress saving (Continue Watching) ---------- */
  const lastSave = useRef(0);
  const live = useRef({ item, season, episode, saved });
  live.current = { item, season, episode, saved };

  const save = useCallback((progress: WatchProgress) => {
    const { item: it, saved: sv } = live.current;
    if (!it) return;
    saveItem(it, progress, sv?.cleanPosterPath || it.poster_path);
  }, [saveItem]);

  // Starting to watch puts the title at the front of Continue Watching.
  useEffect(() => {
    if (!item || notOut) return;
    const sv = live.current.saved;
    const same = mediaType === 'movie' || (sv?.progress.season === season && sv?.progress.episode === episode);
    save(mediaType === 'tv' ? { season, episode, ...(same ? { watched: sv?.progress.watched, duration: sv?.progress.duration } : {}) } : { ...(sv?.progress || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, season, episode, notOut]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (provider.id !== 'vidfast') {
        // Generic path for the other six providers: we don't replicate VidFast's exact idle-timer
        // choreography for them (that was reverse-engineered specifically for VidFast's timing),
        // just enough to know the provider is alive, save progress, and feed the fallback timer below.
        if (!provider.origins.includes(e.origin)) return;
        const msg = provider.parseMessage(e.data);
        if (!msg) return;
        if (msg.commandError) {
          // Not fatal: the control just didn't apply (e.g. sent before the stream was ready).
          console.warn('[player]', provider.name, 'rejected', msg.commandError.command, msg.commandError.reason);
        }
        if (msg.ready && !readyRef.current) {
          readyRef.current = true;
          setReady(true);
        }
        if (typeof msg.playing === 'boolean') {
          playingRef.current = msg.playing;
          if (msg.playing) setStarted(true);
          // CineLite and VidRift report play/pause for real, so our pause screen and Play/Pause
          // button can follow it (the other providers never send this, so this never fires for them).
          if (pausedRef.current !== !msg.playing) {
            pausedRef.current = !msg.playing;
            setPaused(!msg.playing);
          }
        }
        if (provider.id === 'vidrift' || provider.id === 'vidrift-custom') {
          setVrState((v) => ({
            volume: typeof msg.volume === 'number' ? msg.volume : v.volume,
            muted: typeof msg.muted === 'boolean' ? msg.muted : v.muted,
            subtitle: msg.subtitle ?? v.subtitle,
            subtitles: msg.subtitles ?? v.subtitles,
            audio: msg.audio ?? v.audio,
            audios: msg.audios ?? v.audios,
          }));
          if (typeof msg.currentTime === 'number' || typeof msg.duration === 'number') {
            setVrProgress((p) => ({
              currentTime: typeof msg.currentTime === 'number' ? msg.currentTime : p.currentTime,
              duration: typeof msg.duration === 'number' ? msg.duration : p.duration,
            }));
          }
          // VidRift (fs=parent) asks us to own fullscreen: the viewer pressed F, double-clicked,
          // or hit its (hidden) fullscreen button's keyboard equivalent.
          if (typeof msg.fullscreenRequest === 'boolean') {
            const box = rootRef.current;
            if (msg.fullscreenRequest) box?.requestFullscreen?.().catch(() => undefined);
            else if (document.fullscreenElement === box) document.exitFullscreen().catch(() => undefined);
          }
        }
        if (typeof msg.currentTime === 'number' && msg.currentTime > 0) {
          lastTime.current = msg.currentTime;
          setStarted(true);
          const now = Date.now();
          if (now - lastSave.current >= SAVE_EVERY_MS && typeof msg.duration === 'number' && msg.duration > 0) {
            lastSave.current = now;
            const { season: cs, episode: ce } = live.current;
            save(mediaType === 'tv' ? { season: cs, episode: ce, watched: msg.currentTime, duration: msg.duration } : { watched: msg.currentTime, duration: msg.duration });
          }
        }
        return;
      }
      if (!VIDFAST_ORIGINS.includes(e.origin)) return;
      if (e.data.type === 'MEDIA_DATA') {
        // VidFast's own saved progress for this title (sent every few seconds).
        const entry = e.data.data?.[`${mediaType === 'movie' ? 'm' : 't'}${id}`];
        const pr = entry?.progress;
        if (!(pr?.watched > 0 && pr?.duration > 0)) return;
        const { season: cs, episode: ce } = live.current;
        if (mediaType === 'tv') {
          const ls = Number(entry.last_season_watched);
          const le = Number(entry.last_episode_watched);
          if (!ls || !le || ls !== cs || le !== ce) return; // only trust progress for this exact episode
        }
        const now = Date.now();
        if (now - lastSave.current < SAVE_EVERY_MS) return;
        lastSave.current = now;
        // Progress moving = the video is playing. The first value is only what was saved last time you
        // watched (it arrives while VidFast is still loading), so it never counts as playing by itself.
        const savedAt = mediaBase.current;
        if (savedAt === null) mediaBase.current = pr.watched;
        else if (pr.watched > Math.max(lastTime.current, savedAt) + 1) setStarted(true);
        lastTime.current = pr.watched;
        save(mediaType === 'tv' ? { season: cs, episode: ce, watched: pr.watched, duration: pr.duration } : { watched: pr.watched, duration: pr.duration });
        return;
      }
      if (e.data.type !== 'PLAYER_EVENT') return;
      const { event: ev, currentTime, duration, season: s, episode: ep, playing } = e.data.data || {};
      if (currentTime > 0) lastTime.current = currentTime;
      // Volume / mute keys show VidFast's controls without play / pause / seek: follow those too.
      const { volume: vol, muted: mu } = e.data.data || {};
      if (typeof vol === 'number' || typeof mu === 'boolean') {
        const key = `${vol}|${mu}`;
        if (volKey.current && volKey.current !== key) wakeRef.current();
        volKey.current = key;
      }
      let firstStart = false;
      gotReply.current = true;
      if (typeof playing === 'boolean') playingRef.current = playing;
      // VidFast's video has loaded (it knows its length): its "Loading, one moment" screen is gone and its
      // control bar comes up now, with its 3s starting now. VidFast already answers us while it's still
      // loading, so only a real length counts. Until then ours stays hidden too (except the back arrow).
      if (!readyRef.current && typeof duration === 'number' && duration > 0) {
        readyRef.current = true;
        setReady(true);
        vfMountAt.current = performance.now();
        wakeAtRef.current(vfMountAt.current);
      }
      if (typeof playing === 'boolean') {
        if (playing || currentTime > 0) setStarted(true);
        // First time this video plays (it starts by itself once loaded). If it starts within 3s of the
        // player opening (or of your last move), both bars hide 3s after that. If it took longer to load,
        // VidFast's bar hides 3s after playback starts, so ours does too (it used to wait for a mouse move
        // and could stay up on its own).
        if (playing && !firstStartDone.current) {
          firstStartDone.current = true;
          firstStartAt.current = performance.now();
          firstStart = true;
          startPending.current = null;
          const now = performance.now();
          const from = Math.max(vfMountAt.current || now, lastHandled.current);
          wakeAtRef.current(now < from + IDLE_MS ? from : now);
        }
        // Playback really starting after a play (once the video has loaded): VidFast starts its 3s
        // from that moment, not from the click, so ours does too. Worked out from how far the video
        // has played, so it doesn't depend on when the next status reply happens to arrive.
        const pend = firstStart ? null : startPending.current;
        if (!playing) startPending.current = null;
        else if (pend && typeof currentTime === 'number') {
          if (currentTime > pend.ct + 0.05) {
            startPending.current = null;
            const began = performance.now() - (currentTime - pend.ct) * 1000;
            if (began > pend.at + 150) wakeAtRef.current(began);
          } else if (performance.now() - pend.at > 20000) startPending.current = null;
        }
        if (!firstStart && firstStartDone.current && playing && pausedRef.current && typeof currentTime === 'number') startPending.current = { ct: currentTime, at: performance.now() };
        // Never stay up on our own while the video plays: if ours was waiting (its 3s ran out while the
        // video was loading or paused), it hides 3s after playback is going, like VidFast's.
        if (playing && deadline.current === Infinity) wakeAtRef.current(performance.now());
        if (pausedRef.current !== !playing) {
          pausedRef.current = !playing;
          setPaused(!playing);
          setServerMenu(false); // you played / paused (e.g. with Space): the server list goes, like VidFast's menus
          if (!firstStart && firstStartDone.current) wakeRef.current(); // VidFast shows its controls on play / pause
        }
      }
      if (ev === 'playerstatus') return;
      if (['play', 'playing', 'timeupdate', 'pause', 'seeked'].includes(ev)) setStarted(true);
      // VidFast shows its controls when you play, pause or seek: show ours with them.
      if (ev === 'play' || ev === 'playing') {
        setPaused(false);
        setServerMenu(false);
        // (The 'play' event of that first start can arrive a moment after the status reply: same start.)
        if (!firstStart && performance.now() - firstStartAt.current > 1500) wakeRef.current();
      } else if (ev === 'pause' || ev === 'ended') setPaused(true);
      else if (ev === 'seeked') wakeRef.current();
      if (!['timeupdate', 'pause', 'ended', 'seeked'].includes(ev) || !(currentTime > 0)) return;
      const now = Date.now();
      if (ev === 'timeupdate' && now - lastSave.current < SAVE_EVERY_MS) return;
      lastSave.current = now;
      const { season: cs, episode: ce } = live.current;
      const progress: WatchProgress = { watched: currentTime, duration };
      if (mediaType === 'tv') {
        progress.season = s || cs || 1;
        progress.episode = ep || ce || 1;
        // Player auto-advanced to the next episode: keep the URL in sync.
        if ((s && s !== cs) || (ep && ep !== ce)) {
          autoAdvanced.current = `${id}:${progress.season}:${progress.episode}`;
          navigate(watchPath({ id, media_type: 'tv' }, { season: progress.season, episode: progress.episode }), { replace: true, keepScroll: true });
        }
      }
      save(progress);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mediaType, id, save, provider]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modeMenu) setModeMenu(false);
        else if (serverMenu) setServerMenu(false);
        else if (qualityMenu) setQualityMenu(false);
        else if (vrMenu) setVrMenu(null);
        else if (panel) setPanel(false);
        else if (!document.fullscreenElement) openTitleFromWatch(titlePath({ id, media_type: mediaType, title: item ? getTitle(item) : '' } as any));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [panel, serverMenu, qualityMenu, vrMenu, modeMenu, id, mediaType, item]);

  useEffect(() => {
    if (item) document.title = `${getTitle(item)}${mediaType === 'tv' ? ` S${season}:E${episode}` : ''} — StreamFast`;
  }, [item, mediaType, season, episode]);


  /* ---------- fullscreen: the whole watch page, so our back / title / server stay on screen ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let wasOurs = false;
    const onFs = () => {
      wakeRef.current(); // VidFast shows its controls when fullscreen changes
      const el = document.fullscreenElement;
      const box = rootRef.current;
      if (box && el && el === iframeRef.current) {
        // The player's fullscreen button: enter ours instead, or leave if we were already in.
        if (wasOurs) document.exitFullscreen().catch(() => undefined);
        else box.requestFullscreen().catch(() => undefined);
        return;
      }
      wasOurs = !!box && el === box;
      setIsFullscreen(wasOurs);
      // VidRift (fs=parent, native or custom bar alike) expects to be told whenever our box's
      // fullscreen state changes, so its own fullscreen icon state and phone sheets stay right
      // (native look) or our echo stays in sync (custom bar).
      const prov = providerRef.current;
      if (prov.id === 'vidrift' || prov.id === 'vidrift-custom') sendCommandRef.current(prov.commands?.setFullscreenState?.(wasOurs));
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Picking a server switches this video only; the star makes it your default (like VidFast's menu).
  const chooseServer = (name: string) => {
    setServerMenu(false);
    window.setTimeout(() => iframeRef.current?.focus(), 0);
    if (name === server) return;
    autoAdvanced.current = null;
    if (lastTime.current > 5) setSwitchAt({ ep: epKey, t: Math.floor(lastTime.current) });
    setServer(name);
  };
  const toggleDefault = (name: string) => {
    const next = defaultServer === name ? '' : name;
    setDefaultServer(next);
    try {
      if (next) localStorage.setItem(SERVER_KEY, next);
      else localStorage.removeItem(SERVER_KEY);
      notifyLocalDataChange('default_server');
    } catch {
      /* ignore */
    }
  };

  // Send one of a provider's own commands (play/pause, volume, subtitle, audio, quality) to its iframe.
  // Only CineLite and VidRift define any — for the rest, provider.commands is undefined and this never fires.
  const sendCommand = useCallback(
    (msg: any) => {
      if (!msg) return;
      iframeRef.current?.contentWindow?.postMessage(msg, provider.origins[0]);
    },
    [provider],
  );
  // A ref mirror so the fullscreenchange effect below (mount-once, empty deps) always posts through
  // today's sendCommand/provider instead of the one that existed when the page first loaded.
  const sendCommandRef = useRef(sendCommand);
  sendCommandRef.current = sendCommand;
  // A ref mirror of the active provider itself (not just its cascade index — a manual "Servers &
  // Mode" pick, like VidRift's custom bar, may not even be in the cascade list), for effects below
  // that only run once (mount-time) and need today's provider, not the one from first render.
  const providerRef = useRef(provider);
  providerRef.current = provider;

  /* ---------- hover sync ----------
     VidFast's player is its own page inside ours, so mouse moves over it never reach us, and its
     play / pause commands don't work. To see the mouse without ever blocking a click, the video is
     covered by an invisible cover with a small open window around the pointer: moves and clicks inside
     the window go straight to VidFast, and the moment the pointer touches the cover we know where it is,
     so the window jumps there (the pointer is always inside it, so clicks and keys always reach VidFast).
     Each touch = "the mouse moved" -> our title / cloud / back arrow show, then fade 3s after the last
     move, exactly like VidFast's own controls. The window is only a few pixels wide around the pointer,
     stretched ahead of it while it moves: moves then take turns reaching VidFast and us, so both see the
     mouse start, keep moving and stop at (almost) the same moment. */
  const gridRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<(HTMLElement | null)[]>([]);
  // Where the open window is (in the cover's own pixels); null = covered everywhere (pointer not over the video).
  const holeRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);
  // Last mouse position we saw, and how long one screen frame is (mouse moves come once per frame).
  const lastSeen = useRef<{ x: number; y: number; t: number } | null>(null);
  const frameMs = useRef(16.7);
  useEffect(() => {
    const d: number[] = [];
    let prev = 0;
    let raf = 0;
    const step = (ts: number) => {
      if (prev) d.push(ts - prev);
      prev = ts;
      if (d.length < 12) raf = requestAnimationFrame(step);
      else frameMs.current = Math.min(34, Math.max(4, d.sort((a, b) => a - b)[6]));
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const layoutCover = useCallback(() => {
    const box = gridRef.current;
    const [top, bottom, left, right] = coverRef.current;
    if (!box || !top || !bottom || !left || !right) return;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const hole = holeRef.current;
    if (!hole) {
      top.style.cssText = `left:0;top:0;width:${W}px;height:${H}px`;
      bottom.style.cssText = left.style.cssText = right.style.cssText = 'display:none';
      return;
    }
    // The pointer (always inside, so clicks reach VidFast) plus the stretch to its predicted next move.
    const side = HOLE + Math.min(12, 0.25 * Math.hypot(hole.sx, hole.sy));
    const x0 = Math.max(0, Math.floor(Math.min(hole.x, hole.x + hole.sx) - side));
    const x1 = Math.min(W, Math.ceil(Math.max(hole.x, hole.x + hole.sx) + side));
    const y0 = Math.max(0, Math.floor(Math.min(hole.y, hole.y + hole.sy) - side));
    const y1 = Math.min(H, Math.ceil(Math.max(hole.y, hole.y + hole.sy) + side));
    top.style.cssText = `left:0;top:0;width:${W}px;height:${y0}px`;
    bottom.style.cssText = `left:0;top:${y1}px;width:${W}px;height:${Math.max(0, H - y1)}px`;
    left.style.cssText = `left:0;top:${y0}px;width:${x0}px;height:${y1 - y0}px`;
    right.style.cssText = `left:${x1}px;top:${y0}px;width:${Math.max(0, W - x1)}px;height:${y1 - y0}px`;
  }, []);
  const closeCover = useCallback(() => {
    holeRef.current = null;
    lastSeen.current = null;
    layoutCover();
  }, [layoutCover]);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    layoutCover();
    const ro = new ResizeObserver(() => layoutCover());
    ro.observe(el);
    return () => ro.disconnect();
  }, [layoutCover]);
  const onCover = useCallback((e: React.MouseEvent) => {
    const box = gridRef.current;
    if (!box) return;
    // Only real moves: the browser can also report the pointer "arriving" when the page changes under a still mouse.
    if (e.type === 'mousemove' && !e.movementX && !e.movementY) return;
    const r = box.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const t = e.timeStamp;
    // How far the mouse goes in one frame, from the last move we saw (scaled to one frame if that was
    // a few frames ago; from a standstill, the first step is taken as one frame's worth).
    let sx = 0;
    let sy = 0;
    const prev = lastSeen.current;
    if (prev && e.type === 'mousemove') {
      sx = x - prev.x;
      sy = y - prev.y;
      const dt = t - prev.t;
      if (dt > 0 && dt < 100) {
        const k = frameMs.current / Math.max(dt, frameMs.current);
        sx *= k;
        sy *= k;
      }
      const len = Math.hypot(sx, sy);
      if (len > STEP_MAX) {
        sx *= STEP_MAX / len;
        sy *= STEP_MAX / len;
      }
      sx *= LEAD;
      sy *= LEAD;
    }
    lastSeen.current = { x, y, t };
    holeRef.current = { x, y, sx, sy };
    layoutCover();
    mouseActivityRef.current(t);
  }, [layoutCover]);

  useEffect(() => {
    if (!FINE_POINTER) return;
    // Measured on VidFast's player: controls show on any mouse move or key press, hide exactly 3s after
    // the last one (even with the pointer resting on its control bar, and even after the pointer leaves),
    // and stay up while paused. So ours only wake on real moves over the video (the cover), on the pointer
    // arriving / leaving, and on play / pause / seek. Nothing else keeps them up, or they drift out of sync.
    let over = false;
    // 30ms on purpose: VidFast shows its controls ~30ms after a move, so a slower check lets ours lag.
    // It's two cheap :hover checks, and it does nothing while the tab is hidden.
    const t = window.setInterval(() => {
      if (document.hidden) return;
      const f = iframeRef.current;
      const now = (!!f && f.matches(':hover')) || !!gridRef.current?.matches(':hover');
      if (now !== over) {
        mouseActivityRef.current(performance.now()); // arriving, or leaving (VidFast's 3s runs from that last move too)
        if (!now) closeCover(); // left the video: cover it all, so coming back in is noticed at once
      }
      over = now;
    }, 30);
    return () => window.clearInterval(t);
  }, [closeCover]);

  // Play / pause state straight from the player (its status reply), checked every second.
  useEffect(() => {
    // Every 50ms until the video has loaded (so we know when VidFast's bar comes up, to the frame), then 250ms.
    let last = 0;
    const t = window.setInterval(() => {
      const now = performance.now();
      if (readyRef.current && now - last < 240) return;
      last = now;
      iframeRef.current?.contentWindow?.postMessage({ command: 'getStatus' }, '*');
    }, 50);
    return () => window.clearInterval(t);
  }, []);

  // After using one of our buttons, hand the keyboard back to the player so Space keeps working.
  const refocusPlayer = useCallback(() => {
    window.setTimeout(() => iframeRef.current?.focus(), 0);
  }, []);

  // Clicking anywhere inside VidFast's player moves focus into it: close our server list / episodes then.
  useEffect(() => {
    const onBlur = () =>
      window.setTimeout(() => {
        if (document.activeElement === iframeRef.current) {
          mouseActivityRef.current(performance.now()); // a click inside the player: VidFast's timer restarts
          setServerMenu(false);
          setPanel(false);
          setQualityMenu(false);
          setVrMenu(null);
          setModeMenu(false);
        }
      }, 0);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  // If our page ever has the keyboard, Space closes our menus and hands the keyboard to the player.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      // Keyboard users: Space presses the focused button (Back, Episodes, Server, an episode row).
      if (t && t.closest('button, a[href], [role="button"], [role="menuitem"], [role="option"]')) return;
      e.preventDefault();
      setServerMenu(false);
      setPanel(false);
      setModeMenu(false);
      refocusPlayer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [refocusPlayer]);

  // Our buttons never take the keyboard away from the player (so Space always reaches VidFast).
  const keepPlayerFocus = (e: React.MouseEvent) => e.preventDefault();

  // Back = the title's page (its window over the page you came from), like Netflix.
  const back = () => {
    if (item) openTitleFromWatch(titlePath(item));
    else goBack('/');
  };
  const goEpisode = (s: number, e: number) => {
    autoAdvanced.current = null;
    setPanel(false);
    navigate(watchPath({ id, media_type: 'tv' }, { season: s, episode: e }), { replace: true, keepScroll: true });
  };

  const [panelSeason, setPanelSeason] = useState<number | undefined>(season);
  const [paneView, setPaneView] = useState<'episodes' | 'seasons'>('episodes');
  const [hoverEp, setHoverEp] = useState<number | null>(null);
  useEffect(() => setPanelSeason(season), [season]);
  // Each time the panel opens: the current season, current episode expanded (like Netflix).
  useEffect(() => {
    if (!panel) return;
    setPanelSeason(season);
    setPaneView('episodes');
    setHoverEp(null);
  }, [panel, season]);
  const curEpRef = useRef<HTMLLIElement | null>(null);
  const panelData = useCachedData<SeasonDetails>(panel && panelSeason ? `season:${id}:${panelSeason}` : null, () => getSeasonDetails(id, panelSeason!));
  useEffect(() => {
    if (panel && paneView === 'episodes' && panelData.data) curEpRef.current?.scrollIntoView({ block: 'nearest' });
  }, [panel, paneView, panelData.data]);
  const curPct = (() => {
    const pr = saved?.progress;
    if (!pr?.watched || !pr.duration || pr.season !== season || pr.episode !== episode) return 0;
    return Math.min(100, (pr.watched / pr.duration) * 100);
  })();

  const title = item ? getTitle(item) : '';
  const logo = useMemo(() => {
    const ls = (data?.images?.logos || []).filter((l) => l.file_path && !l.file_path.endsWith('.svg'));
    const en = ls.filter((l) => l.iso_639_1 === 'en');
    const pick = [...(en.length ? en : ls)].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0];
    return pick ? tmdbImage(pick.file_path, 'w500') : null;
  }, [data]);
  const year = (data?.release_date || data?.first_air_date || '').slice(0, 4);
  const pauseDesc = (mediaType === 'tv' ? current?.overview : '') || data?.overview || '';

  if (notOut && item) {
    return (
      <div ref={rootRef} className="nf-watch flex items-center justify-center bg-black">
        {data?.backdrop_path && (
          <img src={tmdbImage(data.backdrop_path, 'w1280') || ''} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <button type="button" onClick={back} className="sf-back" aria-label="Back to browse">
          <VfBack />
        </button>
        <div className="relative max-w-[600px] px-6 text-center">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#bcbcbc]">Not out yet</p>
          <h1 className="mt-3 text-[clamp(1.7rem,3.2vw,2.6rem)] font-bold leading-tight text-white">{title}</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-[#d2d2d2]">
            {comingSentence(item)} Add it to My List and the bell will tell you when it's here.
          </p>
          <button type="button" onClick={back} className="nf-btn nf-btn-white mt-7">
            See details
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`nf-watch ${HAS_PIP ? 'has-pip' : ''} ${mediaType === 'tv' && next ? 'has-next' : ''} ${started && !paused && !chrome ? 'is-idle' : ''}`}>
      <iframe
        ref={iframeRef}
        key={src}
        onLoad={() => {
          // The player page reloading itself again and again (the old autoplay problem): turn autoplay off.
          loadCount.current += 1;
          if (autoplay && !readyRef.current && loadCount.current >= AUTOPLAY_MAX_LOADS) turnOffAutoplay();
          // Ask providers that support it (CineLite, VidRift) for their current state once loaded.
          if (provider.commands?.getState) {
            window.setTimeout(() => sendCommand(provider.commands!.getState!()), 300);
          }
        }}
        src={src}
        aria-label={title ? `${title} player` : 'Player'}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
      />

      {FINE_POINTER && (
        <div ref={gridRef} className="sf-grid" onMouseMove={onCover} onMouseDown={onCover} aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <i
              key={k}
              ref={(el) => {
                coverRef.current[k] = el;
              }}
            />
          ))}
        </div>
      )}

      {/* Netflix-style pause screen (visual only: clicks and keys pass straight through) */}
      {started && (
        <div className={`sf-pause ${pauseShow ? 'is-on' : ''}`} aria-hidden={!pauseShow}>
          <div className="sf-pause-body">
            <p className="sf-pause-kicker">You&rsquo;re watching</p>
            {logo ? <img className="sf-pause-logo" src={logo} alt={title} /> : <p className="sf-pause-name">{title}</p>}
            {mediaType === 'tv' ? (
              <>
                <p className="sf-pause-season">{seasons.find((s) => s.season_number === season)?.name || `Season ${season}`}</p>
                <p className="sf-pause-ep">
                  {current?.name ? `${current.name}: ` : ''}Ep. {episode}
                </p>
              </>
            ) : (
              <p className="sf-pause-meta">
                {[year, data?.runtime ? `${Math.floor(data.runtime / 60) ? `${Math.floor(data.runtime / 60)}h ` : ''}${data.runtime % 60}m` : ''].filter(Boolean).join(' \u00b7 ')}
              </p>
            )}
            {pauseDesc && <p className="sf-pause-desc">{pauseDesc}</p>}
          </div>
          <span className="sf-pause-tag">Paused</span>
        </div>
      )}

      {/* back arrow, in VidFast's own server-button spot and style; shows and hides with the controls */}
      <button
        type="button"
        onClick={back}
        onMouseDown={keepPlayerFocus}
        className={`sf-back ${!started || panel || serverMenu || chrome || paused ? '' : 'is-hidden'}`}
        aria-label="Back to browse"
      >
        <VfBack />
      </button>

      {/* VidRift's own scrubber: a real draggable seek bar, since nothing like it exists for the other providers. */}
      {provider.id === 'vidrift-custom' && (started || ready) && (
        <div
          ref={scrubRef}
          className={`sf-scrub ${panel || serverMenu || (chrome || paused) ? 'is-on' : !started && stuck ? 'is-stuck' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={vrProgress.duration || 0}
          aria-valuenow={scrubTime ?? vrProgress.currentTime}
          onMouseDown={keepPlayerFocus}
          onPointerDown={(e) => {
            const el = scrubRef.current;
            if (!el || !vrProgress.duration) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = el.getBoundingClientRect();
            const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setScrubTime(frac * vrProgress.duration);
            mouseActivityRef.current(performance.now());
          }}
          onPointerMove={(e) => {
            if (scrubTime === null || !vrProgress.duration) return;
            const el = scrubRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setScrubTime(frac * vrProgress.duration);
            mouseActivityRef.current(performance.now());
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            if (scrubTime !== null) {
              sendCommand(provider.commands?.seek?.(scrubTime));
              setScrubTime(null);
            }
          }}
          onKeyDown={(e) => {
            if (!vrProgress.duration) return;
            const step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
            if (!step) return;
            e.preventDefault();
            const t = Math.min(vrProgress.duration, Math.max(0, vrProgress.currentTime + step));
            sendCommand(provider.commands?.seek?.(t));
          }}
        >
          <div className="sf-scrub-track">
            <div
              className="sf-scrub-fill"
              style={{ width: `${vrProgress.duration ? ((scrubTime ?? vrProgress.currentTime) / vrProgress.duration) * 100 : 0}%`, background: playerTheme.hex }}
            />
            <div
              className="sf-scrub-handle"
              style={{ left: `${vrProgress.duration ? ((scrubTime ?? vrProgress.currentTime) / vrProgress.duration) * 100 : 0}%`, background: playerTheme.hex }}
            />
          </div>
        </div>
      )}

      {/* bottom row, on the player's control bar: title in the middle, our buttons before subtitles */}
      <div className={`sf-bottom ${panel || serverMenu || ((started || ready) && (chrome || paused)) ? 'is-on' : !started && stuck ? 'is-stuck' : ''}`}>
        <div className={`sf-title ${mediaType === 'tv' ? 'is-tv' : ''}`}>
          <span className="sf-title-main">{title}</span>
          {mediaType === 'tv' && (
            <span className="sf-title-ep">
              <b>E{episode}</b>
              {current?.name ? ` ${current.name}` : ''}
            </span>
          )}
        </div>

        <div className={`sf-right ${provider.id === 'vidrift-custom' ? 'is-vidrift' : ''}`} onMouseDown={keepPlayerFocus}>
          {/* Global "Servers & Mode" picker: works for every provider, not just one. Reverse-engineered
              from how other sites wrap VidRift — "Direct" is our own-backend provider (CineLite),
              "Embed" is every third-party iframe, including both looks of VidRift (its native bar,
              and our own custom-built one). Picking anything here turns off the auto-fallback cascade. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setEmbedExpanded(provider.id !== DIRECT_PROVIDER_ID);
                setModeMenu((v) => !v);
              }}
              className={`sf-btn ${modeMenu ? 'is-active' : ''}`}
              aria-expanded={modeMenu}
              aria-haspopup="menu"
              aria-label="Servers &amp; Mode"
            >
              <VfServers />
            </button>
            {modeMenu && (
              <div role="menu" className="sf-menu" aria-label="Servers and mode">
                <div
                  role="menuitemradio"
                  tabIndex={0}
                  aria-checked={provider.id === DIRECT_PROVIDER_ID}
                  onClick={() => {
                    setManualProviderId(DIRECT_PROVIDER_ID);
                    setModeMenu(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setManualProviderId(DIRECT_PROVIDER_ID);
                      setModeMenu(false);
                    }
                  }}
                  className="sf-menu-row"
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="sf-menu-name" style={provider.id === DIRECT_PROVIDER_ID ? { color: playerTheme.hex } : undefined}>
                      Direct
                    </span>
                    <span className="sf-menu-details">CineLite — plays instantly, its own backend</span>
                  </span>
                  <span className="sf-menu-end">{provider.id === DIRECT_PROVIDER_ID ? <VfPlaying /> : null}</span>
                </div>
                <div
                  role="menuitemradio"
                  tabIndex={0}
                  aria-checked={provider.id !== DIRECT_PROVIDER_ID}
                  onClick={() => setEmbedExpanded((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setEmbedExpanded((v) => !v);
                    }
                  }}
                  className="sf-menu-row"
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="sf-menu-name" style={provider.id !== DIRECT_PROVIDER_ID ? { color: playerTheme.hex } : undefined}>
                      Embed
                    </span>
                    <span className="sf-menu-details">Third-party players — pick one below</span>
                  </span>
                  <span className="sf-menu-end">{provider.id !== DIRECT_PROVIDER_ID ? <VfPlaying /> : <VfChevron />}</span>
                </div>
                {embedExpanded && (
                  <div className="sf-menu-divider" role="group" aria-label="Embed source">
                    {SELECTABLE_PROVIDERS.filter((p) => p.id !== DIRECT_PROVIDER_ID).map((p) => (
                      <div
                        key={p.id}
                        role="menuitemradio"
                        tabIndex={0}
                        aria-checked={provider.id === p.id}
                        onClick={() => {
                          setManualProviderId(p.id);
                          setModeMenu(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            setManualProviderId(p.id);
                            setModeMenu(false);
                          }
                        }}
                        className="sf-menu-row sf-menu-row-indent"
                      >
                        <span className="min-w-0 flex-1 text-left">
                          <span className="sf-menu-name" style={provider.id === p.id ? { color: playerTheme.hex } : undefined}>
                            {p.name}
                          </span>
                        </span>
                        <span className="sf-menu-end">{provider.id === p.id ? <VfPlaying /> : null}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {mediaType === 'tv' && (
            <button type="button" onClick={() => setPanel((v) => !v)} className={`sf-btn ${panel ? 'is-active' : ''}`} aria-expanded={panel} aria-label="Episodes">
              <VfEpisodes />
            </button>
          )}

          {provider.id === 'cinelite' && (
            <>
              {/* Real play/pause: CineLite's channel-mode embed listens for CINELITE_CMD. */}
              <button
                type="button"
                onClick={() => sendCommand(provider.commands?.playPause?.('toggle'))}
                className="sf-btn"
                aria-label={paused ? 'Play' : 'Pause'}
              >
                {paused ? <VfPlaySmall /> : <VfPauseSmall />}
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setQualityMenu((v) => !v)}
                  className={`sf-btn ${qualityMenu ? 'is-active' : ''}`}
                  aria-expanded={qualityMenu}
                  aria-haspopup="menu"
                  aria-label="Quality"
                >
                  <VfQuality />
                </button>
                {qualityMenu && (
                  <div role="menu" className="sf-menu" aria-label="Choose quality">
                    {CINELITE_QUALITIES.map((q) => (
                      <div
                        key={q.value}
                        role="menuitemradio"
                        tabIndex={0}
                        onClick={() => {
                          sendCommand(provider.commands?.setState?.({ quality: q.value }));
                          setQualityMenu(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            sendCommand(provider.commands?.setState?.({ quality: q.value }));
                            setQualityMenu(false);
                          }
                        }}
                        className="sf-menu-row"
                      >
                        <span className="min-w-0 flex-1 text-left">
                          <span className="sf-menu-name">{q.label}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {provider.id === 'vidrift-custom' && (
            <>
              {/* Real play/pause + ±10s skip: VidRift's vidrift:play / vidrift:pause / vidrift:skip. */}
              <button
                type="button"
                onClick={() => sendCommand(provider.commands?.skip?.(-10))}
                className="sf-btn"
                aria-label="Back 10 seconds"
              >
                <VfSkipBack />
              </button>
              <button
                type="button"
                onClick={() => sendCommand(provider.commands?.playPause?.(paused ? 'play' : 'pause'))}
                className="sf-btn"
                aria-label={paused ? 'Play' : 'Pause'}
              >
                {paused ? <VfPlaySmall /> : <VfPauseSmall />}
              </button>
              <button
                type="button"
                onClick={() => sendCommand(provider.commands?.skip?.(10))}
                className="sf-btn"
                aria-label="Forward 10 seconds"
              >
                <VfSkipForward />
              </button>
              {/* Real volume + mute: VidRift's vidrift:set / vidrift:state round-trip. */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => sendCommand(provider.commands?.setState?.({ muted: !vrState.muted }))}
                  className="sf-btn"
                  aria-pressed={vrState.muted}
                  aria-label={vrState.muted ? 'Unmute' : 'Mute'}
                >
                  {vrState.muted || vrState.volume === 0 ? <VfMuted /> : <VfVolume />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={vrState.muted ? 0 : vrState.volume}
                  onChange={(e) => sendCommand(provider.commands?.setState?.({ volume: Number(e.target.value), muted: false }))}
                  style={{ accentColor: playerTheme.hex }}
                  className="h-1 w-[72px] cursor-pointer"
                  aria-label="Volume"
                />
              </div>
              {/* Real elapsed / total time, from the same vidrift:state the scrubber above reads. */}
              <span className="sf-vr-time" aria-hidden="true">
                {formatTime(scrubTime ?? vrProgress.currentTime)} / {formatTime(vrProgress.duration)}
              </span>
              {/* Real subtitle / audio tracks: only shown once VidRift's state has told us this title has any. */}
              {vrState.subtitles.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVrMenu((v) => (v === 'subtitles' ? null : 'subtitles'))}
                    className={`sf-btn ${vrMenu === 'subtitles' ? 'is-active' : ''}`}
                    aria-expanded={vrMenu === 'subtitles'}
                    aria-haspopup="menu"
                    aria-label="Subtitles"
                  >
                    <VfSubtitles />
                  </button>
                  {vrMenu === 'subtitles' && (
                    <div role="menu" className="sf-menu" aria-label="Choose subtitles">
                      {vrState.subtitles.map((s) => (
                        <div
                          key={s.value}
                          role="menuitemradio"
                          tabIndex={0}
                          aria-checked={vrState.subtitle === s.value}
                          onClick={() => {
                            sendCommand(provider.commands?.setState?.({ subtitle: s.value }));
                            setVrMenu(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              sendCommand(provider.commands?.setState?.({ subtitle: s.value }));
                              setVrMenu(null);
                            }
                          }}
                          className="sf-menu-row"
                        >
                          <span className="min-w-0 flex-1 text-left">
                            <span className="sf-menu-name" style={vrState.subtitle === s.value ? { color: playerTheme.hex } : undefined}>
                              {s.label}
                            </span>
                          </span>
                          <span className="sf-menu-end">{vrState.subtitle === s.value ? <VfPlaying /> : null}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {vrState.audios.length > 1 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setVrMenu((v) => (v === 'audio' ? null : 'audio'))}
                    className={`sf-btn ${vrMenu === 'audio' ? 'is-active' : ''}`}
                    aria-expanded={vrMenu === 'audio'}
                    aria-haspopup="menu"
                    aria-label="Audio"
                  >
                    <VfAudio />
                  </button>
                  {vrMenu === 'audio' && (
                    <div role="menu" className="sf-menu" aria-label="Choose audio language">
                      {vrState.audios.map((a) => (
                        <div
                          key={a.value}
                          role="menuitemradio"
                          tabIndex={0}
                          aria-checked={vrState.audio === a.value}
                          onClick={() => {
                            sendCommand(provider.commands?.setState?.({ audio: a.value }));
                            setVrMenu(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              sendCommand(provider.commands?.setState?.({ audio: a.value }));
                              setVrMenu(null);
                            }
                          }}
                          className="sf-menu-row"
                        >
                          <span className="min-w-0 flex-1 text-left">
                            <span className="sf-menu-name" style={vrState.audio === a.value ? { color: playerTheme.hex } : undefined}>
                              {a.label}
                            </span>
                          </span>
                          <span className="sf-menu-end">{vrState.audio === a.value ? <VfPlaying /> : null}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Our own fullscreen button: VidRift's is hidden (hide=fullscreen); fs=parent hands us the job. */}
              <button
                type="button"
                onClick={() => {
                  const box = rootRef.current;
                  if (!box) return;
                  if (document.fullscreenElement === box) document.exitFullscreen().catch(() => undefined);
                  else box.requestFullscreen().catch(() => undefined);
                }}
                className="sf-btn"
                aria-pressed={isFullscreen}
                aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {isFullscreen ? <VfFsExit /> : <VfFsEnter />}
              </button>
            </>
          )}

          {provider.id === 'vidfast' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setServerMenu((v) => !v)}
                className={`sf-btn ${serverMenu ? 'is-active' : ''}`}
                aria-expanded={serverMenu}
                aria-haspopup="menu"
                aria-label={`Server: ${server || 'Auto'}`}
              >
                <VfCloud />
              </button>
              {serverMenu && (
                <div role="menu" className="sf-menu" aria-label="Choose server">
                  {[{ name: '', badge: '', details: 'Best available server' }, ...SERVER_INFO].map((x) => {
                    const on = server === x.name;
                    return (
                      <div
                        key={x.name || 'auto'}
                        role="menuitemradio"
                        tabIndex={0}
                        aria-checked={on}
                        onClick={() => chooseServer(x.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            chooseServer(x.name);
                          }
                        }}
                        className="sf-menu-row"
                      >
                        <span className="sf-menu-badge">{x.badge ? <img src={x.badge} alt="" /> : <VfCloud />}</span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="sf-menu-name" style={on ? { color: playerTheme.hex } : undefined}>
                            {x.name || 'Auto'}
                          </span>
                          <span className="sf-menu-details">{x.details}</span>
                        </span>
                        <button
                          type="button"
                          className={`sf-menu-star ${defaultServer === x.name ? 'is-default' : ''}`}
                          style={{ color: playerTheme.hex }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDefault(x.name);
                          }}
                          aria-pressed={defaultServer === x.name}
                          aria-label={defaultServer === x.name ? `${x.name || 'Auto'} is your default server` : `Make ${x.name || 'Auto'} your default server`}
                        >
                          <VfStar filled={defaultServer === x.name} />
                        </button>
                        <span className="sf-menu-end">{on ? <VfPlaying /> : <VfChevron />}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Episodes panel: Netflix's own (season header, expanding episode rows, season list) */}
      {mediaType === 'tv' && panel && (
        <div className="nf-eps-wrap">
          <div className="nf-eps" data-lenis-prevent role="dialog" aria-label="Episodes" onMouseDown={keepPlayerFocus}>
            {paneView === 'seasons' ? (
              <>
                <div className="nf-eps-head is-static">
                  <span className="nf-eps-title">{title}</span>
                </div>
                <ul className="nf-eps-list">
                  {seasons.map((s) => (
                    <li key={s.season_number}>
                      <button
                        type="button"
                        className={`nf-eps-season ${s.season_number === panelSeason ? 'is-on' : ''}`}
                        onClick={() => {
                          setPanelSeason(s.season_number);
                          setHoverEp(null);
                          setPaneView('episodes');
                        }}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="nf-eps-count">{s.episode_count} Episodes</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`nf-eps-head ${seasons.length > 1 ? '' : 'is-static'}`}
                  onClick={() => seasons.length > 1 && setPaneView('seasons')}
                  aria-label={seasons.length > 1 ? 'Choose season' : undefined}
                >
                  {seasons.length > 1 && <NfArrowLeft />}
                  <span className="nf-eps-title">{seasons.find((s) => s.season_number === panelSeason)?.name || `Season ${panelSeason}`}</span>
                </button>
                <ol className="nf-eps-list" onMouseLeave={() => setHoverEp(null)}>
                  {!panelData.data
                    ? [0, 1, 2, 3].map((i) => <li key={i} className="nf-skel mx-[1.43em] my-[1em] h-[2.2em]" style={{ ['--i' as any]: i }} />)
                    : panelData.data.episodes.map((ep) => {
                        const isCur = panelSeason === season && ep.episode_number === episode;
                        const open = hoverEp !== null ? hoverEp === ep.episode_number : isCur;
                        const pct = isCur ? curPct : 0;
                        return (
                          <li
                            key={ep.id}
                            ref={isCur ? curEpRef : undefined}
                            role="button"
                            tabIndex={0}
                            aria-current={isCur ? 'true' : undefined}
                            aria-label={`Episode ${ep.episode_number}: ${ep.name}${isCur ? ' (now playing)' : ''}`}
                            className={`nf-ep ${open ? 'is-open' : ''}`}
                            onMouseEnter={() => setHoverEp(ep.episode_number)}
                            onFocus={() => setHoverEp(ep.episode_number)}
                            onClick={() => (isCur ? setPanel(false) : goEpisode(panelSeason!, ep.episode_number))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isCur) setPanel(false);
                                else goEpisode(panelSeason!, ep.episode_number);
                              }
                            }}
                          >
                            <div className="nf-ep-row">
                              <span className="nf-ep-num">{ep.episode_number}</span>
                              <span className="nf-ep-name">{ep.name}</span>
                              <span className="nf-ep-bar"><i style={{ width: `${pct}%` }} /></span>
                            </div>
                            {open && (
                              <div className="nf-ep-open">
                                <span className="nf-ep-thumb">
                                  {ep.still_path && <img src={tmdbImage(ep.still_path, 'w300') || ''} alt="" loading="lazy" decoding="async" />}
                                  {isCur ? (
                                    <span className="nf-ep-now"><NfNowBars />Now Playing</span>
                                  ) : (
                                    <span className="nf-ep-play"><span><PlayIcon className="h-full w-full" /></span></span>
                                  )}
                                </span>
                                <p className="nf-ep-desc">{ep.overview || 'No description available.'}</p>
                              </div>
                            )}
                          </li>
                        );
                      })}
                </ol>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchPage;
