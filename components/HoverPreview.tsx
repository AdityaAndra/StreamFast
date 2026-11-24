import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SearchResult, WatchProgress, SeasonDetails } from '../types';
import { getSeasonDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { useAppContext } from '../contexts/AppContext';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitle, getYear, getGenres, tmdbImage, titlePath } from '../utils/media';
import { ImdbRating } from './Imdb';
import { CAN_HOVER } from '../utils/artwork';
import { navigate, useLocationString } from '../utils/router';
import { CardLogo } from './ResultCard';
import { PlayIcon, PlusIcon, CheckStaticIcon, ChevronDownIcon, TrashIcon, CloseIcon } from './Icons';

/**
 * Netflix "mini modal": hover a card for a moment and it grows (FLIP, transform-only)
 * into a bigger card with quick actions. Portal-rendered so rows never clip it.
 */

/** Continue Watching cards: resume point + "Remove from row". */
export interface ContinueInfo {
  progress: WatchProgress;
  onRemove: () => void;
}

interface PreviewRequest {
  item: SearchResult;
  el: HTMLElement;
  onRemove?: (item: SearchResult) => void;
  variant?: 'landscape' | 'poster';
  cw?: ContinueInfo;
}

/** "23 of 58m" / "1h 12m of 2h 28m" (Netflix progress text). */
const fmtMins = (sec: number) => {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const progressLabel = (p: WatchProgress) => {
  if (!p.watched || !p.duration) return '';
  const w = Math.round(p.watched / 60);
  const d = Math.round(p.duration / 60);
  return d >= 60 ? `${fmtMins(p.watched)} of ${fmtMins(p.duration)}` : `${Math.max(1, w)} of ${d}m`;
};

interface HoverPreviewApi {
  show: (req: PreviewRequest) => void;
  cancel: () => void;
}

const HoverPreviewContext = createContext<HoverPreviewApi>({ show: () => {}, cancel: () => {} });
export const useHoverPreview = () => useContext(HoverPreviewContext);

const OPEN_DELAY_MS = 330;

export const HoverPreviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<(PreviewRequest & { key: number }) | null>(null);
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);
  const counter = useRef(0);
  const location = useLocationString();

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const show = useCallback((req: PreviewRequest) => {
    if (!CAN_HOVER) return;
    clear();
    timer.current = window.setTimeout(() => {
      if (!req.el.isConnected || !req.el.matches(':hover')) return;
      setClosing(false);
      setActive({ ...req, key: ++counter.current });
    }, OPEN_DELAY_MS);
  }, []);

  const cancel = useCallback(() => clear(), []);
  const close = useCallback(() => {
    clear();
    setClosing(true);
  }, []);
  const remove = useCallback(() => {
    setActive(null);
    setClosing(false);
  }, []);

  // Close on scroll, resize, Escape and page change.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, { capture: true } as any);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, close]);

  useEffect(() => {
    remove();
    clear();
  }, [location, remove]);

  useEffect(() => () => clear(), []);

  // Stable value: otherwise every card on the page re-renders each time a preview opens/closes.
  const api = useMemo(() => ({ show, cancel }), [show, cancel]);

  return (
    <HoverPreviewContext.Provider value={api}>
      {children}
      {active && createPortal(<PreviewCard key={active.key} req={active} closing={closing} onClose={close} onClosed={remove} />, document.body)}
    </HoverPreviewContext.Provider>
  );
};

interface Layout {
  left: number;
  top: number;
  width: number;
  from: string;
}

const computeLayout = (el: HTMLElement, variant: 'landscape' | 'poster'): Layout => {
  const rect = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;
  const baseWidth = variant === 'poster' ? rect.height * 0.95 : rect.width;
  const width = Math.round(Math.min(Math.max(baseWidth * 1.5, 300), 440));
  const imgH = (width * 9) / 16;

  let left = rect.left + rect.width / 2 - width / 2;
  if (rect.left < vw * 0.07) left = rect.left;
  else if (rect.right > vw * 0.93) left = rect.right - width;
  left = Math.min(Math.max(left, margin), vw - width - margin);

  let top = rect.top + rect.height / 2 - imgH / 2;
  top = Math.min(Math.max(top, 70), vh - imgH - 150 - margin);

  // FLIP start: shrink the preview back onto the card it came from.
  const s = variant === 'poster' ? 0.82 : rect.width / width;
  const dx = variant === 'poster' ? rect.left + rect.width / 2 - (left + (width * s) / 2) : rect.left - left;
  const dy = variant === 'poster' ? rect.top + rect.height / 2 - (top + (imgH * s) / 2) : rect.top - top;
  return { left, top, width, from: `translate3d(${dx}px, ${dy}px, 0) scale(${s})` };
};

const PreviewCard: React.FC<{ req: PreviewRequest; closing: boolean; onClose: () => void; onClosed: () => void }> = ({ req, closing, onClose, onClosed }) => {
  const { item, el, onRemove, variant = 'landscape', cw } = req;
  const { myList, toggleMyListItem } = useAppContext();
  const { openPlayer } = usePlayer();
  const [layout] = useState(() => computeLayout(el, variant));
  const [open, setOpen] = useState(false);
  const fadeFromCard = variant === 'poster';

  useLayoutEffect(() => {
    // Two frames so the browser paints the start state before transitioning (smooth on 120Hz too).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpen(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(onClosed, 230);
    return () => window.clearTimeout(t);
  }, [closing, onClosed]);

  const title = getTitle(item);
  const year = getYear(item);
  const genres = getGenres(item, 3);
  const cardImg = el.querySelector('img.nf-art, img[data-art]') as HTMLImageElement | null;
  const backdrop = (variant === 'landscape' && cardImg?.currentSrc) || tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500');
  const inList = myList.some((i) => i.media.id === item.id && i.media.media_type === item.media_type);
  const expanded = open && !closing;

  // Continue Watching: episode name for "S2:E5 "Title"" (shares the episode-list cache).
  const season = cw && item.media_type === 'tv' ? cw.progress.season : undefined;
  const episode = cw && item.media_type === 'tv' ? cw.progress.episode : undefined;
  const seasonData = useCachedData<SeasonDetails>(season ? `season:${item.id}:${season}` : null, () => getSeasonDetails(item.id, season!));
  const episodeName = episode ? seasonData.data?.episodes?.find((e) => e.episode_number === episode)?.name : undefined;
  const percent = cw && cw.progress.watched && cw.progress.duration ? Math.min(100, Math.max(2, (cw.progress.watched / cw.progress.duration) * 100)) : null;
  const timeText = cw ? progressLabel(cw.progress) : '';

  const goToTitle = () => {
    onClose();
    navigate(titlePath(item));
  };

  // Clicking the picture plays straight away; Continue Watching resumes where you left off.
  const play = () => {
    onClose();
    openPlayer(item, { tab: 'watch', progress: cw?.progress });
  };

  return (
    <div
      role="dialog"
      aria-label={`${title} preview`}
      onMouseLeave={onClose}
      className={`nf-preview ${closing ? 'is-closing' : ''}`}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        transform: expanded ? 'translate3d(0,0,0) scale(1)' : layout.from,
        opacity: fadeFromCard ? (expanded ? 1 : 0) : 1,
      }}
    >
      <button
        type="button"
        onClick={play}
        className="relative block aspect-video w-full cursor-pointer overflow-hidden bg-[#232323]"
        aria-label={cw ? `Resume ${title}` : `Play ${title}`}
        title={cw ? 'Resume' : 'Play'}
      >
        {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <span className="nf-card-shade" />
        <CardLogo item={item} />
        {percent !== null && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-[#4d4d4d]/80">
            <span className="block h-full bg-netflix-red" style={{ width: `${percent}%` }} />
          </span>
        )}
      </button>

      <div
        className="px-[1em] pb-[1.1em] pt-[0.9em] text-[13px] transition-opacity duration-200"
        style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? '90ms' : '0ms' }}
      >
        <div className="mb-[0.9em] flex items-center gap-[0.5em] text-[15px]">
          <button
            type="button"
            className="nf-circle is-primary"
            aria-label={cw ? `Resume ${title}` : `Play ${title}`}
            title={cw ? 'Resume' : 'Play'}
            onClick={play}
          >
            <PlayIcon className="ml-[2px] h-[1.05em] w-[1.05em]" />
          </button>
          {cw ? (
            <>
              <button
                type="button"
                className="nf-circle"
                aria-pressed={inList}
                aria-label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
                title={inList ? 'Remove from My List' : 'Add to My List'}
                onClick={() => toggleMyListItem(item)}
              >
                {inList ? <CheckStaticIcon className="h-[1em] w-[1em]" /> : <PlusIcon className="h-[1.1em] w-[1.1em]" />}
              </button>
              <button
                type="button"
                className="nf-circle"
                aria-label={`Remove ${title} from Continue Watching`}
                title="Remove from row"
                onClick={() => { onClose(); cw.onRemove(); }}
              >
                <CloseIcon className="h-[1em] w-[1em]" />
              </button>
            </>
          ) : onRemove ? (
            <button type="button" className="nf-circle" aria-label={`Remove ${title}`} onClick={() => { onRemove(item); onClose(); }}>
              <TrashIcon className="h-[1em] w-[1em]" />
            </button>
          ) : (
            <button
              type="button"
              className="nf-circle"
              aria-pressed={inList}
              aria-label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
              title={inList ? 'Remove from My List' : 'Add to My List'}
              onClick={() => toggleMyListItem(item)}
            >
              {inList ? <CheckStaticIcon className="h-[1em] w-[1em]" /> : <PlusIcon className="h-[1.1em] w-[1.1em]" />}
            </button>
          )}
          <button type="button" className="nf-circle ml-auto" aria-label="More info" title="More info" onClick={goToTitle}>
            <ChevronDownIcon className="h-[1.2em] w-[1.2em]" />
          </button>
        </div>

        {cw && (
          <div className="mb-[0.75em]">
            {(season && episode) ? (
              <p className="mb-[0.45em] truncate text-[14px] font-semibold text-white">
                S{season}:E{episode}
                {episodeName && <span className="font-normal text-[#bcbcbc]"> &ldquo;{episodeName}&rdquo;</span>}
              </p>
            ) : null}
            {percent !== null && (
              <div className="flex items-center gap-[0.7em]">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#4d4d4d]" aria-hidden="true">
                  <div className="h-full rounded-full bg-netflix-red" style={{ width: `${percent}%` }} />
                </div>
                {timeText && <span className="flex-shrink-0 text-[12px] text-[#bcbcbc]">{timeText}</span>}
              </div>
            )}
          </div>
        )}

        <div className="mb-[0.6em] flex flex-wrap items-center gap-x-[0.5em] gap-y-1 font-medium">
          <ImdbRating item={item} size="sm" />
          <span className="border border-white/40 px-[0.4em] text-[11px] leading-[1.6] text-[#bcbcbc]">{item.media_type === 'movie' ? 'Movie' : 'Series'}</span>
          {year && <span className="text-[#bcbcbc]">{year}</span>}
          <span className="rounded-[3px] border border-white/40 px-[0.3em] text-[10px] font-bold leading-[1.5] text-[#bcbcbc]">HD</span>
        </div>

        {genres.length > 0 && (
          <p className="flex flex-wrap items-center text-white">
            {genres.map((g, i) => (
              <React.Fragment key={g}>
                {i > 0 && <span className="mx-[0.45em] text-[#646464]">•</span>}
                {g}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </div>
  );
};
