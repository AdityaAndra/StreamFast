import React from 'react';

const SkeletonCard: React.FC<{ variant?: 'landscape' | 'poster'; index?: number }> = ({ variant = 'landscape', index = 0 }) => (
  <div className={`nf-skel w-full ${variant === 'poster' ? 'aspect-[2/3]' : 'aspect-video'}`} style={{ ['--i' as any]: index }} />
);

export default SkeletonCard;
