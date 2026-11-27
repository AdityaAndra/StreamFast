import React, { useState } from 'react';
import FilterBar from '../components/FilterBar';
import { RowList } from '../components/BrandRow';
import { SearchIcon } from '../components/Icons';
import { navigate, Link } from '../utils/router';
import { parseBrowse, toQuery, MOVIE_GENRES, TV_GENRES } from '../utils/browse';
import { EXPLORE_ROWS } from '../utils/rows';

const DEFAULTS = parseBrowse('');

const GENRE_CHIPS: { label: string; to: string }[] = [
  ...MOVIE_GENRES.filter(([id]) => id !== 10770).map(([id, n]) => ({ label: `${n} Movies`, to: `/browse?type=movie&genre=${id}` })),
  ...TV_GENRES.filter(([id]) => [10759, 10765, 80, 18, 35, 10764, 99, 10762].includes(id)).map(([id, n]) => ({ label: `${n} TV`, to: `/browse?type=tv&genre=${id}` })),
];

/** Explore: search + every filter + Trending / New / Popular / Streaming / Studios / Production / Franchise rows. */
const ExplorePage: React.FC = () => {
  const [q, setQ] = useState('');

  return (
    <div>
      <div className="px-[4%] sf-page-top">
        <h1 className="mb-[1.4vw] text-[clamp(1.8rem,3vw,3.2rem)] font-bold tracking-[-0.02em] text-white">Categories</h1>

        <form
          className="relative mb-[1.6vw] max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8c8c8c]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, TV shows, franchises…"
            aria-label="Search titles"
            className="w-full rounded-[4px] border border-white/40 bg-black/60 py-[0.85em] pl-12 pr-28 text-[max(15px,1.1vw)] text-white placeholder:text-[#8c8c8c] transition-colors focus:border-white focus:outline-none"
          />
          <button type="submit" className="nf-btn nf-btn-white absolute right-1.5 top-1/2 -translate-y-1/2 !px-4 !py-2 !text-sm">
            Search
          </button>
        </form>

        <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-[#8c8c8c]">Browse with filters</p>
        <FilterBar params={DEFAULTS} hideSearch onChange={(patch) => navigate(`/browse${toQuery({ ...DEFAULTS, ...patch })}`)} />

        <div className="-mt-[0.8vw] mb-[3vw] flex flex-wrap gap-2">
          {GENRE_CHIPS.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="rounded-full border border-white/25 px-3.5 py-1.5 text-[13px] font-medium text-netflix-text transition-colors duration-150 hover:border-white hover:bg-white hover:text-black"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      <RowList rows={EXPLORE_ROWS} />
    </div>
  );
};

export default ExplorePage;
