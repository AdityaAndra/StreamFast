import React from 'react';
import type { SearchResult } from '../types';
import { comingDate, useRelease } from '../utils/release';

/**
 * The small quality pill on popups and title pages: "HD" once a title is out digitally anywhere,
 * "CAM" (same look) while only cinema recordings exist, and its date before it comes out.
 */
export const QualityPill: React.FC<{ item: SearchResult; className: string }> = ({ item, className }) => {
  const release = useRelease(item);
  if (release === 'soon') {
    const when = comingDate(item);
    return <span className={className}>{when ? `Coming ${when}` : 'Coming soon'}</span>;
  }
  if (release === 'cam') {
    return (
      <span className={className}>
        CAM<span className="sr-only"> (cinema recording, not out in HD yet)</span>
      </span>
    );
  }
  return <span className={className}>HD</span>;
};
