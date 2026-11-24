import React from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';

interface ResultsGridProps {
  results: SearchResult[];
  onSelect: (item: SearchResult) => void;
  onRemove?: (item: SearchResult) => void;
}

const ResultsGrid: React.FC<ResultsGridProps> = ({ results, onSelect, onRemove }) => {
  return (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-6 sm:grid-cols-3 sm:gap-x-2 sm:gap-y-8 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {results.map((item, index) => (
        <div
          key={`${item.media_type}-${item.id}`}
          className="opacity-0 animate-fade-in-up"
          style={{ animationDelay: `${Math.min(index, 18) * 30}ms` }}
        >
          <ResultCard item={item} onSelect={onSelect} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

export default ResultsGrid;
