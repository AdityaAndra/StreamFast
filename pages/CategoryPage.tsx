import React from 'react';
import type { SearchResult } from '../types';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import { RowList } from '../components/BrandRow';
import GenresMenu from '../components/GenresMenu';
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
  mediaType?: 'movie' | 'tv';
}

/** Netflix category layout (TV Shows / Movies / New & Popular). */
const CategoryPage: React.FC<CategoryPageProps> = ({ id, heading, loadHero, rows, mediaType }) => {
  const hero = useCachedData<SearchResult[]>(loadHero ? `hero:${id}` : null, loadHero || (async () => []));

  const titleRow = (
    <div className="flex flex-wrap items-center gap-[max(14px,1.4vw)]">
      <h1 className="text-[clamp(1.6rem,2.4vw,2.6rem)] font-bold tracking-[-0.02em] text-white">{heading}</h1>
      {mediaType && <GenresMenu mediaType={mediaType} />}
    </div>
  );
  const title = loadHero ? null : <div className="px-[4%] pb-[1.5vw] pt-24 sm:pt-28">{titleRow}</div>;

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
      {loadHero && (hero.data ? <HeroBanner items={hero.data} top={titleRow} /> : <HeroSkeleton top={titleRow} />)}
      <div className={loadHero ? ROWS_OVERLAP : ''}>
        <RowList rows={rows} />
      </div>
    </div>
  );
};

export default CategoryPage;
