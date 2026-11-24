import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SeasonDetails, WatchProgress } from '../types';
import { getTitleDetails, getSeasonDetails, TitleDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { VIDFAST_MOVIE_URL, VIDFAST_TV_URL } from '../constants';
import { getTitle, tmdbImage, titlePath, watchPath } from '../utils/media';
import { goBack, navigate } from '../utils/router';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PlayIcon } from '../components/Icons';

const VIDFAST_ORIGINS = [
  'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io', 'https://vidfast.me', 'https://vidfast.net',
  'https://vidfast.pm', 'https://vidfast.xyz', 'https://vidfast.vc', 'https://vidfast.bz',
];
const SAVE_EVERY_MS = 5000;
const IDLE_MS = 3000;

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
  const src = useMemo(() => {
    const theme = `&theme=${playerTheme.hex.replace('#', '')}`;
    let resume = startAt;
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
  }, [mediaType, id, season, episode, playerTheme.hex]);

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

  /* ---------- overlay chrome (auto-hide like Netflix) ---------- */
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState(false);
  const idle = useRef<number | undefined>(undefined);
  const wake = useCallback(() => {
    setChrome(true);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => setChrome(false), IDLE_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idle.current);
  }, [wake, src]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panel) setPanel(false);
        else if (!document.fullscreenElement) goBack(titlePath({ id, media_type: mediaType } as any));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [panel, id, mediaType]);

  useEffect(() => {
    if (item) document.title = `${getTitle(item)}${mediaType === 'tv' ? ` S${season}:E${episode}` : ''} — VidFast`;
  }, [item, mediaType, season, episode]);

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
    <div className="nf-watch" onMouseMove={wake} onTouchStart={wake}>
      <iframe
        key={src}
        src={src}
        title={title ? `${title} player` : 'Player'}
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="origin"
      />

      {/* top chrome: back + title (pointer-events only on the controls, so the player stays usable) */}
      <div className={`nf-watch-top ${chrome || panel ? 'is-on' : ''}`}>
        <button type="button" onClick={back} className="nf-watch-btn" aria-label="Back to browse" title="Back">
          <ChevronLeftIcon className="h-7 w-7" />
        </button>
        <div className="min-w-0 flex-1 text-shadow-netflix">
          <p className="truncate text-[max(16px,1.3vw)] font-bold text-white">{title}</p>
          {mediaType === 'tv' && (
            <p className="truncate text-[max(13px,0.95vw)] text-[#d2d2d2]">
              S{season}:E{episode}
              {current?.name ? ` “${current.name}”` : ''}
            </p>
          )}
        </div>
        {mediaType === 'tv' && (
          <div className="flex items-center gap-2">
            {next && (
              <button type="button" onClick={() => goEpisode(next.season, next.episode)} className="nf-watch-pill" title="Next episode">
                Next Episode
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setPanel((p) => !p)} className={`nf-watch-pill ${panel ? 'is-active' : ''}`} aria-expanded={panel}>
              Episodes
            </button>
          </div>
        )}
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
