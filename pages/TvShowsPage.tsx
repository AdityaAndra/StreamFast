import React from 'react';
import CategoryPage from './CategoryPage';
import { TV_HERO, TV_ROWS } from '../utils/rows';

const TvShowsPage: React.FC = () => (
  <CategoryPage id="tv" heading="TV Shows" heroEyebrow="Series" loadHero={TV_HERO} rows={TV_ROWS} />
);

export default TvShowsPage;
