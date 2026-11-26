import React, { useEffect } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { prefetchLogos } from '../utils/artwork';

interface ResultsGridProps {
  results: SearchResult[];
  onRemove?: (item: SearchResult) => void;
}

const ResultsGrid: React.FC<ResultsGridProps> = ({ results, onRemove }) => {
  useEffect(() => {
    prefetchLogos(results);
  }, [results]);

  return (
    <div className="grid grid-cols-2 gap-x-[0.4vw] gap-y-[3vw] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 max-sm:gap-x-1.5 max-sm:gap-y-4">
      {results.map((item) => (
        <div key={`${item.media_type}-${item.id}`}>
          <ResultCard item={item} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

export default ResultsGrid;
