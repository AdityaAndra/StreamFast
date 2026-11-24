import React from 'react';
import type { SearchResult } from '../types';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import { LazyRow } from '../components/ContentCarousel';
import ErrorState from '../components/ErrorState';
import { useCachedData } from '../utils/useCachedData';
import type { RowDef } from '../utils/rows';
import { ROWS_OVERLAP } from './HomePage';

interface CategoryPageProps {
  id: string;
  heading: string;
  heroEyebrow?: string;
  loadHero?: () => Promise<SearchResult[]>;
  rows: RowDef[];
}

/** Netflix category layout (TV Shows / Movies / New & Popular). */
const CategoryPage: React.FC<CategoryPageProps> = ({ id, heading, heroEyebrow, loadHero, rows }) => {
  const hero = useCachedData<SearchResult[]>(loadHero ? `hero:${id}` : null, loadHero || (async () => []));

  const title = (
    <div className={`${loadHero ? 'pointer-events-none absolute left-[4%] top-[4.6rem] z-[5] sm:top-[5.4rem]' : 'px-[4%] pb-[1.5vw] pt-24 sm:pt-28'}`}>
      <h1 className="text-[clamp(1.6rem,2.6vw,2.75rem)] font-bold tracking-[-0.02em] text-white text-shadow-netflix">{heading}</h1>
    </div>
  );

  if (hero.error) {
    return (
      <div className="pt-28">
        <ErrorState message={`We couldn't load ${heading.toLowerCase()} right now.`} onRetry={hero.reload} />
      </div>
    );
  }

  return (
    <div className="relative">
      {title}
      {loadHero && (hero.data ? <HeroBanner items={hero.data} eyebrow={heroEyebrow} /> : <HeroSkeleton />)}
      <div className={loadHero ? ROWS_OVERLAP : ''}>
        {rows.map((def, i) => (
          <LazyRow key={def.id} def={def} eager={i < 2} />
        ))}
      </div>
    </div>
  );
};

export default CategoryPage;
