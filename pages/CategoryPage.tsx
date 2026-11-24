import React, { useEffect, useState } from 'react';
import type { SearchResult } from '../types';
import HeroBanner, { HeroSkeleton } from '../components/HeroBanner';
import Top10Row from '../components/Top10Row';
import ContentCarousel from '../components/ContentCarousel';
import SkeletonCarousel from '../components/SkeletonCarousel';
import ErrorState from '../components/ErrorState';

export interface CategorySection {
    title: string;
    load: (signal: AbortSignal) => Promise<SearchResult[]>;
}

interface CategoryPageProps {
    heading: string;
    heroEyebrow: string;
    top10Title: string;
    /** Feeds the billboard and the Top 10 row. */
    primary: CategorySection;
    sections: CategorySection[];
    onSelect: (item: SearchResult) => void;
}

const ROWS_WRAPPER = 'relative z-10 -mt-[16vw] space-y-7 pb-4 sm:-mt-[11vw] sm:space-y-10 lg:-mt-[9vw] lg:space-y-12';

/** Netflix genre-page layout (Movies / TV Shows): page title, billboard, Top 10, themed rows. */
const CategoryPage: React.FC<CategoryPageProps> = ({ heading, heroEyebrow, top10Title, primary, sections, onSelect }) => {
    const [primaryItems, setPrimaryItems] = useState<SearchResult[]>([]);
    const [rows, setRows] = useState<SearchResult[][]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [main, ...rest] = await Promise.all([primary.load(controller.signal), ...sections.map((s) => s.load(controller.signal))]);
                if (!controller.signal.aborted) {
                    setPrimaryItems(main);
                    setRows(rest);
                }
            } catch (err) {
                if (!controller.signal.aborted) setError(`We couldn't load ${heading.toLowerCase()} right now. Please try again.`);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };
        load();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]);

    const title = (
        <div className="pointer-events-none absolute left-[4%] top-[4.75rem] z-[5] sm:top-[5.6rem]">
            <h1 className="text-2xl font-bold text-white text-shadow-netflix sm:text-4xl">{heading}</h1>
        </div>
    );

    if (isLoading) {
        return (
            <div className="relative">
                {title}
                <HeroSkeleton />
                <div className={ROWS_WRAPPER}>
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

    return (
        <div className="relative">
            {title}
            <HeroBanner items={primaryItems} onSelect={onSelect} eyebrow={heroEyebrow} />
            <div className={ROWS_WRAPPER}>
                <Top10Row title={top10Title} items={primaryItems} onSelect={onSelect} />
                {sections.map((section, i) => (
                    <ContentCarousel key={section.title} title={section.title} items={rows[i] || []} onSelect={onSelect} />
                ))}
                <ContentCarousel title={`More Popular ${heading}`} items={primaryItems.slice(10)} onSelect={onSelect} />
            </div>
        </div>
    );
};

export default CategoryPage;
