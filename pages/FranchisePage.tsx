import React, { useEffect, useMemo, useState } from 'react';
import type { SearchResult } from '../types';
import { getCollection, CollectionDetails } from '../services/tmdb';
import { useCachedData } from '../utils/useCachedData';
import { getTitle, tmdbImage } from '../utils/media';
import { MOVIE_GENRES } from '../utils/browse';
import { goBack } from '../utils/router';
import ResultsGrid from '../components/ResultsGrid';
import SkeletonGrid from '../components/SkeletonGrid';
import ErrorState from '../components/ErrorState';
import { ChevronLeftIcon, SearchIcon } from '../components/Icons';

type FSort = 'order' | 'newest' | 'oldest' | 'rating' | 'popular' | 'az';
const SORTS: [FSort, string][] = [
  ['order', 'Release order'],
  ['newest', 'Newest first'],
  ['oldest', 'Oldest first'],
  ['rating', 'Highest rated'],
  ['popular', 'Most popular'],
  ['az', 'Title A–Z'],
];

const dateOf = (m: any) => m.release_date || '';

/** /franchise/:id — every movie in a franchise (TMDB collection) with sort, genre and search. */
const FranchisePage: React.FC<{ id: number }> = ({ id }) => {
  const { data, error, reload } = useCachedData<CollectionDetails>(`collection:${id}`, () => getCollection(id));
  const [sort, setSort] = useState<FSort>('order');
  const [genre, setGenre] = useState('');
  const [q, setQ] = useState('');
  const [heroLoaded, setHeroLoaded] = useState(false);

  const name = data ? data.name.replace(/\s*Collection$/i, '') : '';
  useEffect(() => {
    if (name) document.title = `${name} — StreamFast`;
  }, [name]);

  const parts = useMemo<SearchResult[]>(
    () => (data?.parts || []).filter((p) => p.backdrop_path || p.poster_path).map((p) => ({ ...p, media_type: 'movie' })),
    [data]
  );

  const genres = useMemo(() => {
    const ids = new Set(parts.flatMap((p) => p.genre_ids || []));
    return MOVIE_GENRES.filter(([gid]) => ids.has(gid));
  }, [parts]);

  const shown = useMemo(() => {
    let list = parts;
    if (genre) list = list.filter((p) => (p.genre_ids || []).includes(Number(genre)));
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((p) => getTitle(p).toLowerCase().includes(needle));
    const sorted = [...list];
    const released = (m: any) => (dateOf(m) ? dateOf(m) : '9999');
    switch (sort) {
      case 'newest': sorted.sort((a, b) => released(b).localeCompare(released(a))); break;
      case 'oldest':
      case 'order': sorted.sort((a, b) => released(a).localeCompare(released(b))); break;
      case 'rating': sorted.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)); break;
      case 'popular': sorted.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); break;
      case 'az': sorted.sort((a, b) => getTitle(a).localeCompare(getTitle(b))); break;
    }
    return sorted;
  }, [parts, genre, q, sort]);

  if (error) {
    return (
      <div className="pt-28">
        <ErrorState title="Franchise unavailable" message="We couldn't load this franchise right now." onRetry={reload} />
      </div>
    );
  }

  const years = parts.map(dateOf).filter(Boolean).sort();
  const span = years.length ? `${years[0].slice(0, 4)}–${years[years.length - 1].slice(0, 4)}` : '';

  return (
    <div>
      <section className="relative h-[min(42vw,72vh)] min-h-[380px] w-full overflow-hidden bg-black max-sm:h-[90vw]">
        {data?.backdrop_path && (
          <img
            src={tmdbImage(data.backdrop_path, 'w1280') || ''}
            alt=""
            decoding="async"
            onLoad={() => setHeroLoaded(true)}
            className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-700 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        {!data && <div className="nf-skel absolute inset-0 rounded-none opacity-60" />}
        <div className="nf-billboard-vignette" />
        <button type="button" onClick={() => goBack('/franchises')} aria-label="Back" className="nf-circle absolute left-[4%] top-[5.4rem] z-[4] text-base max-sm:top-[4.8rem]">
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="absolute bottom-[12%] left-[4%] z-[3] w-[min(52%,760px)] animate-fade-in-up max-sm:left-[6%] max-sm:right-[6%] max-sm:w-auto">
          <p className="mb-2 text-[max(12px,0.9vw)] font-semibold uppercase tracking-[0.25em] text-white/80">Franchise</p>
          <h1 className="mb-3 text-[clamp(2rem,4.2vw,4.8rem)] font-black leading-[0.95] tracking-[-0.03em] text-white text-shadow-netflix">{name || '\u00a0'}</h1>
          {data && (
            <p className="mb-2 text-[max(14px,1.05vw)] font-medium text-white/90 text-shadow-netflix">
              {parts.length} {parts.length === 1 ? 'movie' : 'movies'}
              {span && ` · ${span}`}
            </p>
          )}
          {data?.overview && <p className="hidden max-w-2xl overflow-hidden text-[max(14px,1.1vw)] leading-snug text-white/90 text-shadow-netflix [-webkit-box-orient:vertical] [-webkit-line-clamp:3] sm:[display:-webkit-box]">{data.overview}</p>}
        </div>
      </section>

      <div className="px-[4%] pt-[1.5vw]">
        <div className="mb-[2vw] flex flex-wrap items-center gap-2.5" role="toolbar" aria-label="Filters">
          <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as FSort)} className={`nf-select ${sort !== 'order' ? 'is-active' : ''}`}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {genres.length > 1 && (
            <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={`nf-select ${genre ? 'is-active' : ''}`}>
              <option value="">All genres</option>
              {genres.map(([gid, n]) => (
                <option key={gid} value={gid}>{n}</option>
              ))}
            </select>
          )}
          <label className="relative min-w-[12rem] flex-1 sm:max-w-[18rem]">
            <span className="sr-only">Search in this franchise</span>
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8c8c]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${name || 'this franchise'}`} className="nf-input" />
          </label>
        </div>
        {!data ? <SkeletonGrid count={6} /> : shown.length ? <ResultsGrid results={shown} /> : <p className="py-12 text-center text-netflix-muted">No movies match.</p>}
      </div>
    </div>
  );
};

export default FranchisePage;
