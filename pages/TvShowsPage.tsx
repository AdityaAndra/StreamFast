import React from 'react';
import { getPopularTvShows, getTopRatedTvShows, getOnTheAirTvShows } from '../services/tmdb';
import type { SearchResult } from '../types';
import CategoryPage from './CategoryPage';

interface TvShowsPageProps {
    onSelect: (item: SearchResult) => void;
}

const PRIMARY = { title: 'Popular TV Shows', load: getPopularTvShows };
const SECTIONS = [
    { title: 'New Episodes This Week', load: getOnTheAirTvShows },
    { title: 'Critically Acclaimed TV Shows', load: getTopRatedTvShows },
];

const TvShowsPage: React.FC<TvShowsPageProps> = ({ onSelect }) => (
    <CategoryPage
        heading="TV Shows"
        heroEyebrow="Series"
        top10Title="Top 10 TV Shows Right Now"
        primary={PRIMARY}
        sections={SECTIONS}
        onSelect={onSelect}
    />
);

export default TvShowsPage;
