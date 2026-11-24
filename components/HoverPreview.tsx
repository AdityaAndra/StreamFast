import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import { getTitle, getYear, getGenres, tmdbImage } from '../utils/media';
import { PlayIcon, PlusIcon, CheckStaticIcon, ChevronDownIcon, TrashIcon, FilmIcon, TvIcon } from './Icons';

/**
 * Netflix-style hover preview: after hovering a card for a moment, an enlarged card
 * with the backdrop, quick actions and metadata pops out above the row.
 * Rendered in a portal so it is never clipped by the horizontally scrolling rows.
 */

interface PreviewRequest {
  item: SearchResult;
  el: HTMLElement;
  onSelect: (item: SearchResult) => void;
  onRemove?: (item: SearchResult) => void;
}

interface HoverPreviewApi {
  show: (req: PreviewRequest) => void;
  cancel: () => void;
}

const HoverPreviewContext = createContext<HoverPreviewApi>({ show: () => {}, cancel: () => {} });
export const useHoverPreview = () => useContext(HoverPreviewContext);

const OPEN_DELAY_MS = 450;

export const HoverPreviewProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<PreviewRequest | null>(null);
  const timerRef = useRef<number | null>(null);
  const canHoverRef = useRef(
    typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  );

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback((req: PreviewRequest) => {
    if (!canHoverRef.current) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      // Only open if the pointer is still on the card.
      if (req.el.isConnected && req.el.matches(':hover')) setActive(req);
    }, OPEN_DELAY_MS);
  }, []);

  const cancel = useCallback(() => clearTimer(), []);

  const close = useCallback(() => {
    clearTimer();
    setActive(null);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onScroll = () => close();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, close]);

  useEffect(() => () => clearTimer(), []);

  return (
    <HoverPreviewContext.Provider value={{ show, cancel }}>
      {children}
      {active && createPortal(<PreviewCard key={`${active.item.media_type}-${active.item.id}`} {...active} onClose={close} />, document.body)}
    </HoverPreviewContext.Provider>
  );
};

const CircleButton: React.FC<{
  onClick: () => void;
  label: string;
  primary?: boolean;
  className?: string;
  children: ReactNode;
  pressed?: boolean;
}> = ({ onClick, label, primary, className = '', children, pressed }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 active:scale-95 ${
      primary
        ? 'border-white bg-white text-black hover:bg-white/80 hover:border-white/80'
        : 'border-[#808080] bg-[#2a2a2a]/60 text-white hover:border-white'
    } ${className}`}
  >
    {children}
  </button>
);

const PreviewCard: React.FC<PreviewRequest & { onClose: () => void }> = ({ item, el, onSelect, onRemove, onClose }) => {
  const { myList, toggleMyListItem } = useAppContext();
  const ref = useRef<HTMLDivElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Position computed once from the card's on-screen rect.
  const [layout] = useState(() => {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 12;
    const width = Math.round(Math.min(Math.max(rect.width * 1.5, 290), 420));
    const estimatedHeight = width * 0.5625 + 150;

    let left = rect.left + rect.width / 2 - width / 2;
    let originX = 'center';
    if (left < margin) {
      left = Math.max(margin, rect.left);
      originX = 'left';
    }
    if (left + width > vw - margin) {
      left = Math.min(vw - margin - width, rect.right - width);
      originX = 'right';
    }
    let centerY = rect.top + rect.height / 2;
    centerY = Math.min(Math.max(centerY, margin + estimatedHeight / 2), vh - margin - estimatedHeight / 2);

    return { left, width, centerY, originX, fromScale: rect.width / width };
  });

  // Close if the pointer ends up outside the (final, unscaled) preview box.
  useLayoutEffect(() => {
    const onMove = (e: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      const h = node.offsetHeight;
      const top = layout.centerY - h / 2;
      const outside =
        e.clientX < layout.left - 4 ||
        e.clientX > layout.left + layout.width + 4 ||
        e.clientY < top - 4 ||
        e.clientY > top + h + 4;
      if (outside) onClose();
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [layout, onClose]);

  const title = getTitle(item);
  const year = getYear(item);
  const genres = getGenres(item, 3);
  const match = typeof item.vote_average === 'number' && item.vote_average > 0 ? Math.round(item.vote_average * 10) : null;
  const backdrop = tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500');
  const inList = myList.some((i) => i.media.id === item.id && i.media.media_type === item.media_type);

  const open = () => {
    onClose();
    onSelect(item);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${title} preview`}
      onMouseLeave={onClose}
      className="preview-pop fixed z-[45] overflow-hidden rounded-md bg-netflix-card text-white shadow-[0_8px_30px_rgba(0,0,0,0.75)] ring-1 ring-black/50"
      style={
        {
          left: layout.left,
          top: layout.centerY,
          width: layout.width,
          transformOrigin: `${layout.originX} center`,
          '--from-scale': layout.fromScale,
        } as React.CSSProperties
      }
    >
      <button type="button" onClick={open} className="relative block aspect-video w-full overflow-hidden bg-netflix-elevated" aria-label={`Open ${title}`}>
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            onLoad={() => setImgLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#555]">
            {item.media_type === 'movie' ? <FilmIcon className="h-10 w-10" /> : <TvIcon className="h-10 w-10" />}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-netflix-card via-netflix-card/10 to-transparent" />
        <p className="absolute bottom-2 left-3 right-3 text-left text-lg font-bold leading-tight text-shadow-netflix line-clamp-2">{title}</p>
      </button>

      <div className="space-y-2.5 px-3.5 pb-4 pt-2.5">
        <div className="flex items-center gap-2">
          <CircleButton primary onClick={open} label={`Play ${title}`}>
            <PlayIcon className="ml-0.5 h-4 w-4" />
          </CircleButton>
          {onRemove ? (
            <CircleButton
              onClick={() => {
                onRemove(item);
                onClose();
              }}
              label={`Remove ${title} from My List`}
            >
              <TrashIcon className="h-4 w-4" />
            </CircleButton>
          ) : (
            <CircleButton
              onClick={() => toggleMyListItem(item)}
              label={inList ? `Remove ${title} from My List` : `Add ${title} to My List`}
              pressed={inList}
            >
              {inList ? <CheckStaticIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            </CircleButton>
          )}
          <CircleButton onClick={open} label="More info" className="ml-auto">
            <ChevronDownIcon className="h-5 w-5" />
          </CircleButton>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          {match !== null && <span className="font-bold text-netflix-green">{match}% Match</span>}
          <span className="border border-white/40 px-1.5 text-[11px] leading-[18px] text-netflix-text">
            {item.media_type === 'movie' ? 'Movie' : 'Series'}
          </span>
          {year && <span className="text-netflix-text">{year}</span>}
          <span className="rounded-[3px] border border-white/40 px-1 text-[10px] font-bold leading-[16px] text-netflix-text">HD</span>
        </div>

        {genres.length > 0 && (
          <p className="flex flex-wrap items-center text-[13px] text-white">
            {genres.map((genre, i) => (
              <React.Fragment key={genre}>
                {i > 0 && <span className="mx-1.5 text-[#646464]">•</span>}
                {genre}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </div>
  );
};
