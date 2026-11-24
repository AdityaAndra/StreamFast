import React from 'react';
import SkeletonCard from './SkeletonCard';
import { LANDSCAPE_ITEM_CLASS } from './ContentCarousel';

const SkeletonCarousel: React.FC = () => {
  return (
    <div aria-hidden="true">
      <div className="mb-2 px-[4%]">
        <div className="h-5 w-40 rounded shimmer sm:h-6 sm:w-56" />
      </div>
      <div className="flex gap-1.5 overflow-hidden px-[4%] py-1 sm:gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className={LANDSCAPE_ITEM_CLASS}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkeletonCarousel;
