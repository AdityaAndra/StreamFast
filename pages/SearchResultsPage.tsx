import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import ResultsGrid from '../components/ResultsGrid';
import SkeletonGrid from '../components/SkeletonGrid';
import ErrorState from '../components/ErrorState';
import { searchMulti } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { Link } from '../utils/router';
import { rankSearch, fetchSearchRelated, personExplore, SearchRelated, ExploreLink } from '../utils/searchRelated';
import { saveRecentSearch } from '../utils/recentSearches';
import { searchPeople, PersonSummary, deptLabel } from '../utils/person';
import PeopleRow, { PeopleGrid, PersonTileData } from '../components/PeopleRow';

type Filter = 'all' | 'movie' | 'tv' | 'person';

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
  const peopleRes = useCachedData<PersonSummary[]>(q ? `people:${q.toLowerCase()}` : null, () => searchPeople(q));
  const people: PersonTileData[] = useMemo(
    () =>
      (peopleRes.data || []).slice(0, 40).map((p) => ({
        id: p.id,
        name: p.name,
        profile_path: p.profile_path,
        sub: [p.known_for_department ? deptLabel(p.known_for_department) : '', (p.known_for || [])[0]?.title || (p.known_for || [])[0]?.name || ''].filter(Boolean).join(' · '),
      })),
    [peopleRes.data]
  );

  useEffect(() => {
    if (data) setLast(data);
  }, [data]);
  useEffect(() => setFilter('all'), [q]);

  const raw = data || last;
  // Best matches first, then titles related to the top match, then obscure matches.
  const ranked = useMemo(() => rankSearch(raw, q), [raw, q]);
  const top = ranked.strong[0];
  const topPerson = peopleRes.data?.[0];
  // A person search ("hans zimmer") explores the person instead of a weak title match.
  const personFirst = !!topPerson && (!top || (topPerson.popularity || 0) > (top.popularity || 0) * 2);
  const rel = useCachedData<SearchRelated>(top && !personFirst ? `searchrel:${top.media_type}:${top.id}` : null, () => fetchSearchRelated(top!));
  const results = useMemo(() => {
    const seen = new Set<string>();
    const out: SearchResult[] = [];
    const push = (list: SearchResult[]) =>
      list.forEach((r) => {
        const k = `${r.media_type}:${r.id}`;
        if (!seen.has(k)) {
          seen.add(k);
          out.push(r);
        }
      });
    push(ranked.strong);
    if (!personFirst && rel.data) push(rel.data.titles);
    push(ranked.weak);
    return out;
  }, [ranked, rel.data, personFirst]);
  const explore: ExploreLink[] = useMemo(
    () => (personFirst && topPerson ? personExplore(topPerson) : rel.data?.explore || []),
    [personFirst, topPerson, rel.data]
  );
  const counts = useMemo(
    () => ({ all: results.length, movie: results.filter((r) => r.media_type === 'movie').length, tv: results.filter((r) => r.media_type === 'tv').length, person: people.length }),
    [results, people]
  );
  const filtered = useMemo(() => (filter === 'all' ? results : results.filter((r) => r.media_type === filter)), [results, filter]);
  const stale = loading || q !== query.trim();

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'person', label: 'People' },
  ];

  return (
    <div className="px-[4%] pt-24 sm:pt-32" onClickCapture={() => q && saveRecentSearch(q)}>
      {explore.length > 0 && !error && (
        <p className="mb-[1.5vw] flex flex-wrap items-center gap-x-1 gap-y-1 text-[max(14px,1.05vw)] text-[#808080]">
          <span className="mr-1">Explore titles related to:</span>
          {explore.map((t, i) => (
            <React.Fragment key={`${t.to}-${i}`}>
              {i > 0 && <span className="text-[#4d4d4d]">|</span>}
              <Link to={t.to} className="px-1 text-netflix-text transition-colors hover:text-white hover:underline">
                {t.label}
              </Link>
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

      {filter === 'person' ? (
        people.length ? <PeopleGrid people={people} /> : <p className="py-16 text-center text-netflix-muted">No people match "{query.trim()}".</p>
      ) : (
        <>
          {filter === 'all' && people.length > 0 && (
            <div className="-mx-[4.17%] mb-[2vw]">
              <PeopleRow title="People" people={people.slice(0, 20)} />
            </div>
          )}
          {error ? (
            <ErrorState title="Search failed" message={error} onRetry={reload} />
          ) : results.length === 0 && stale ? (
            <SkeletonGrid />
          ) : filtered.length > 0 ? (
            <div className={`transition-opacity duration-200 ${stale ? 'opacity-60' : 'opacity-100'}`}>
              <ResultsGrid results={filtered} />
            </div>
          ) : people.length > 0 ? null : (
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
        </>
      )}
    </div>
  );
};

export default SearchResultsPage;
