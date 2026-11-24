import React from 'react';
import CategoryPage from './CategoryPage';
import { MOVIES_HERO, MOVIES_ROWS } from '../utils/rows';

const MoviesPage: React.FC = () => (
  <CategoryPage id="movies" heading="Movies" heroEyebrow="Film" loadHero={MOVIES_HERO} rows={MOVIES_ROWS} />
);

export default MoviesPage;
