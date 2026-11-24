import React from 'react';
import { getPopularMovies, getTopRatedMovies, getUpcomingMovies } from '../services/tmdb';
import type { SearchResult } from '../types';
import CategoryPage from './CategoryPage';

interface MoviesPageProps {
    onSelect: (item: SearchResult) => void;
}

const PRIMARY = { title: 'Popular Movies', load: getPopularMovies };
const SECTIONS = [
    { title: 'Top Rated Movies', load: getTopRatedMovies },
    { title: 'Coming Soon', load: getUpcomingMovies },
];

const MoviesPage: React.FC<MoviesPageProps> = ({ onSelect }) => (
    <CategoryPage
        heading="Movies"
        heroEyebrow="Film"
        top10Title="Top 10 Movies Right Now"
        primary={PRIMARY}
        sections={SECTIONS}
        onSelect={onSelect}
    />
);

export default MoviesPage;
