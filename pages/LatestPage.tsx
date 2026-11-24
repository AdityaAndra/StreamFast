import React from 'react';
import CategoryPage from './CategoryPage';
import { LATEST_ROWS } from '../utils/rows';

const LatestPage: React.FC = () => <CategoryPage id="latest" heading="New & Popular" rows={LATEST_ROWS} />;

export default LatestPage;
