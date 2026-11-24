import React, { useMemo, useState } from 'react';
import type { WatchProgressItem } from '../types';
import ContinueWatchingCard from './ContinueWatchingCard';
import { RowShell, LANDSCAPE_ITEM_CLASS } from './ContentCarousel';
import { useAppContext } from '../contexts/AppContext';

interface ContinueWatchingGridProps {
  onSelect: (item: WatchProgressItem) => void;
}

const FILTERS: { id: 'all' | 'movie' | 'tv'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
];

const ContinueWatchingGrid: React.FC<ContinueWatchingGridProps> = ({ onSelect }) => {
  const { continueWatchingList: items } = useAppContext();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sort, setSort] = useState<'recent' | 'az'>('recent');

  const displayedItems = useMemo(() => {
    const filtered = filter === 'all' ? items : items.filter((item) => item.media.media_type === filter);
    if (sort !== 'az') return filtered; // the list is already most-recent first
    return [...filtered].sort((a, b) => {
      const titleA = a.media.media_type === 'movie' ? a.media.title : a.media.name;
      const titleB = b.media.media_type === 'movie' ? b.media.title : b.media.name;
      return titleA.localeCompare(titleB);
    });
  }, [items, filter, sort]);

  if (items.length === 0) return null;

  const actions = (
    <div className="flex items-center gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setFilter(f.id)}
          aria-pressed={filter === f.id}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200 ${
            filter === f.id ? 'border-white bg-white text-black' : 'border-white/30 text-netflix-muted hover:border-white hover:text-white'
          }`}
        >
          {f.label}
        </button>
      ))}
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as 'recent' | 'az')}
        aria-label="Sort Continue Watching"
        className="ml-1 cursor-pointer appearance-none rounded-full border border-white/30 bg-transparent py-0.5 pl-2.5 pr-6 text-xs text-netflix-muted transition-colors hover:border-white hover:text-white"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23b3b3b3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.4rem center',
          backgroundSize: '0.9em',
        }}
      >
        <option value="recent" className="bg-netflix-card">Recent</option>
        <option value="az" className="bg-netflix-card">A–Z</option>
      </select>
    </div>
  );

  return (
    <RowShell title="Continue Watching" itemCount={displayedItems.length} actions={actions}>
      {displayedItems.length > 0 ? (
        displayedItems.map((item, index) => (
          <div
            key={`${item.media.media_type}-${item.media.id}`}
            className={`${LANDSCAPE_ITEM_CLASS} row-item-in`}
            style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
          >
            <ContinueWatchingCard item={item} onSelect={onSelect} />
          </div>
        ))
      ) : (
        <p className="py-8 text-sm text-netflix-muted">Nothing here for this filter.</p>
      )}
    </RowShell>
  );
};

export default ContinueWatchingGrid;
