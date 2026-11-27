import React, { useEffect, useMemo, useState } from 'react';
import type { BrowseParams } from '../utils/browse';
import { LISTS, SORTS, MOVIE_GENRES, TV_GENRES, LANGUAGES, RATINGS, yearOptions, genreLabel } from '../utils/browse';
import { getRegion, saveRegion, useProviders, REGIONS } from '../utils/brands';
import { SearchIcon, CloseIcon } from './Icons';

interface SelectProps {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
  active?: boolean;
  disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({ label, value, options, onChange, active, disabled }) => (
  <select
    aria-label={label}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className={`nf-select ${active ? 'is-active' : ''}`}
  >
    {options.map(([v, l]) => (
      <option key={v} value={v}>
        {l}
      </option>
    ))}
  </select>
);

const ALL_GENRES: [number, string][] = [...MOVIE_GENRES.filter(([id]) => id !== 10770), [10764, 'Reality'], [10762, 'Kids'], [10767, 'Talk']];
const TRENDING_SAFE = ['type', 'window', 'q', 'region', 'list'];

interface FilterBarProps {
  params: BrowseParams;
  onChange: (patch: Partial<BrowseParams>) => void;
  onReset?: () => void;
  /** Filters fixed by the page (e.g. a studio page locks "company"). */
  locked?: (keyof BrowseParams)[];
  hideSearch?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({ params, onChange, onReset, locked = [], hideSearch }) => {
  const isLocked = (k: keyof BrowseParams) => locked.includes(k);
  const region = params.region || getRegion();
  const showProviders = !isLocked('provider');
  const providers = useProviders(showProviders || params.provider ? region : null).data?.providers || [];
  const trending = params.list === 'trending';
  const tvOnly = !!params.network || params.type === 'tv';

  const set = (patch: Partial<BrowseParams>) => {
    // Trending lists can't be filtered by TMDB — switching any other filter turns it into a normal list.
    if (trending && Object.keys(patch).some((k) => !TRENDING_SAFE.includes(k))) patch = { ...patch, list: undefined };
    onChange(patch);
  };

  // Debounced "search in results"
  const [q, setQ] = useState(params.q || '');
  useEffect(() => setQ(params.q || ''), [params.q]);
  useEffect(() => {
    if ((params.q || '') === q) return;
    const t = window.setTimeout(() => onChange({ q: q || undefined }), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const genres = params.type === 'tv' || params.network ? TV_GENRES : params.type === 'movie' ? MOVIE_GENRES : ALL_GENRES;
  const genreOptions = useMemo<[string, string][]>(() => {
    const opts: [string, string][] = [['', 'All genres'], ...genres.map(([id, n]) => [String(id), n] as [string, string])];
    if (params.genre && !opts.some(([v]) => v === params.genre)) opts.push([params.genre, genreLabel(params.genre) || 'Custom']);
    return opts;
  }, [genres, params.genre]);

  const listOptions = LISTS.filter((l) => !(l.tvOnly && params.type === 'movie')).map((l) => [l.id, l.label] as [string, string]);
  const sortOptions = SORTS.filter((s) => !(s.id === 'revenue' && tvOnly)).map((s) => [s.id, s.label] as [string, string]);
  const providerOptions: [string, string][] = [['', 'Any service'], ...providers.map((p) => [String(p.id), p.name] as [string, string])];
  if (params.provider && !providerOptions.some(([v]) => v === params.provider)) providerOptions.push([params.provider, 'Selected service']);

  const hasActive =
    (!isLocked('type') && params.type !== 'all') ||
    (!isLocked('list') && !!params.list) ||
    params.sort !== 'popular' ||
    (!isLocked('genre') && !!params.genre) || !!params.year || (!isLocked('lang') && !!params.lang) || !!params.rating || !!params.q ||
    (!isLocked('provider') && !!params.provider);

  return (
    <div className="relative z-[6] mb-[2.2vw] flex flex-wrap items-center gap-2 sm:gap-2.5" role="toolbar" aria-label="Filters">
      {!isLocked('type') && !params.network && (
        <div className="nf-seg" role="group" aria-label="Type">
          {([['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows']] as const).map(([v, l]) => (
            <button key={v} type="button" className={params.type === v ? 'on' : ''} aria-pressed={params.type === v} onClick={() => set({ type: v, genre: undefined })}>
              {l}
            </button>
          ))}
        </div>
      )}

      {!isLocked('list') && (
        <Select label="Show" value={params.list || ''} options={listOptions} active={!!params.list} onChange={(v) => onChange({ list: (v || undefined) as BrowseParams['list'] })} />
      )}

      {trending ? (
        <Select label="Trending window" value={params.window || 'week'} options={[['day', 'Trending today'], ['week', 'Trending this week']]} onChange={(v) => onChange({ window: v as 'day' | 'week' })} />
      ) : (
        <Select label="Sort by" value={params.sort} options={sortOptions} active={params.sort !== 'popular'} onChange={(v) => set({ sort: v as BrowseParams['sort'] })} />
      )}

      {!isLocked('genre') && <Select label="Genre" value={params.genre || ''} options={genreOptions} active={!!params.genre} onChange={(v) => set({ genre: v || undefined })} />}

      <Select label="Year" value={params.year || ''} options={yearOptions()} active={!!params.year} onChange={(v) => set({ year: v || undefined })} />

      {showProviders && (
        <Select label="Streaming on" value={params.provider || ''} options={providerOptions} active={!!params.provider} onChange={(v) => set({ provider: v || undefined, region: v ? region : params.region })} />
      )}

      {(params.provider || isLocked('provider')) && (
        <Select
          label="Region"
          value={region}
          options={REGIONS}
          onChange={(v) => {
            saveRegion(v);
            onChange({ region: v });
          }}
        />
      )}

      {!isLocked('lang') && (
        <Select label="Language" value={params.lang || ''} options={[['', 'Any language'], ...LANGUAGES]} active={!!params.lang} onChange={(v) => set({ lang: v || undefined })} />
      )}

      <Select label="Rating" value={params.rating || ''} options={RATINGS} active={!!params.rating} onChange={(v) => set({ rating: v || undefined })} />

      {!hideSearch && (
        <label className="relative min-w-[12rem] flex-1 sm:max-w-[18rem]">
          <span className="sr-only">Search in these results</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c8c8c]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in these titles" className="nf-input" />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-[#bbb] hover:text-white">
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </label>
      )}

      {hasActive && onReset && (
        <button type="button" onClick={onReset} className="px-1 text-sm font-medium text-netflix-muted underline-offset-4 transition-colors hover:text-white hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
};

export default FilterBar;
