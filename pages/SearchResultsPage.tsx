import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import ResultsGrid from '../components/ResultsGrid';
import SkeletonGrid from '../components/SkeletonGrid';
import ErrorState from '../components/ErrorState';
import { searchMulti } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { getTitle } from '../utils/media';
import { saveRecentSearch } from '../utils/recentSearches';

type Filter = 'all' | 'movie' | 'tv';

const useDebounced = <T,>(value: T, ms: number) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
};

const SearchResultsPage: React.FC<{ query: string }> = ({ query }) => {
  const q = useDebounced(query.trim(), 250);
  const [filter, setFilter] = useState<Filter>('all');
  const { data, error, loading, reload } = useCachedData<SearchResult[]>(q ? `search:${q.toLowerCase()}` : null, () => searchMulti(q));
  const [last, setLast] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (data) setLast(data);
  }, [data]);
  useEffect(() => setFilter('all'), [q]);

  const results = data || last;
  const counts = useMemo(
    () => ({ all: results.length, movie: results.filter((r) => r.media_type === 'movie').length, tv: results.filter((r) => r.media_type === 'tv').length }),
    [results]
  );
  const filtered = useMemo(() => (filter === 'all' ? results : results.filter((r) => r.media_type === filter)), [results, filter]);
  const related = useMemo(() => results.slice(0, 6).map(getTitle), [results]);
  const stale = loading || q !== query.trim();

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
  ];

  return (
    <div className="px-[4%] pt-24 sm:pt-32" onClickCapture={() => q && saveRecentSearch(q)}>
      {related.length > 0 && !error && (
        <p className="mb-[1.5vw] flex flex-wrap items-center gap-x-1 text-[max(14px,1.05vw)] text-[#808080]">
          <span className="mr-1">Explore titles related to:</span>
          {related.map((t, i) => (
            <React.Fragment key={`${t}-${i}`}>
              {i > 0 && <span className="text-[#4d4d4d]">|</span>}
              <span className="px-1 text-netflix-text">{t}</span>
            </React.Fragment>
          ))}
        </p>
      )}

      <div className="mb-[2vw] flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            aria-pressed={filter === tab.id}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 ${
              filter === tab.id ? 'border-white bg-white text-black' : 'border-white/30 text-netflix-text hover:border-white'
            }`}
          >
            {tab.label}
            {results.length > 0 && <span className={`ml-1.5 text-xs ${filter === tab.id ? 'text-black/60' : 'text-[#808080]'}`}>{counts[tab.id]}</span>}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Search failed" message={error} onRetry={reload} />
      ) : results.length === 0 && stale ? (
        <SkeletonGrid />
      ) : filtered.length > 0 ? (
        <div className={`transition-opacity duration-200 ${stale ? 'opacity-60' : 'opacity-100'}`}>
          <ResultsGrid results={filtered} />
        </div>
      ) : (
        <div className="py-16 text-center animate-fade-in">
          <p className="mb-2 text-lg text-white">Your search for "{query.trim()}" did not have any matches.</p>
          <p className="text-netflix-muted">Suggestions:</p>
          <ul className="mt-1 inline-block list-disc pl-5 text-left text-netflix-muted">
            <li>Try different keywords</li>
            <li>Looking for a movie or TV show?</li>
            <li>Try using a movie or TV show title</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
