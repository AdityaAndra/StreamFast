import React, { useId, useSyncExternalStore } from 'react';
import type { SearchResult } from '../types';
import ResultCard from './ResultCard';
import { RowShell } from './ContentCarousel';
import { usePerRow } from '../utils/artwork';

interface Top10RowProps {
  title: string;
  items: SearchResult[];
}

/** Top 10 shows 5 tiles from 1400px up (as in the approved version), otherwise one fewer than normal rows. */
const subscribeResize = (cb: () => void) => {
  window.addEventListener('resize', cb, { passive: true });
  return () => window.removeEventListener('resize', cb);
};
const useTop10PerRow = () => {
  const perRow = usePerRow();
  const wide = useSyncExternalStore(subscribeResize, () => window.innerWidth >= 1400);
  return wide ? 5 : Math.max(2, perRow - 1);
};

/**
 * Netflix's outlined rank numbers (SVG so the stroke stays crisp at any size).
 * The outline is masked to the area OUTSIDE the glyph, so fonts whose digits are built from
 * overlapping shapes (e.g. the "4") never show stray lines inside the number.
 */
const RankNumber: React.FC<{ n: number }> = ({ n }) => {
  const maskId = `sf-rank-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const glyph =
    n === 10
      ? { x: 0, y: 147, fontSize: 186, letterSpacing: -14 }
      : { x: 128, y: 147, fontSize: 186, textAnchor: 'end' as const };
  return (
    <svg className="nf-top10-num" viewBox="0 0 130 150" preserveAspectRatio="xMinYMax meet" aria-hidden="true">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="270">
          <rect x="-60" y="-60" width="420" height="270" fill="#fff" />
          <text {...glyph} fill="#000">
            {n}
          </text>
        </mask>
      </defs>
      <text {...glyph} className="nf-top10-fill">
        {n}
      </text>
      <text {...glyph} className="nf-top10-stroke" mask={`url(#${maskId})`}>
        {n}
      </text>
    </svg>
  );
};

const Top10Row: React.FC<Top10RowProps> = ({ title, items }) => {
  const perRow = useTop10PerRow();
  const top = (items || []).filter((i) => i.poster_path).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <RowShell title={title} itemCount={top.length} perRow={perRow}>
      {top.map((item, index) => (
        <div key={`${item.media_type}-${item.id}`} className="nf-item">
          <div className="nf-top10-item">
            <RankNumber n={index + 1} />
            <div className="nf-top10-poster">
              <ResultCard item={item} variant="poster" />
            </div>
          </div>
        </div>
      ))}
    </RowShell>
  );
};

export default Top10Row;
