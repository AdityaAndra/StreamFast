import React, { useMemo, useState } from 'react';
import type { WatchProgressItem } from '../types';
import ContinueWatchingCard from './ContinueWatchingCard';
import { RowShell } from './ContentCarousel';
import { useAppContext } from '../contexts/AppContext';
import { usePlayer } from '../contexts/PlayerContext';

const FILTERS: { id: 'all' | 'movie' | 'tv'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'TV' },
];

const ContinueWatchingGrid: React.FC<{ onSelect?: (item: WatchProgressItem) => void }> = ({ onSelect }) => {
  const { continueWatchingList: items } = useAppContext();
  const { openPlayer } = usePlayer();
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [sort, setSort] = useState<'recent' | 'az'>('recent');

  const displayedItems = useMemo(() => {
    const filtered = filter === 'all' ? items : items.filter((item) => item.media.media_type === filter);
    if (sort !== 'az') return filtered;
    return [...filtered].sort((a, b) => {
      const ta = a.media.media_type === 'movie' ? a.media.title : a.media.name;
      const tb = b.media.media_type === 'movie' ? b.media.title : b.media.name;
      return ta.localeCompare(tb);
    });
  }, [items, filter, sort]);

  if (items.length === 0) return null;

  const resume = (cw: WatchProgressItem) => (onSelect ? onSelect(cw) : openPlayer(cw.media, { progress: cw.progress, tab: 'watch' }));

  const actions = (
    <div className="flex items-center gap-1.5">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setFilter(f.id)}
          aria-pressed={filter === f.id}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-150 ${
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
        className="ml-1 cursor-pointer rounded-full border border-white/30 bg-transparent px-2 py-0.5 text-xs text-netflix-muted hover:border-white hover:text-white"
      >
        <option value="recent" className="bg-netflix-card">Recent</option>
        <option value="az" className="bg-netflix-card">A–Z</option>
      </select>
    </div>
  );

  return (
    <RowShell title="Continue Watching" itemCount={displayedItems.length} actions={actions}>
      {displayedItems.length > 0 ? (
        displayedItems.map((item) => (
          <div key={`${item.media.media_type}-${item.media.id}`} className="nf-item">
            <ContinueWatchingCard item={item} onSelect={resume} />
          </div>
        ))
      ) : (
        <p className="px-1 py-8 text-sm text-netflix-muted">Nothing here for this filter.</p>
      )}
    </RowShell>
  );
};

export default ContinueWatchingGrid;
