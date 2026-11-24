import React, { useRef, useState } from 'react';
import type { SearchResult } from '../types';
import { getTitle, getYear, tmdbImage } from '../utils/media';
import { useHoverPreview } from './HoverPreview';
import { FilmIcon, TvIcon, TrashIcon } from './Icons';

interface ResultCardProps {
  item: SearchResult;
  onSelect: (item: SearchResult) => void;
  onRemove?: (item: SearchResult) => void;
  /** landscape = Netflix row boxart (16:9), poster = tall 2:3 artwork (Top 10) */
  variant?: 'landscape' | 'poster';
}

const ResultCard: React.FC<ResultCardProps> = ({ item, onSelect, onRemove, variant = 'landscape' }) => {
  const { show, cancel } = useHoverPreview();
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const title = getTitle(item);
  const year = getYear(item);
  const isLandscape = variant === 'landscape';
  const src = isLandscape
    ? tmdbImage(item.backdrop_path, 'w780') || tmdbImage(item.poster_path, 'w500')
    : tmdbImage(item.poster_path, 'w342');
  const posterInLandscape = isLandscape && !item.backdrop_path && !!item.poster_path;

  const open = () => {
    cancel();
    onSelect(item);
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`${title}${year ? `, ${year}` : ''}`}
      onMouseEnter={() => ref.current && show({ item, el: ref.current, onSelect, onRemove })}
      onMouseLeave={cancel}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className={`group/card relative block w-full cursor-pointer overflow-hidden rounded-[4px] bg-netflix-card transition-transform duration-300 ease-netflix focus-visible:scale-105 ${
        isLandscape ? 'aspect-video' : 'aspect-[2/3]'
      }`}
    >
      {src && !failed ? (
        <>
          {!loaded && <div className="absolute inset-0 shimmer" />}
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${
              posterInLandscape ? 'object-[center_25%]' : ''
            }`}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#2b2b2b] to-[#151515] p-3 text-center">
          {item.media_type === 'movie' ? <FilmIcon className="h-7 w-7 text-[#555]" /> : <TvIcon className="h-7 w-7 text-[#555]" />}
          {!isLandscape && <p className="text-xs font-bold text-netflix-muted line-clamp-3">{title}</p>}
        </div>
      )}

      {isLandscape && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
          <p className="pointer-events-none absolute bottom-1.5 left-2 right-2 text-[13px] font-bold leading-tight text-white text-shadow-netflix line-clamp-2 sm:bottom-2 sm:left-2.5 sm:text-sm lg:text-base">
            {title}
          </p>
        </>
      )}

      {/* subtle hover lift */}
      <div className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-300 group-hover/card:bg-white/[0.05]" />

      {/* On touch screens there is no hover preview, so show remove directly */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            cancel();
            onRemove(item);
          }}
          className="absolute right-1.5 top-1.5 hidden h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white [@media(hover:none)]:flex"
          aria-label={`Remove ${title} from My List`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ResultCard;
