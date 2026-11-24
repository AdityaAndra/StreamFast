import React, { useMemo, useState, useEffect } from 'react';
import type { SearchResult } from '../types';
import ResultsGrid from '../components/ResultsGrid';
import SkeletonGrid from '../components/SkeletonGrid';
import ErrorState from '../components/ErrorState';
import { getTitle } from '../utils/media';

interface SearchResultsPageProps {
    query: string;
    results: SearchResult[];
    isLoading: boolean;
    error: string | null;
    onSelect: (item: SearchResult) => void;
    onRetry: () => void;
}

type Filter = 'all' | 'movie' | 'tv';

const SearchResultsPage: React.FC<SearchResultsPageProps> = ({ query, results, isLoading, error, onSelect, onRetry }) => {
    const [filter, setFilter] = useState<Filter>('all');

    useEffect(() => {
        setFilter('all');
    }, [query]);

    const counts = useMemo(
        () => ({
            all: results.length,
            movie: results.filter((r) => r.media_type === 'movie').length,
            tv: results.filter((r) => r.media_type === 'tv').length,
        }),
        [results]
    );

    const filtered = useMemo(() => (filter === 'all' ? results : results.filter((r) => r.media_type === filter)), [results, filter]);
    const related = useMemo(() => results.slice(0, 6).map(getTitle), [results]);

    const tabs: { id: Filter; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'movie', label: 'Movies' },
        { id: 'tv', label: 'TV Shows' },
    ];

    return (
        <div className="px-[4%] pt-24 sm:pt-32">
            {/* Netflix-style "Explore titles related to:" line */}
            {related.length > 0 && !error && (
                <p className="mb-5 flex flex-wrap items-center gap-x-1 text-sm text-[#808080] sm:text-base">
                    <span className="mr-1">Explore titles related to:</span>
                    {related.map((t, i) => (
                        <React.Fragment key={`${t}-${i}`}>
                            {i > 0 && <span className="text-[#4d4d4d]">|</span>}
                            <span className="px-1 text-netflix-text">{t}</span>
                        </React.Fragment>
                    ))}
                </p>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        aria-pressed={filter === tab.id}
                        disabled={isLoading && results.length === 0}
                        className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-200 disabled:opacity-50 ${
                            filter === tab.id ? 'border-white bg-white text-black' : 'border-white/30 text-netflix-text hover:border-white'
                        }`}
                    >
                        {tab.label}
                        {!isLoading && <span className={`ml-1.5 text-xs ${filter === tab.id ? 'text-black/60' : 'text-[#808080]'}`}>{counts[tab.id]}</span>}
                    </button>
                ))}
            </div>

            {isLoading && results.length === 0 ? (
                <SkeletonGrid />
            ) : error ? (
                <ErrorState title="Search failed" message={error} onRetry={onRetry} />
            ) : filtered.length > 0 ? (
                <div className={`transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
                    <ResultsGrid results={filtered} onSelect={onSelect} />
                </div>
            ) : (
                <div className="py-16 text-center animate-fade-in">
                    <p className="mb-2 text-lg text-white">
                        Your search for "{query}" did not have any {filter === 'movie' ? 'movie ' : filter === 'tv' ? 'TV show ' : ''}matches.
                    </p>
                    <p className="text-netflix-muted">Suggestions:</p>
                    <ul className="mt-1 inline-block list-disc pl-5 text-left text-netflix-muted">
                        <li>Try different keywords</li>
                        <li>Check the spelling</li>
                        <li>Try a movie or TV show title</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchResultsPage;
