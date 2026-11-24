import React from 'react';
import type { SearchResult } from '../types';
import { useAppContext } from '../contexts/AppContext';
import ContinueWatchingGrid from '../components/ContinueWatchingGrid';
import UpdateFromLink, { UpdateFromLinkProps } from '../components/UpdateFromLink';
import ContentCarousel, { LazyRow } from '../components/ContentCarousel';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import ErrorState from '../components/ErrorState';
import { useCachedData } from '../utils/useCachedData';
import { HOME_HERO, HOME_ROWS } from '../utils/rows';

interface HomePageProps {
  linkProps: Omit<UpdateFromLinkProps, 'variant'>;
}

/** Rows rise into the bottom of the billboard, like Netflix. */
export const ROWS_OVERLAP = 'relative z-10 -mt-[18vw] sm:-mt-[10vw] lg:-mt-[8vw]';

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
      {hero.data ? <HeroBanner items={hero.data} eyebrow="Trending this week" /> : <HeroSkeleton />}
      <div className={ROWS_OVERLAP}>
        <ContinueWatchingGrid />
        {myList.length > 0 && <ContentCarousel title="My List" items={myList.map((i) => i.media)} onRemoveItem={toggleMyListItem} />}
        {HOME_ROWS.slice(0, 2).map((def) => (
          <LazyRow key={def.id} def={def} eager />
        ))}
        <div className="mb-[3vw]">
          <UpdateFromLink {...linkProps} />
        </div>
        {HOME_ROWS.slice(2).map((def) => (
          <LazyRow key={def.id} def={def} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
