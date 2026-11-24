import React from 'react';
import SkeletonCard from './SkeletonCard';

const SkeletonGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-x-1.5 gap-y-6 sm:grid-cols-3 sm:gap-x-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
};

export default SkeletonGrid;
