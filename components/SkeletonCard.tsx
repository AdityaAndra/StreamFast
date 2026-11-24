import React from 'react';

const SkeletonCard: React.FC<{ variant?: 'landscape' | 'poster' }> = ({ variant = 'landscape' }) => (
  <div className={`shimmer rounded-[4px] ${variant === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}`} />
);

export default SkeletonCard;
