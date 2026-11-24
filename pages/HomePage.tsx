import React from 'react';
import type { SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import ContinueWatchingGrid from '../components/ContinueWatchingGrid';
import UpdateFromLink, { UpdateFromLinkProps } from '../components/UpdateFromLink';
import ContentCarousel from '../components/ContentCarousel';
import { RowList } from '../components/BrandRow';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import ErrorState from '../components/ErrorState';
import { useCachedData } from '../utils/useCachedData';
import { HOME_HERO, HOME_ROWS } from '../utils/rows';

interface HomePageProps {
  linkProps: Omit<UpdateFromLinkProps, 'variant'>;
}

/** Rows rise into the bottom of the billboard, like Netflix. */
export const ROWS_OVERLAP = 'relative z-[1] mt-[max(22px,2.6vw)]';

const HomePage: React.FC<HomePageProps> = ({ linkProps }) => {
  const { myList, toggleMyListItem } = useAppContext();
  const hero = useCachedData<SearchResult[]>('hero:home', HOME_HERO);

  if (hero.error) {
    return (
      <div className="pt-28">
        <ErrorState message="We couldn't load titles right now. Check your connection and try again." onRetry={hero.reload} />
      </div>
    );
  }

  return (
    <div>
      {hero.data ? <HeroBanner items={hero.data} /> : <HeroSkeleton />}
      <div className={ROWS_OVERLAP}>
        <ContinueWatchingGrid />
        {myList.length > 0 && <ContentCarousel title="My List" items={myList.map((i) => i.media)} onRemoveItem={toggleMyListItem} viewAll="/my-list" />}
        <RowList rows={HOME_ROWS.slice(0, 2)} />
        <div className="mb-[3vw]">
          <UpdateFromLink {...linkProps} />
        </div>
        <RowList rows={HOME_ROWS.slice(2)} eagerCount={0} />
      </div>
    </div>
  );
};

export default HomePage;
