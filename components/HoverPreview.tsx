import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { usePlayer } from '../contexts/PlayerContext';
import { getTitle, getYear, getGenres, getMatch, tmdbImage, titlePath } from '../utils/media';
import { CAN_HOVER } from '../utils/artwork';
import { navigate, useLocationString } from '../utils/router';
import { CardLogo } from './ResultCard';
import { PlayIcon, PlusIcon, CheckStaticIcon, ChevronDownIcon, TrashIcon } from './Icons';

/**
 * Netflix "mini modal": hover a card for a moment and it grows (FLIP, transform-only)
 * into a bigger card with quick actions. Portal-rendered so rows never clip it.
 */

interface PreviewRequest {
  item: SearchResult;
  el: HTMLElement;
  onRemove?: (item: SearchResult) => void;
  variant?: 'landscape' | 'poster';
}

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
  const { item, el, onRemove, variant = 'landscape' } = req;
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
  const match = getMatch(item);
  const cardImg = el.querySelector('img.nf-art') as HTMLImageElement | null;
  const backdrop = (variant === 'landscape' && cardImg?.currentSrc) || tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500');
  const inList = myList.some((i) => i.media.id === item.id && i.media.media_type === item.media_type);
  const expanded = open && !closing;

  const goToTitle = () => {
    onClose();
    navigate(titlePath(item));
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
      <button type="button" onClick={goToTitle} className="relative block aspect-video w-full overflow-hidden bg-[#232323]" aria-label={`Open ${title}`}>
        {backdrop && <img src={backdrop} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <span className="nf-card-shade" />
        <CardLogo item={item} />
      </button>

      <div
        className="px-[1em] pb-[1.1em] pt-[0.9em] text-[13px] transition-opacity duration-200"
        style={{ opacity: expanded ? 1 : 0, transitionDelay: expanded ? '90ms' : '0ms' }}
      >
        <div className="mb-[0.9em] flex items-center gap-[0.5em] text-[15px]">
          <button type="button" className="nf-circle is-primary" aria-label={`Play ${title}`} onClick={() => { onClose(); openPlayer(item, { tab: 'watch' }); }}>
            <PlayIcon className="ml-[2px] h-[1.05em] w-[1.05em]" />
          </button>
          {onRemove ? (
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

        <div className="mb-[0.6em] flex flex-wrap items-center gap-x-[0.5em] gap-y-1 font-medium">
          {match !== null && <span className="font-bold text-netflix-green">{match}% Match</span>}
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
