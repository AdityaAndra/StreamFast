import React from 'react';
import { usePerRow } from '../utils/artwork';

/** Netflix-style loading row: title bar + grey boxes pulsing left to right. */
const SkeletonCarousel: React.FC<{ variant?: 'landscape' | 'top10' }> = ({ variant = 'landscape' }) => {
  const perRow = usePerRow();
  const count = perRow + 1;
  return (
    <div className="nf-row" aria-hidden="true" style={{ contentVisibility: 'visible' }}>
      <div className="nf-row-header">
        <div className="nf-skel h-[max(15px,1.4vw)] w-[clamp(140px,16vw,300px)]" />
      </div>
      <div className="nf-slider overflow-hidden">
        <div className="nf-track" style={{ ['--per-row' as any]: perRow }}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="nf-item">
              {variant === 'top10' ? (
                <div className="nf-top10-item">
                  <div className="nf-skel absolute bottom-0 right-0 top-0 w-1/2 !rounded-[4px]" style={{ ['--i' as any]: i }} />
                </div>
              ) : (
                <div className="nf-skel aspect-video w-full" style={{ ['--i' as any]: i }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SkeletonCarousel;
