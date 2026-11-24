import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import { getTitleDetails, getSeasonDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { VIDFAST_MOVIE_URL, VIDFAST_TV_URL } from '../constants';
import { getTitle, tmdbImage, titlePath, watchPath } from '../utils/media';
import { goBack, navigate } from '../utils/router';
import { ChevronLeftIcon, CloseIcon, PlayIcon } from '../components/Icons';

const VIDFAST_ORIGINS = [
  'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io', 'https://vidfast.me', 'https://vidfast.net',
  'https://vidfast.pm', 'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz',
];
const SAVE_EVERY_MS = 5000;
const IDLE_MS = 3500;
/** VidFast's servers (its own cloud menu). "Auto" lets the player pick. */
const SERVERS = ['vRapid', 'vBlaze', 'Cobra', 'Bravo', 'Delta'];
const SERVER_KEY = 'vf_server';
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
      ? `${VIDFAST_MOVIE_URL}${id}?autoPlay=true${theme}${t}`
      : `${VIDFAST_TV_URL}${id}/${season}/${episode}?autoPlay=true&nextButton=true&autoNext=true${theme}${t}`;
    // Only rebuild when the episode changes, not on every progress save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType, id, season, episode, playerTheme.hex, server, switchAt]);

  /* ---------- overlay chrome ----------
     The player is VidFast's page inside ours, so mouse moves over it never reach us.
     Our bottom bits (title, server, episodes) show while paused, for a few seconds after
     play / seek / opening, and while the pointer is over them. The back arrow always stays. */
  const [chrome, setChrome] = useState(true);
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
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idle.current);
  }, [wake, src]);

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
      if (!VIDFAST_ORIGINS.includes(e.origin) || !e.data || e.data.type !== 'PLAYER_EVENT') return;
      const { event: ev, currentTime, duration, season: s, episode: ep } = e.data.data || {};
      if (currentTime > 0) lastTime.current = currentTime;
      if (ev === 'play' || ev === 'playing') {
        setPaused(false);
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
        else if (!document.fullscreenElement) goBack(titlePath({ id, media_type: mediaType } as any));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [panel, serverMenu, id, mediaType]);

  useEffect(() => {
    if (item) document.title = `${getTitle(item)}${mediaType === 'tv' ? ` S${season}:E${episode}` : ''} — VidFast`;
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

  const chooseServer = (name: string) => {
    setServerMenu(false);
    if (name === server) return;
    try {
      if (name) localStorage.setItem(SERVER_KEY, name);
      else localStorage.removeItem(SERVER_KEY);
    } catch {
      /* ignore */
    }
    if (lastTime.current > 5) setSwitchAt(Math.floor(lastTime.current));
    setServer(name);
  };

  const back = () => goBack(item ? titlePath(item) : '/');
  const goEpisode = (s: number, e: number) => {
    setPanel(false);
    navigate(watchPath({ id, media_type: 'tv' }, { season: s, episode: e }), { replace: true, keepScroll: true });
  };

  const [panelSeason, setPanelSeason] = useState<number | undefined>(season);
  useEffect(() => setPanelSeason(season), [season]);
  const panelData = useCachedData<SeasonDetails>(panel && panelSeason ? `season:${id}:${panelSeason}` : null, () => getSeasonDetails(id, panelSeason!));

  const title = item ? getTitle(item) : '';

  return (
    <div ref={rootRef} className="nf-watch">
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

      {/* always-on back arrow, where VidFast's server button used to be */}
      <button type="button" onClick={back} onMouseMove={wake} className="nf-watch-back" aria-label="Back to browse" title="Back">
        <ChevronLeftIcon className="h-[70%] w-[70%]" />
      </button>

      {/* bottom row, lined up with the player's own controls */}
      <div className={`nf-watch-bottom ${chrome || paused || panel || serverMenu ? 'is-on' : ''}`} onMouseMove={wake}>
        <p className="nf-watch-title" title={title}>
          <span className="font-bold">{title}</span>
          {mediaType === 'tv' && (
            <span className="ml-[0.6em] font-normal text-[#d2d2d2]">
              E{episode}
              {current?.name ? ` ${current.name}` : ''}
            </span>
          )}
        </p>

        <div className="nf-watch-right">
          {mediaType === 'tv' && next && (
            <button type="button" onClick={() => goEpisode(next.season, next.episode)} className="nf-watch-icon" aria-label="Next episode" title="Next episode">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-[62%] w-[62%]" aria-hidden="true"><path d="M5 4.5v15l11-7.5L5 4.5z" /><rect x="17" y="4.5" width="2.6" height="15" rx="0.6" /></svg>
            </button>
          )}
          {mediaType === 'tv' && (
            <button type="button" onClick={() => setPanel((v) => !v)} className={`nf-watch-icon ${panel ? 'is-active' : ''}`} aria-expanded={panel} aria-label="Episodes" title="Episodes">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-[62%] w-[62%]" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="1.5" /><path d="M7 4h13a1 1 0 0 1 1 1v12" /></svg>
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setServerMenu((v) => !v)}
              className={`nf-watch-icon ${serverMenu ? 'is-active' : ''}`}
              aria-expanded={serverMenu}
              aria-haspopup="menu"
              aria-label={`Server: ${server || 'Auto'}`}
              title="Server"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[70%] w-[70%]" aria-hidden="true"><path d="M7 18.5h10.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.6 8.2 5.2 5.2 0 0 0 7 18.5z" /></svg>
            </button>
            {serverMenu && (
              <div role="menu" className="nf-server-menu" aria-label="Choose server">
                <p className="px-4 pb-1.5 pt-3 text-[12px] font-semibold uppercase tracking-wider text-[#8c8c8c]">Server</p>
                {['', ...SERVERS].map((name) => (
                  <button
                    key={name || 'auto'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={server === name}
                    onClick={() => chooseServer(name)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-white/10 ${server === name ? 'font-bold text-white' : 'text-[#d2d2d2]'}`}
                  >
                    <span className="w-4 text-netflix-red">{server === name ? '✓' : ''}</span>
                    {name || 'Auto (best available)'}
                  </button>
                ))}
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
