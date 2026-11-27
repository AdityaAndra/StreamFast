import React, { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '../types';
import { getTitle, getYear, tmdbImage, titlePath, isRecent } from '../utils/media';
import { useLogo, useCardArt, isTop10 } from '../utils/artwork';
import { Link } from '../utils/router';
import { useHoverPreview } from './HoverPreview';
import { TrashIcon } from './Icons';
import { setTitleOrigin } from '../utils/motion';
import { prefetchTitle, schedulePrefetch } from '../utils/prefetch';
import { comingDate, useRelease } from '../utils/release';

interface ResultCardProps {
  item: SearchResult;
  onRemove?: (item: SearchResult) => void;
  /** landscape = Netflix boxart (backdrop + title logo), poster = tall key art (Top 10) */
  variant?: 'landscape' | 'poster';
  eager?: boolean;
}

const LANDSCAPE_SIZES = '(min-width: 1400px) 16vw, (min-width: 1100px) 19vw, (min-width: 800px) 23vw, (min-width: 500px) 31vw, 46vw';

/** Title logo (or bold text fallback) over textless artwork — what Netflix boxart looks like. */
export const CardLogo: React.FC<{ item: SearchResult; className?: string; textClassName?: string; size?: 'w300' | 'w500' }> = ({
  item,
  className = 'nf-card-logo',
  textClassName = 'nf-card-title',
  size = 'w300',
}) => {
  const logo = useLogo(item);
  const [loaded, setLoaded] = useState(false);
  if (logo === undefined) return null;
  if (logo === null) return <p className={textClassName}>{getTitle(item)}</p>;
  return (
    <img
      src={tmdbImage(logo.p, size) || ''}
      alt={getTitle(item)}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`${className} ${loaded ? 'is-loaded' : ''} ${logo.r && logo.r < 1.6 ? 'is-tall' : ''}`}
    />
  );
};

const ResultCard: React.FC<ResultCardProps> = ({ item, onRemove, variant = 'landscape', eager }) => {
  const { show, cancel } = useHoverPreview();
  const ref = useRef<HTMLAnchorElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [titledFailed, setTitledFailed] = useState(false);
  // Warm the title window's data + backdrop while the pointer rests on the card.
  const stopPrefetch = useRef<(() => void) | null>(null);
  const cancelPrefetch = () => {
    stopPrefetch.current?.();
    stopPrefetch.current = null;
  };
  useEffect(() => () => stopPrefetch.current?.(), []);

  const title = getTitle(item);
  const year = getYear(item);
  const isLandscape = variant === 'landscape';
  const release = useRelease(item);
  const soonText = release === 'soon' ? (comingDate(item) ? `Coming ${comingDate(item)}` : 'Coming soon') : '';
  const bottomBadge = !!soonText || isRecent(item);
  const hasBackdrop = !!item.backdrop_path;

  // Landscape cards use artwork that already has the title on it (one image, no logo popping in
  // later). Until we know which art a title has, hold the card for a moment so art + title arrive
  // together; after that, fall back to textless art + logo.
  const art = useCardArt(isLandscape ? item : null);
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!isLandscape || art !== undefined) return;
    const t = window.setTimeout(() => setWaited(true), 900);
    return () => window.clearTimeout(t);
  }, [isLandscape, art]);
  const titled = isLandscape && art?.titled && !titledFailed ? art.titled : null;
  const ready = !isLandscape || art !== undefined || waited;

  let src: string | null;
  let srcSet: string | undefined;
  if (titled) {
    src = tmdbImage(titled, 'w780');
    srcSet = `${tmdbImage(titled, 'w300')} 300w, ${tmdbImage(titled, 'w780')} 780w`;
  } else if (isLandscape) {
    src = hasBackdrop ? tmdbImage(item.backdrop_path, 'w780') : tmdbImage(item.poster_path, 'w500');
    srcSet = hasBackdrop ? `${tmdbImage(item.backdrop_path, 'w300')} 300w, ${tmdbImage(item.backdrop_path, 'w780')} 780w` : undefined;
  } else {
    src = tmdbImage(item.poster_path, 'w342');
    srcSet = item.poster_path ? `${tmdbImage(item.poster_path, 'w185')} 185w, ${tmdbImage(item.poster_path, 'w342')} 342w, ${tmdbImage(item.poster_path, 'w500')} 500w` : undefined;
  }

  const card = (
    <Link
      ref={ref}
      to={titlePath(item)}
      aria-label={`${title}${year ? ` (${year})` : ''}`}
      onMouseEnter={() => {
        if (ref.current) show({ item, el: ref.current, onRemove, variant });
        cancelPrefetch();
        stopPrefetch.current = schedulePrefetch(item);
      }}
      onMouseLeave={() => {
        cancel();
        cancelPrefetch();
      }}
      onFocus={() => prefetchTitle(item)}
      onClick={(e) => {
        cancel();
        setTitleOrigin(e.currentTarget);
      }}
      draggable={false}
      className={`nf-card group/card ${isLandscape ? '' : 'is-poster'} ${isLandscape && bottomBadge ? 'has-badge' : ''}`}
    >
      {src && (titled || !failed) && ready ? (
        <img
          key={src}
          data-titled={titled ? '' : undefined}
          src={src}
          srcSet={srcSet}
          sizes={isLandscape ? LANDSCAPE_SIZES : '(min-width: 1100px) 11vw, (min-width: 800px) 14vw, 26vw'}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => (titled ? setTitledFailed(true) : setFailed(true))}
          className={`nf-art ${loaded ? 'is-loaded' : ''} ${isLandscape && !hasBackdrop ? 'object-[center_20%]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2b2b2b] to-[#161616]" />
      )}

      {isLandscape && (
        <>
          {!titled && <div className="nf-card-shade" />}
          {!titled && ready && <CardLogo item={item} />}
          {isTop10(item) && (
            <span className="nf-top10-badge" aria-label="Top 10">
              <small>TOP</small>
              <b>10</b>
            </span>
          )}
        </>
      )}
      {!isLandscape && (failed || !src) && <p className="nf-card-title">{title}</p>}

      {soonText ? <span className="nf-soon-badge">{soonText}</span> : isRecent(item) && <span className="nf-recent-badge">Recently added</span>}
      {release === 'cam' && (
        <span className="nf-cam-badge">
          CAM<span className="sr-only"> (cinema recording, not out in HD yet)</span>
        </span>
      )}
      <span className="nf-card-hover" />

    </Link>
  );
  if (!onRemove) return card;

  // The Remove button sits beside the card link, not inside it (a button inside a link is invalid HTML
  // and confuses screen readers). Always shown on touch screens; on desktop it appears when focused.
  return (
    <div className="relative">
      {card}
      <button
        type="button"
        onClick={() => onRemove(item)}
        className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
        aria-label={`Remove ${title} from My List`}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

// Cards only re-render when their own props change (rows full of cards stay idle while others update).
export default React.memo(ResultCard);
