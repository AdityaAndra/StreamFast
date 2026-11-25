import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import { getTitleDetails, getSeasonDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { getTitle, tmdbImage, titlePath, watchPath } from '../utils/media';
import { goBack, navigate, openTitleFromWatch } from '../utils/router';
import { CloseIcon, PlayIcon } from '../components/Icons';

const VIDFAST_ORIGINS = [
  'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io', 'https://vidfast.me', 'https://vidfast.net',
  'https://vidfast.pm', 'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz',
];
// VidFast's documented embed domain; unlike vidfast.pro it reports play / pause / progress to us.
const VIDFAST_EMBED_MOVIE = 'https://vidfast.vc/movie/';
const VIDFAST_EMBED_TV = 'https://vidfast.vc/tv/';
const STUCK_MS = 15000;
const SAVE_EVERY_MS = 5000;
// VidFast hides its controls 3s after the last mouse move (measured), with a 250ms fade.
const IDLE_MS = 3000;
/** Hover-sync tile size (px): smaller = finer mouse tracking, so even small moves keep our
 *  controls up exactly as long as VidFast's (it restarts its 3s timer on every move). */
const CELL_PX = 24;
const FINE_POINTER = typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
/** VidFast adds a picture-in-picture button when the browser supports it (4 buttons on the right instead of 3). */
const HAS_PIP = typeof document !== 'undefined' && !!(document as any).pictureInPictureEnabled;
/** VidFast's servers, as its own server menu lists them (badge + details). "Auto" lets the player pick. */
const BADGE_4K = 'https://vidfast.vc/4k.png';
const FLAG_US = 'https://flagsapi.com/US/flat/24.png';
const SERVER_INFO: { name: string; badge: string; details: string }[] = [
  { name: 'vRapid', badge: BADGE_4K, details: 'Original audio, 4K?' },
  { name: 'vBlaze', badge: BADGE_4K, details: 'Original audio, 4K?' },
  { name: 'Cobra', badge: FLAG_US, details: 'Original audio' },
  { name: 'Bravo', badge: FLAG_US, details: 'Original audio' },
  { name: 'Delta', badge: FLAG_US, details: 'Original audio' },
];
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
const VfEpisodes = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5C3 8.11929 4.11929 7 5.5 7H14.5C15.8807 7 17 8.11929 17 9.5V18.5C17 19.8807 15.8807 21 14.5 21H5.5C4.11929 21 3 19.8807 3 18.5V9.5Z" />
    <path d="M7 3.5H17.5C19.433 3.5 21 5.067 21 7V17" />
  </svg>
);
const VfNext = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 6.27V17.73C5 19.25 6.66 20.2 7.97 19.43L17.08 13.7C18.3 12.94 18.3 11.06 17.08 10.3L7.97 4.57C6.66 3.8 5 4.75 5 6.27Z" />
    <path d="M20.5 4.5V19.5" />
  </svg>
);
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
  const [defaultServer, setDefaultServer] = useState<string>(loadServer);
  const [server, setServer] = useState<string>(loadServer);
  const [switchAt, setSwitchAt] = useState<number | undefined>(undefined);
  const lastTime = useRef(0);
  useEffect(() => setSwitchAt(undefined), [season, episode]);

  const src = useMemo(() => {
    // Our page shows the title and server picker itself (Netflix layout), so hide VidFast's.
    const theme = `&theme=${playerTheme.hex.replace('#', '')}&title=false&hideServer=true${server ? `&server=${server}` : ''}`;
    let resume = switchAt ?? startAt;
    if (resume === undefined && saved?.progress.watched && saved.progress.duration) {
      const same = mediaType === 'movie' || (saved.progress.season === season && saved.progress.episode === episode);
      const nearEnd = saved.progress.watched > saved.progress.duration - 90;
      if (same && saved.progress.watched > 30 && !nearEnd) resume = Math.floor(saved.progress.watched);
    }
    const t = resume ? `&startAt=${resume}` : '';
    return mediaType === 'movie'
      ? `${VIDFAST_EMBED_MOVIE}${id}?autoPlay=true${theme}${t}`
      : `${VIDFAST_EMBED_TV}${id}/${season}/${episode}?autoPlay=true&nextButton=true&autoNext=true${theme}${t}`;
    // Only rebuild when the episode changes, not on every progress save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, season, episode, playerTheme.hex, server, switchAt]);

  /* ---------- overlay chrome ----------
     The player is VidFast's page inside ours, so mouse moves over it never reach us.
     Our bottom bits (title, server, episodes) show while paused, for a few seconds after
     play / seek / opening, and while the pointer is over them. The back arrow always stays. */
  const [chrome, setChrome] = useState(false);
  const [started, setStarted] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState(false);
  const [serverMenu, setServerMenu] = useState(false);
  const idle = useRef<number | undefined>(undefined);
  const wake = useCallback(() => {
    setChrome(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setChrome(false), IDLE_MS);
  }, []);
  const wakeRef = useRef(wake);
  wakeRef.current = wake;
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // New video (or server): hidden while VidFast loads. If nothing plays for a while, offer the server button.
  useEffect(() => {
    setStarted(false);
    setPaused(false);
    setChrome(false);
    setStuck(false);
    const t = window.setTimeout(() => setStuck(true), STUCK_MS);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(idle.current);
    };
  }, [src]);

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
    if (!item) return;
    const sv = live.current.saved;
    const same = mediaType === 'movie' || (sv?.progress.season === season && sv?.progress.episode === episode);
    save(mediaType === 'tv' ? { season, episode, ...(same ? { watched: sv?.progress.watched, duration: sv?.progress.duration } : {}) } : { ...(sv?.progress || {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, season, episode]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!VIDFAST_ORIGINS.includes(e.origin) || !e.data) return;
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
        if (pr.watched > lastTime.current + 1) setStarted(true); // progress moving: the video is playing
        lastTime.current = pr.watched;
        save(mediaType === 'tv' ? { season: cs, episode: ce, watched: pr.watched, duration: pr.duration } : { watched: pr.watched, duration: pr.duration });
        return;
      }
      if (e.data.type !== 'PLAYER_EVENT') return;
      const { event: ev, currentTime, duration, season: s, episode: ep, playing } = e.data.data || {};
      if (currentTime > 0) lastTime.current = currentTime;
      if (typeof playing === 'boolean') {
        if (playing || currentTime > 0) setStarted(true);
        if (pausedRef.current !== !playing) {
          pausedRef.current = !playing;
          setPaused(!playing);
          setServerMenu(false); // you played / paused (e.g. with Space): the server list goes, like VidFast's menus
          wakeRef.current(); // VidFast shows its controls on play / pause
        }
      }
      if (ev === 'playerstatus') return;
      if (['play', 'playing', 'timeupdate', 'pause', 'seeked'].includes(ev)) setStarted(true);
      // VidFast shows its controls when you play, pause or seek: show ours with them.
      if (ev === 'play' || ev === 'playing') {
        setPaused(false);
        setServerMenu(false);
        wakeRef.current();
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
        if ((s && s !== cs) || (ep && ep !== ce)) navigate(watchPath({ id, media_type: 'tv' }, { season: progress.season, episode: progress.episode }), { replace: true, keepScroll: true });
      }
      save(progress);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mediaType, id, save]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (serverMenu) setServerMenu(false);
        else if (panel) setPanel(false);
        else if (!document.fullscreenElement) openTitleFromWatch(titlePath({ id, media_type: mediaType, title: item ? getTitle(item) : '' } as any));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [panel, serverMenu, id, mediaType, item]);

  useEffect(() => {
    if (item) document.title = `${getTitle(item)}${mediaType === 'tv' ? ` S${season}:E${episode}` : ''} — StreamFast`;
  }, [item, mediaType, season, episode]);


  /* ---------- fullscreen: the whole watch page, so our back / title / server stay on screen ---------- */
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    let wasOurs = false;
    const onFs = () => {
      const el = document.fullscreenElement;
      const box = rootRef.current;
      if (box && el && el === iframeRef.current) {
        // The player's fullscreen button: enter ours instead, or leave if we were already in.
        if (wasOurs) document.exitFullscreen().catch(() => undefined);
        else box.requestFullscreen().catch(() => undefined);
        return;
      }
      wasOurs = !!box && el === box;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Picking a server switches this video only; the star makes it your default (like VidFast's menu).
  const chooseServer = (name: string) => {
    setServerMenu(false);
    window.setTimeout(() => iframeRef.current?.focus(), 0);
    if (name === server) return;
    if (lastTime.current > 5) setSwitchAt(Math.floor(lastTime.current));
    setServer(name);
  };
  const toggleDefault = (name: string) => {
    const next = defaultServer === name ? '' : name;
    setDefaultServer(next);
    try {
      if (next) localStorage.setItem(SERVER_KEY, next);
      else localStorage.removeItem(SERVER_KEY);
    } catch {
      /* ignore */
    }
  };

  /* ---------- hover sync ----------
     VidFast's player is its own page inside ours, so mouse moves over it never reach us, and its
     play / pause commands don't work. To see the mouse without ever blocking a click, the video is
     covered by a grid of invisible tiles: a tile notices the pointer arriving and steps aside at once,
     so every move after that, and every click and key press, goes straight to VidFast. Each new tile
     the pointer reaches = "the mouse moved" -> our title / cloud / back arrow show, then fade 3s
     after the last move, exactly like VidFast's own controls. */
  const gridRef = useRef<HTMLDivElement>(null);
  const lastCell = useRef<HTMLElement | null>(null);
  const lastRow = useRef(-1);
  const [grid, setGrid] = useState({ cols: 0, rows: 0, size: CELL_PX });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      lastCell.current = null;
      lastRow.current = -1;
      // 24px tiles, a little bigger on very large screens so there are never more than ~4,500.
      const size = Math.max(CELL_PX, Math.ceil(Math.sqrt((el.clientWidth * el.clientHeight) / 4500)));
      setGrid({ cols: Math.ceil(el.clientWidth / size), rows: Math.ceil(el.clientHeight / size), size });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onCell = useCallback((e: React.MouseEvent) => {
    const c = e.target as HTMLElement;
    if (c.tagName !== 'I') return;
    c.style.pointerEvents = 'none'; // step aside before the next event (a click can never land here)
    if (lastCell.current && lastCell.current !== c) lastCell.current.style.pointerEvents = '';
    lastCell.current = c;
    lastRow.current = Number(c.dataset.r);
    wakeRef.current();
  }, []);

  useEffect(() => {
    if (!FINE_POINTER) return;
    let over = false;
    const t = window.setInterval(() => {
      const f = iframeRef.current;
      const onPlayer = !!f && f.matches(':hover');
      const onGrid = !!gridRef.current?.matches(':hover');
      const onOurs = !!rootRef.current?.querySelector('.sf-back:hover, .sf-right:hover, .sf-menu:hover, .nf-watch-panel:hover');
      const now = onPlayer || onGrid;
      if (onOurs) wakeRef.current(); // pointing at our own buttons keeps them up
      else if (now && !over) wakeRef.current(); // pointer came onto the video
      else if (now && lastRow.current === grid.rows - 1) wakeRef.current(); // on VidFast's control bar: it keeps its controls up
      else if (!now && over) {
        // Pointer left the video: VidFast keeps its controls for 3s after the last move, so do we.
        wakeRef.current();
        if (lastCell.current) lastCell.current.style.pointerEvents = '';
        lastCell.current = null;
        lastRow.current = -1;
      }
      over = now;
    }, 40);
    return () => window.clearInterval(t);
  }, [grid.rows]);

  // Play / pause state straight from the player (its status reply), checked every second.
  useEffect(() => {
    const t = window.setInterval(() => iframeRef.current?.contentWindow?.postMessage({ command: 'getStatus' }, '*'), 1000);
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
          setServerMenu(false);
          setPanel(false);
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
      e.preventDefault();
      setServerMenu(false);
      setPanel(false);
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
    setPanel(false);
    navigate(watchPath({ id, media_type: 'tv' }, { season: s, episode: e }), { replace: true, keepScroll: true });
  };

  const [panelSeason, setPanelSeason] = useState<number | undefined>(season);
  useEffect(() => setPanelSeason(season), [season]);
  const panelData = useCachedData<SeasonDetails>(panel && panelSeason ? `season:${id}:${panelSeason}` : null, () => getSeasonDetails(id, panelSeason!));

  const title = item ? getTitle(item) : '';

  return (
    <div ref={rootRef} className={`nf-watch ${HAS_PIP ? 'has-pip' : ''} ${started && !paused && !chrome ? 'is-idle' : ''}`}>
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        title={title ? `${title} player` : 'Player'}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
      />

      {FINE_POINTER && (
        <div ref={gridRef} className="sf-grid" style={{ gridTemplateColumns: `repeat(${grid.cols}, ${grid.size}px)`, gridAutoRows: `${grid.size}px` }} onMouseOver={onCell} aria-hidden="true">
          {Array.from({ length: grid.cols * grid.rows }, (_, k) => (
            <i key={k} data-r={Math.floor(k / Math.max(1, grid.cols))} />
          ))}
        </div>
      )}

      {/* back arrow, in VidFast's own server-button spot and style; shows and hides with the controls */}
      <button
        type="button"
        onClick={back}
        onMouseDown={keepPlayerFocus}
        onMouseMove={wake}
        className={`sf-back ${!started || panel || serverMenu || chrome || paused ? '' : 'is-hidden'}`}
        aria-label="Back to browse"
        title="Back"
      >
        <VfBack />
      </button>

      {/* bottom row, on the player's control bar: title in the middle, our buttons before subtitles */}
      <div className={`sf-bottom ${panel || serverMenu || (started && (chrome || paused)) ? 'is-on' : !started && stuck ? 'is-stuck' : ''}`}>
        <p className="sf-title" title={title} onMouseEnter={wake}>
          {title}
          {mediaType === 'tv' && (
            <span className="sf-title-ep">
              E{episode}
              {current?.name ? ` ${current.name}` : ''}
            </span>
          )}
        </p>

        <div className="sf-right" onMouseEnter={wake} onMouseMove={wake} onMouseDown={keepPlayerFocus}>
          {mediaType === 'tv' && next && (
            <button type="button" onClick={() => goEpisode(next.season, next.episode)} className="sf-btn" aria-label="Next episode" title="Next episode">
              <VfNext />
            </button>
          )}
          {mediaType === 'tv' && (
            <button type="button" onClick={() => setPanel((v) => !v)} className={`sf-btn ${panel ? 'is-active' : ''}`} aria-expanded={panel} aria-label="Episodes" title="Episodes">
              <VfEpisodes />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setServerMenu((v) => !v)}
              className={`sf-btn ${serverMenu ? 'is-active' : ''}`}
              aria-expanded={serverMenu}
              aria-haspopup="menu"
              aria-label={`Server: ${server || 'Auto'}`}
              title="Server"
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
                        title={defaultServer === x.name ? 'Default server' : 'Make default'}
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
        </div>
      </div>

      {/* episodes drawer */}
      {mediaType === 'tv' && panel && (
        <aside className="nf-watch-panel" data-lenis-prevent aria-label="Episodes">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            {seasons.length > 1 ? (
              <select aria-label="Season" value={panelSeason} onChange={(e) => setPanelSeason(Number(e.target.value))} className="nf-select !text-[15px] !font-semibold">
                {seasons.map((s) => (
                  <option key={s.season_number} value={s.season_number}>{s.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-[16px] font-bold text-white">{seasons[0]?.name || `Season ${season}`}</span>
            )}
            <button type="button" onClick={() => setPanel(false)} className="nf-circle text-sm" aria-label="Close episodes"><CloseIcon className="h-4 w-4" /></button>
          </div>
          <ol className="flex-1 overflow-y-auto overscroll-contain py-1">
            {!panelData.data
              ? [0, 1, 2, 3].map((i) => <li key={i} className="nf-skel mx-4 my-3 h-16" style={{ ['--i' as any]: i }} />)
              : panelData.data.episodes.map((ep) => {
                  const isCur = panelSeason === season && ep.episode_number === episode;
                  return (
                    <li key={ep.id}>
                      <button
                        type="button"
                        onClick={() => goEpisode(panelSeason!, ep.episode_number)}
                        className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.07] ${isCur ? 'bg-white/[0.1]' : ''}`}
                      >
                        <span className="relative aspect-video w-[7.5rem] flex-shrink-0 overflow-hidden rounded-[4px] bg-[#232323]">
                          {ep.still_path && <img src={tmdbImage(ep.still_path, 'w300') || ''} alt="" loading="lazy" className="h-full w-full object-cover" />}
                          <span className={`absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity ${isCur ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                            <PlayIcon className="h-5 w-5 text-white" />
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-white">{ep.episode_number}. {ep.name}</span>
                          {isCur && <span className="text-[12px] font-semibold text-netflix-red">Now playing</span>}
                          {!isCur && (ep as any).runtime ? <span className="text-[12px] text-[#a3a3a3]">{(ep as any).runtime}m</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
          </ol>
        </aside>
      )}
    </div>
  );
};

export default WatchPage;
