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
 * Trackpads: a two-finger sideways swipe drags the row 1:1 (with the trackpad's own momentum),
 * rubber-bands at the ends and then settles on the nearest card.
 */
const SWIPE_SETTLE_MS = 140;
const EDGE_GIVE = 0.4; // how far (in cards) the row may stretch past either end while swiping
// After a swipe the row glides onto the nearest card from wherever it is (ease-out, no slow start).
const SNAP_TRANSITION = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)';
const SNAP_MS = 520;

/** Page dot for a row moved left by `s` cards: the page most of the visible cards belong to. */
const pageOf = (s: number, per: number, max: number, pages: number) =>
  max > 0 && s >= max - 0.01 ? pages - 1 : Math.min(pages - 1, Math.max(0, Math.round(s / per)));

export const RowShell: React.FC<RowShellProps> = ({ title, itemCount, perRow: perRowOverride, actions, viewAll, children }) => {
  const basePerRow = usePerRow();
  const perRow = perRowOverride ?? basePerRow;
  const pages = Math.max(1, Math.ceil(itemCount / perRow));
  const maxShift = Math.max(0, itemCount - perRow);
  // How many cards the row is moved left by (whole numbers once settled).
  const [shift, setShift] = useState(0);

  useEffect(() => {
    setShift((s) => Math.min(s, maxShift));
  }, [maxShift]);

  const atEnd = shift >= maxShift - 0.01;
  const page = pageOf(shift, perRow, maxShift, pages);
  const offset = -(shift / perRow) * 100;

  const go = (dir: -1 | 1) =>
    setShift((s) => {
      const target = dir > 0 ? (Math.floor(s / perRow + 1e-6) + 1) * perRow : (Math.ceil(s / perRow - 1e-6) - 1) * perRow;
      return Math.min(Math.max(target, 0), maxShift);
    });

  // ---- Two-finger trackpad swipe ----
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const live = useRef({ shift: 0, swiping: false, timer: 0, snapTimer: 0 });
  live.current.shift = live.current.swiping ? live.current.shift : shift;
  const limits = useRef({ perRow, maxShift, pages });
  limits.current = { perRow, maxShift, pages };

  useEffect(() => {
    const slider = sliderRef.current;
    const track = trackRef.current;
    if (!CAN_HOVER || !slider || !track) return;
    const state = live.current;

    const paint = (s: number) => {
      const { perRow: per, maxShift: max, pages: count } = limits.current;
      track.style.transform = `translate3d(${-(s / per) * 100}%, 0, 0)`;
      // Page dots follow the row live while it is being swiped (React catches up when it settles).
      const pager = pagerRef.current;
      if (pager) {
        const on = pageOf(s, per, max, count);
        Array.from(pager.children).forEach((dot, i) => dot.classList.toggle('on', i === on));
      }
    };

    const settle = () => {
      state.timer = 0;
      const { maxShift: max } = limits.current;
      const snapped = Math.min(Math.max(Math.round(state.shift), 0), max);
      state.swiping = false;
      track.style.transition = SNAP_TRANSITION;
      state.shift = snapped;
      paint(snapped);
      setShift(snapped);
      // Then hand back to the normal paging easing for the arrows.
      if (state.snapTimer) window.clearTimeout(state.snapTimer);
      state.snapTimer = window.setTimeout(() => {
        state.snapTimer = 0;
        if (!state.swiping) track.style.transition = '';
      }, SNAP_MS);
    };

    const onWheel = (e: WheelEvent) => {
      // Only sideways gestures; vertical scrolling (and pinch-zoom) carry on as normal.
      if (e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const { perRow: per, maxShift: max } = limits.current;
      if (max <= 0) return; // everything already fits
      e.preventDefault(); // also stops the browser's back/forward swipe while over a row
      e.stopPropagation();

      const px = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * track.clientWidth : e.deltaX;
      const cardPx = track.clientWidth / per || 1;
      if (!state.swiping) {
        state.swiping = true;
        if (state.snapTimer) window.clearTimeout(state.snapTimer);
        state.snapTimer = 0;
        // Pick the row up exactly where it is on screen, even mid-glide.
        const moving = getComputedStyle(track).transform;
        if (moving && moving !== 'none') {
          const m = new DOMMatrixReadOnly(moving);
          const w = track.clientWidth || 1;
          state.shift = (-m.m41 / w) * per;
        }
        track.style.transition = 'none';
      }
      let next = state.shift + px / cardPx;
      // Rubber-band past the ends: movement gets heavier the further you pull.
      if (next < 0) next = Math.max(-EDGE_GIVE, state.shift < 0 ? state.shift + (px / cardPx) * 0.3 : next * 0.3);
      else if (next > max) next = Math.min(max + EDGE_GIVE, state.shift > max ? state.shift + (px / cardPx) * 0.3 : max + (next - max) * 0.3);
      state.shift = next;
      paint(next);

      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(settle, SWIPE_SETTLE_MS);
    };

    slider.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      slider.removeEventListener('wheel', onWheel);
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = 0;
      if (state.snapTimer) window.clearTimeout(state.snapTimer);
      state.snapTimer = 0;
      state.swiping = false;
      track.style.transition = '';
    };
  }, []);

  // Keyboard: when Tab reaches a card on a page you can't see, slide the row to that page.
  const onTrackFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!CAN_HOVER) return;
    const items = Array.from(e.currentTarget.children);
    const index = items.findIndex((el) => el.contains(e.target as Node));
    if (index < 0) return;
    if (index < shift || index >= shift + perRow) {
      const target = Math.min(Math.floor(index / perRow) * perRow, maxShift);
      setShift(target);
    }
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
            <div ref={pagerRef} className="nf-pager" aria-hidden="true">
              {Array.from({ length: pages }).map((_, i) => (
                <span key={i} className={i === page ? 'on' : ''} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div ref={sliderRef} className={`nf-slider ${CAN_HOVER ? '' : 'is-touch'}`}>
        {CAN_HOVER && shift > 0.01 && (
          <button type="button" className="nf-arrow left" onClick={() => go(-1)} aria-label="Previous titles">
            <ChevronLeftIcon />
          </button>
        )}
        <div
          ref={trackRef}
          className="nf-track"
          onFocus={onTrackFocus}
          style={{
            ['--per-row' as any]: CAN_HOVER ? perRow : perRow + 0.3,
            transform: CAN_HOVER ? `translate3d(${offset}%, 0, 0)` : undefined,
          }}
        >
          {children}
        </div>
        {CAN_HOVER && !atEnd && (
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

const ContentCarouselBase: React.FC<ContentCarouselProps> = ({ title, items, onRemoveItem, viewAll }) => {
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

/** Rows skip re-rendering when their props haven't changed (e.g. when an unrelated part of the page updates). */
const ContentCarousel = React.memo(ContentCarouselBase);

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
