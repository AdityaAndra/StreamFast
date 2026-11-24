import React, { useRef, useState } from 'react';
import type { WatchProgressItem } from '../types';
import { CloseIcon, PlayIcon, InfoIcon } from './Icons';
import { CardLogo } from './ResultCard';
import { useHoverPreview } from './HoverPreview';
import { Link } from '../utils/router';
import { titlePath, tmdbImage } from '../utils/media';
import { CAN_HOVER } from '../utils/artwork';
import { useAppContext } from '../contexts/AppContext';

interface ContinueWatchingCardProps {
  item: WatchProgressItem;
  onSelect: (item: WatchProgressItem) => void;
}

/**
 * Continue Watching card. On mouse devices, hovering opens the Netflix-style preview
 * (resume, My List, remove from row, episode name, progress). Touch devices keep the
 * on-card play / info / remove buttons.
 */
const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ item, onSelect }) => {
  const { removeItem } = useAppContext();
  const { show, cancel } = useHoverPreview();
  const artRef = useRef<HTMLDivElement>(null);
  const { media, progress, cleanPosterPath } = item;
  const title = media.media_type === 'movie' ? media.title : media.name;
  const [loaded, setLoaded] = useState(false);

  const image = tmdbImage(media.backdrop_path, 'w780') || tmdbImage(cleanPosterPath || media.poster_path, 'w500');
  const usingPoster = !media.backdrop_path;
  const remove = () => removeItem(media.id, media.media_type);

  const progressText =
    media.media_type === 'tv' && progress.season && progress.episode ? `S${progress.season}:E${progress.episode}` : media.media_type === 'movie' ? 'Movie' : 'Saved';
  const percent = progress.watched && progress.duration ? Math.min(100, Math.max(3, (progress.watched / progress.duration) * 100)) : null;

  const open = () => {
    cancel();
    onSelect(item);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      onMouseEnter={() => artRef.current && show({ item: media, el: artRef.current, variant: 'landscape', cw: { progress, onRemove: remove } })}
      onMouseLeave={cancel}
      aria-label={`${title}, ${progressText}`}
      className="group/cw relative cursor-pointer"
    >
      <div ref={artRef} className={`nf-card !aspect-video ${percent !== null ? '!rounded-b-none' : ''}`}>
        {image ? (
          <img
            src={image}
            alt=""
            data-art=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${usingPoster ? 'object-[center_25%]' : ''}`}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2b2b2b] to-[#151515]" />
        )}
        <span className="nf-card-shade" />
        <CardLogo item={media} />
        <span className="nf-card-hover" />
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{progressText}</span>

        {!CAN_HOVER && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(item);
              }}
              className="absolute inset-0 m-auto flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white"
              aria-label={`Resume ${title}`}
            >
              <PlayIcon className="ml-1 h-5 w-5" />
            </button>
            <Link
              to={titlePath(media)}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-black/50 text-white"
              aria-label={`More info about ${title}`}
            >
              <InfoIcon className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove();
              }}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label={`Remove ${title} from Continue Watching`}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {percent !== null && (
        <div className="h-[3px] w-full overflow-hidden rounded-b-[4px] bg-[#4d4d4d]" aria-hidden="true">
          <div className="h-full bg-netflix-red" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
};

export default ContinueWatchingCard;
