import React, { useCallback, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';

/** Widths for one item in a Netflix-style row (percent of the row's visible width). */
export const LANDSCAPE_ITEM_CLASS = 'flex-shrink-0 snap-start w-[44%] sm:w-[31%] md:w-[23.8%] lg:w-[19%] xl:w-[15.8%]';
export const POSTER_ITEM_CLASS = 'flex-shrink-0 snap-start w-[30%] sm:w-[22%] md:w-[17.5%] lg:w-[13.8%] xl:w-[11.6%]';

const useRowScroll = (itemCount: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ canLeft: false, canRight: false, page: 0, pages: 1 });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pages = max <= 4 ? 1 : Math.max(1, Math.ceil(el.scrollWidth / el.clientWidth - 0.05));
    const page = max <= 4 ? 0 : Math.round((el.scrollLeft / max) * (pages - 1));
    const next = { canLeft: el.scrollLeft > 4, canRight: el.scrollLeft < max - 4, page, pages };
    setState((prev) =>
      prev.canLeft === next.canLeft && prev.canRight === next.canRight && prev.page === next.page && prev.pages === next.pages ? prev : next
    );
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    const t = window.setTimeout(update, 300);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
      window.clearTimeout(t);
    };
  }, [update, itemCount]);

  const scrollByPage = (direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.92, behavior: 'smooth' });
  };

  return { ref, ...state, scrollByPage };
};

const RowArrow: React.FC<{ side: 'left' | 'right'; visible: boolean; onClick: () => void }> = ({ side, visible, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    tabIndex={visible ? 0 : -1}
    aria-hidden={!visible}
    aria-label={side === 'left' ? 'Previous titles' : 'More titles'}
    className={`group/arrow absolute inset-y-0 z-20 hidden w-[4%] items-center justify-center bg-black/50 text-white transition-opacity duration-300 hover:bg-black/70 sm:flex ${
      side === 'left' ? 'left-0 rounded-r-[4px]' : 'right-0 rounded-l-[4px]'
    } ${visible ? 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100' : 'pointer-events-none opacity-0'}`}
  >
    {side === 'left' ? (
      <ChevronLeftIcon className="h-7 w-7 transition-transform duration-200 group-hover/arrow:scale-125 lg:h-9 lg:w-9" />
    ) : (
      <ChevronRightIcon className="h-7 w-7 transition-transform duration-200 group-hover/arrow:scale-125 lg:h-9 lg:w-9" />
    )}
  </button>
);

interface RowShellProps {
  title: ReactNode;
  itemCount: number;
  actions?: ReactNode;
  gapClass?: string;
  children: ReactNode;
}

/** Shared Netflix row chrome: title, page indicator, edge arrows and the scroller. */
export const RowShell: React.FC<RowShellProps> = ({ title, itemCount, actions, gapClass = 'gap-1.5 sm:gap-2', children }) => {
  const { ref, canLeft, canRight, page, pages, scrollByPage } = useRowScroll(itemCount);

  return (
    <section className="group/row relative" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-[4%] sm:mb-2">
        <h2 className="text-base font-bold leading-tight text-netflix-text sm:text-lg lg:text-[1.45rem]">{title}</h2>
        <div className="flex items-center gap-3">
          {actions}
          {pages > 1 && (
            <div className="hidden items-center gap-[3px] opacity-0 transition-opacity duration-300 group-hover/row:opacity-100 md:flex" aria-hidden="true">
              {Array.from({ length: pages }).map((_, i) => (
                <span key={i} className={`h-[2px] w-3 transition-colors ${i === page ? 'bg-[#aaa]' : 'bg-[#4d4d4d]'}`} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <RowArrow side="left" visible={canLeft} onClick={() => scrollByPage(-1)} />
        <div
          ref={ref}
          className={`flex ${gapClass} snap-x snap-mandatory scroll-px-[4%] overflow-x-auto overflow-y-hidden scroll-smooth px-[4%] py-1 scrollbar-hide md:snap-none`}
        >
          {children}
        </div>
        <RowArrow side="right" visible={canRight} onClick={() => scrollByPage(1)} />
      </div>
    </section>
  );
};

interface ContentCarouselProps {
  title: string;
  items: SearchResult[];
  onSelect: (item: SearchResult) => void;
  onRemoveItem?: (item: SearchResult) => void;
  variant?: 'landscape' | 'poster';
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ title, items, onSelect, onRemoveItem, variant = 'landscape' }) => {
  // No hooks here, so returning early is safe (the scroll hooks live in RowShell).
  if (!items || items.length === 0) return null;

  return (
    <RowShell title={title} itemCount={items.length}>
      {items.map((item, index) => (
        <div
          key={`${item.media_type}-${item.id}`}
          className={`${variant === 'poster' ? POSTER_ITEM_CLASS : LANDSCAPE_ITEM_CLASS} row-item-in`}
          style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
        >
          <ResultCard item={item} onSelect={onSelect} onRemove={onRemoveItem} variant={variant} />
        </div>
      ))}
    </RowShell>
  );
};

export default ContentCarousel;
