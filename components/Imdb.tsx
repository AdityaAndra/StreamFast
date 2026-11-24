import React from 'react';
import type { SearchResult } from '../types';
import { useImdb } from '../utils/artwork';

const formatVotes = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

interface ImdbRatingProps {
  item: Pick<SearchResult, 'id' | 'media_type'>;
  size?: 'sm' | 'md' | 'lg';
  /** Show "(1.2M)" vote count next to the score. */
  showVotes?: boolean;
  className?: string;
}

/** IMDb rating badge — yellow IMDb mark + score. Renders nothing while loading or when IMDb has no rating. */
export const ImdbRating: React.FC<ImdbRatingProps> = ({ item, size = 'md', showVotes, className = '' }) => {
  const imdb = useImdb(item);
  if (!imdb) return null;
  const label = `IMDb rating ${imdb.rating.toFixed(1)} out of 10${imdb.votes ? `, ${imdb.votes.toLocaleString()} votes` : ''}`;
  return (
    <span className={`nf-imdb nf-imdb-${size} ${className}`} title={label} aria-label={label}>
      <span className="nf-imdb-logo" aria-hidden="true">IMDb</span>
      <span className="nf-imdb-score" aria-hidden="true">
        {imdb.rating.toFixed(1)}
        {size !== 'sm' && <span className="nf-imdb-out">/10</span>}
      </span>
      {showVotes && imdb.votes ? <span className="nf-imdb-votes" aria-hidden="true">({formatVotes(imdb.votes)})</span> : null}
    </span>
  );
};

/** True once the IMDb rating for this title is known to exist (used to place separators). */
export const useHasImdb = (item: Pick<SearchResult, 'id' | 'media_type'>) => !!useImdb(item);

export default ImdbRating;
