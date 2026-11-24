import React from 'react';
import { VIDFAST_MOVIE_URL, VIDFAST_TV_URL } from '../constants';
import type { WatchProgressItem } from '../types';
import { CloseIcon, PlayIcon, InfoIcon } from './Icons';
import { CardLogo } from './ResultCard';
import { Link } from '../utils/router';
import { titlePath } from '../utils/media';
import { useAppContext } from '../contexts/AppContext';
import { tmdbImage } from '../utils/media';

interface ContinueWatchingCardProps {
  item: WatchProgressItem;
  onSelect: (item: WatchProgressItem) => void;
}

const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ item, onSelect }) => {
  const { removeItem, playerTheme } = useAppContext();
  const { media, progress, cleanPosterPath } = item;
  const title = media.media_type === 'movie' ? media.title : media.name;
  const [loaded, setLoaded] = React.useState(false);

  const image =
    tmdbImage(media.backdrop_path, 'w780') || tmdbImage(cleanPosterPath || media.poster_path, 'w500');
  const usingPoster = !media.backdrop_path;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(media.id, media.media_type);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const themeParam = `&theme=${playerTheme.hex.replace('#', '')}`;
    let link = null;

    if (media.media_type === 'movie') {
      link = `${VIDFAST_MOVIE_URL}${media.id}?autoPlay=true${themeParam}`;
    } else if (media.media_type === 'tv' && progress.season && progress.episode) {
      link = `${VIDFAST_TV_URL}${media.id}/${progress.season}/${progress.episode}?autoPlay=true&nextButton=true&autoNext=true${themeParam}`;
    }

    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      onSelect(item);
    }
  };

  let progressText = '';
  if (media.media_type === 'tv' && progress.season && progress.episode) {
    progressText = `S${progress.season}:E${progress.episode}`;
  } else if (media.media_type === 'movie') {
    progressText = 'Movie';
  } else {
    progressText = 'Saved';
  }

  const percent =
    progress.watched && progress.duration ? Math.min(100, Math.max(3, (progress.watched / progress.duration) * 100)) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item);
        }
      }}
      aria-label={`${title}, ${progressText}`}
      className="group/cw relative cursor-pointer"
    >
      <div className={`relative aspect-video overflow-hidden bg-netflix-card ${percent !== null ? 'rounded-t-[4px]' : 'rounded-[4px]'}`}>
        {image ? (
          <>
            {!loaded && <div className="absolute inset-0 shimmer" />}
            <img
              src={image}
              alt=""
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                loaded ? 'opacity-100' : 'opacity-0'
              } ${usingPoster ? 'object-[center_25%]' : ''}`}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2b2b2b] to-[#151515]" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 group-hover/cw:bg-black/35" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        <CardLogo item={media} />
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">{progressText}</span>

        <button
          type="button"
          onClick={handlePlayClick}
          className="absolute inset-0 m-auto flex h-11 w-11 scale-90 items-center justify-center rounded-full border-2 border-white bg-black/50 text-white opacity-0 transition duration-300 ease-netflix hover:bg-black/75 group-hover/cw:scale-100 group-hover/cw:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 sm:h-14 sm:w-14 [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
          aria-label={`Resume ${title}`}
        >
          <PlayIcon className="ml-1 h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        <Link
          to={titlePath(media)}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-black/50 text-white opacity-0 transition-opacity duration-200 hover:border-white group-hover/cw:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={`More info about ${title}`}
          title="More info"
        >
          <InfoIcon className="h-4 w-4" />
        </Link>

        <button
          type="button"
          onClick={handleRemove}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 hover:bg-netflix-red group-hover/cw:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          aria-label={`Remove ${title} from Continue Watching`}
          title="Remove from row"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
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
