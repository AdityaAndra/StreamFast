import React, { ReactNode, useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import SkeletonCarousel from './SkeletonCarousel';
import Top10Row from './Top10Row';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { CAN_HOVER, prefetchLogos, setTop10, usePerRow } from '../utils/artwork';
import { peekCache, useCachedData } from '../utils/useCachedData';
import type { RowDef } from '../utils/rows';
import { Link } from '../utils/router';

interface RowShellProps {
  title: ReactNode;
  itemCount: number;
  /** Override cards per page (Top 10 shows fewer, bigger items). */
  perRow?: number;
  actions?: ReactNode;
  /** "View all" link (Netflix "Explore All"). */
  viewAll?: string;
  children: ReactNode;
}

/**
 * Netflix row: on mouse devices it pages with a GPU translate (0.75s Netflix easing) and
 * edge arrows; on touch devices it falls back to native momentum swiping.
 */
export const RowShell: React.FC<RowShellProps> = ({ title, itemCount, perRow: perRowOverride, actions, viewAll, children }) => {
  const basePerRow = usePerRow();
  const perRow = perRowOverride ?? basePerRow;
  const pages = Math.max(1, Math.ceil(itemCount / perRow));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage((p) => Math.min(p, pages - 1));
  }, [pages]);

  const shiftItems = Math.min(page * perRow, Math.max(0, itemCount - perRow));
  const offset = -(shiftItems / perRow) * 100;
  const go = (dir: -1 | 1) => setPage((p) => Math.min(Math.max(p + dir, 0), pages - 1));

  // Keyboard: when Tab reaches a card on a page you can't see, slide the row to that page.
  const onTrackFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!CAN_HOVER) return;
    const items = Array.from(e.currentTarget.children);
    const index = items.findIndex((el) => el.contains(e.target as Node));
    if (index < 0) return;
    const target = Math.min(Math.floor(index / perRow), pages - 1);
    if (target !== page) setPage(target);
    // The browser may have scrolled the clipped row to show the card; undo that, the translate handles it.
    const slider = e.currentTarget.parentElement;
    if (slider) slider.scrollLeft = 0;
  };

  return (
    <section className="nf-row" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="nf-row-header">
        <h2 className="nf-row-title">
          {viewAll ? (
            <Link to={viewAll} className="nf-row-link">
              {title}
              <span className="nf-viewall">
                <span className="nf-viewall-text">View all</span>
                <ChevronRightIcon />
              </span>
            </Link>
          ) : (
            title
          )}
        </h2>
        <div className="flex items-center gap-3">
          {actions}
          {CAN_HOVER && pages > 1 && (
            <div className="nf-pager" aria-hidden="true">
              {Array.from({ length: pages }).map((_, i) => (
                <span key={i} className={i === page ? 'on' : ''} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={`nf-slider ${CAN_HOVER ? '' : 'is-touch'}`}>
        {CAN_HOVER && page > 0 && (
          <button type="button" className="nf-arrow left" onClick={() => go(-1)} aria-label="Previous titles">
            <ChevronLeftIcon />
          </button>
        )}
        <div
          className="nf-track"
          onFocus={onTrackFocus}
          style={{
            ['--per-row' as any]: CAN_HOVER ? perRow : perRow + 0.3,
            transform: CAN_HOVER ? `translate3d(${offset}%, 0, 0)` : undefined,
          }}
        >
          {children}
        </div>
        {CAN_HOVER && page < pages - 1 && (
          <button type="button" className="nf-arrow right" onClick={() => go(1)} aria-label="More titles">
            <ChevronRightIcon />
          </button>
        )}
      </div>
    </section>
  );
};

interface ContentCarouselProps {
  title: string;
  items: SearchResult[];
  onRemoveItem?: (item: SearchResult) => void;
  viewAll?: string;
}

const ContentCarousel: React.FC<ContentCarouselProps> = ({ title, items, onRemoveItem, viewAll }) => {
  useEffect(() => {
    if (items?.length) prefetchLogos(items);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <RowShell title={title} itemCount={items.length} viewAll={viewAll}>
      {items.map((item) => (
        <div key={`${item.media_type}-${item.id}`} className="nf-item">
          <ResultCard item={item} onRemove={onRemoveItem} />
        </div>
      ))}
    </RowShell>
  );
};

/** Loads a row only when it is about to scroll into view (keeps 20+ rows fast). */
export const LazyRow: React.FC<{ def: RowDef; eager?: boolean }> = ({ def, eager }) => {
  const ref = useRef<HTMLDivElement>(null);
  const key = `row:${def.id}`;
  const [visible, setVisible] = useState(() => !!eager || peekCache(key) !== undefined);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '700px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const { data, error } = useCachedData<SearchResult[]>(visible && def.load ? key : null, def.load || (async () => []));

  useEffect(() => {
    if (data && def.kind === 'top10') setTop10(data);
  }, [data, def.kind]);

  if (error) return null;
  if (!data) {
    return (
      <div ref={ref}>
        <SkeletonCarousel variant={def.kind === 'top10' ? 'top10' : 'landscape'} />
      </div>
    );
  }
  if (!data.length) return null;
  return def.kind === 'top10' ? <Top10Row title={def.title} items={data} /> : <ContentCarousel title={def.title} items={data} viewAll={def.viewAll} />;
};

export default ContentCarousel;
