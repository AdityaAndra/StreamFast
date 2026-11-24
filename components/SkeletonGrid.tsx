import React from 'react';

const SkeletonGrid: React.FC<{ count?: number }> = ({ count = 18 }) => (
  <div className="grid grid-cols-2 gap-x-[0.4vw] gap-y-[3vw] sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="nf-skel aspect-video w-full" style={{ ['--i' as any]: i % 6 }} />
    ))}
  </div>
);

export default SkeletonGrid;
