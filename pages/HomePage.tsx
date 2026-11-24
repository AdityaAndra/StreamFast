import React, { useState, useEffect } from 'react';
import { getTrending, getPopularMovies, getPopularTvShows, getTopRatedTvShows } from '../services/tmdb';
import type { SearchResult, WatchProgressItem } from '../types';
import { useAppContext } from '../contexts/AppContext';
import ContinueWatchingGrid from '../components/ContinueWatchingGrid';
import UpdateFromLink, { UpdateFromLinkProps } from '../components/UpdateFromLink';
import ContentCarousel from '../components/ContentCarousel';
import SkeletonCarousel from '../components/SkeletonCarousel';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import Top10Row from '../components/Top10Row';
import ErrorState from '../components/ErrorState';

interface HomePageProps {
    onSelect: (item: SearchResult) => void;
    onSelectFromContinueWatching: (item: WatchProgressItem) => void;
    linkProps: Omit<UpdateFromLinkProps, 'variant'>;
}

interface HomeData {
    trending: SearchResult[];
    popularMovies: SearchResult[];
    popularTv: SearchResult[];
    topRatedTv: SearchResult[];
}

const EMPTY: HomeData = { trending: [], popularMovies: [], popularTv: [], topRatedTv: [] };

/** Rows rise into the bottom of the billboard, like Netflix. */
const ROWS_WRAPPER = 'relative z-10 -mt-[16vw] space-y-7 pb-4 sm:-mt-[11vw] sm:space-y-10 lg:-mt-[9vw] lg:space-y-12';

const HomePage: React.FC<HomePageProps> = ({ onSelect, onSelectFromContinueWatching, linkProps }) => {
    const { continueWatchingList, myList, toggleMyListItem } = useAppContext();
    const [data, setData] = useState<HomeData>(EMPTY);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [trending, popularMovies, popularTv, topRatedTv] = await Promise.all([
                    getTrending(controller.signal),
                    getPopularMovies(controller.signal),
                    getPopularTvShows(controller.signal),
                    getTopRatedTvShows(controller.signal),
                ]);
                if (!controller.signal.aborted) setData({ trending, popularMovies, popularTv, topRatedTv });
            } catch (err) {
                if (!controller.signal.aborted) {
                    console.error('Failed to fetch homepage content:', err);
                    setError("We couldn't load titles right now. Check your connection and try again.");
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };
        load();
        return () => controller.abort();
    }, [reloadKey]);

    if (isLoading) {
        return (
            <div>
                <HeroSkeleton />
                <div className={ROWS_WRAPPER}>
                    <SkeletonCarousel />
                    <SkeletonCarousel />
                    <SkeletonCarousel />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="pt-28">
                <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
            </div>
        );
    }

    const hasContinueWatching = continueWatchingList.length > 0;

    return (
        <div>
            <HeroBanner items={data.trending} onSelect={onSelect} eyebrow="Trending this week" />
            <div className={ROWS_WRAPPER}>
                {hasContinueWatching && <ContinueWatchingGrid onSelect={onSelectFromContinueWatching} />}
                <UpdateFromLink {...linkProps} />
                {myList.length > 0 && (
                    <ContentCarousel title="My List" items={myList.map((i) => i.media)} onSelect={onSelect} onRemoveItem={toggleMyListItem} />
                )}
                <Top10Row title="Top 10 This Week" items={data.trending} onSelect={onSelect} />
                <ContentCarousel title="Trending Now" items={data.trending.slice(10)} onSelect={onSelect} />
                <ContentCarousel title="Popular Movies" items={data.popularMovies} onSelect={onSelect} />
                <ContentCarousel title="Popular on TV" items={data.popularTv} onSelect={onSelect} />
                <ContentCarousel title="Critically Acclaimed TV Shows" items={data.topRatedTv} onSelect={onSelect} />
            </div>
        </div>
    );
};

export default HomePage;
